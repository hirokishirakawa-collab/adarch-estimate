import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";

export async function GET(req: Request) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const reviewId = searchParams.get("id");
  if (!reviewId) {
    return NextResponse.json({ error: "id is required" }, { status: 400 });
  }

  const review = await db.videoReview.findUnique({
    where: { id: reviewId },
    select: {
      id: true,
      status: true,
      totalChanges: true,
      analysisError: true,
      analysisStartedAt: true,
      analysisFinishedAt: true,
    },
  });

  if (!review) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  return NextResponse.json(review);
}
