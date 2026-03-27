import { NextResponse } from "next/server";
import { after } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { runAnalysisPipeline } from "@/lib/video-analysis";

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { reviewId } = await req.json();
  if (!reviewId) {
    return NextResponse.json({ error: "reviewId is required" }, { status: 400 });
  }

  const review = await db.videoReview.findUnique({ where: { id: reviewId } });
  if (!review) {
    return NextResponse.json({ error: "Review not found" }, { status: 404 });
  }

  // Update status to ANALYZING
  await db.videoReview.update({
    where: { id: reviewId },
    data: {
      status: "ANALYZING",
      analysisStartedAt: new Date(),
      analysisError: null,
    },
  });

  // Run analysis in background using after()
  after(async () => {
    try {
      // MP4 static renditionが準備できるまで待機（最大3分）
      const { downloadReviewVideo } = await import("@/lib/storage");
      let downloadReady = false;
      for (let i = 0; i < 18; i++) {
        const testBefore = await downloadReviewVideo(review.beforeVideoPath);
        const testAfter = await downloadReviewVideo(review.afterVideoPath);
        if (testBefore && testAfter) {
          downloadReady = true;
          break;
        }
        console.log(`[analysis] Waiting for MP4 renditions... (${i + 1}/18)`);
        await new Promise((r) => setTimeout(r, 10000));
      }
      if (!downloadReady) {
        throw new Error("MP4レンディションの準備がタイムアウトしました。しばらく待ってから再度お試しください。");
      }

      const result = await runAnalysisPipeline(
        reviewId,
        review.beforeVideoPath,
        review.afterVideoPath
      );

      // Save changes to DB
      if (result.changes.length > 0) {
        await db.videoReviewChange.createMany({
          data: result.changes.map((c, idx) => ({
            reviewId,
            type: c.type,
            timecodeIn: c.timecodeIn,
            timecodeOut: c.timecodeOut ?? null,
            description: c.description,
            confidence: c.confidence,
            beforeFramePath: c.beforeFramePath ?? null,
            afterFramePath: c.afterFramePath ?? null,
            diffFramePath: c.diffFramePath ?? null,
            regionX: c.regionX ?? null,
            regionY: c.regionY ?? null,
            regionWidth: c.regionWidth ?? null,
            regionHeight: c.regionHeight ?? null,
            sortOrder: idx,
          })),
        });
      }

      // Update review with metadata
      await db.videoReview.update({
        where: { id: reviewId },
        data: {
          status: "COMPLETED",
          analysisFinishedAt: new Date(),
          totalChanges: result.changes.length,
          beforeDuration: result.beforeMeta.duration,
          beforeFps: result.beforeMeta.fps,
          afterDuration: result.afterMeta.duration,
          afterFps: result.afterMeta.fps,
        },
      });

      console.log(`[analysis] Review ${reviewId} completed: ${result.changes.length} changes`);
    } catch (e) {
      console.error(`[analysis] Review ${reviewId} failed:`, e);
      await db.videoReview.update({
        where: { id: reviewId },
        data: {
          status: "FAILED",
          analysisError: e instanceof Error ? e.message : String(e),
          analysisFinishedAt: new Date(),
        },
      });
    }
  });

  return NextResponse.json({ status: "started", reviewId });
}
