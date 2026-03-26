import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { db } from "@/lib/db";
import { getSessionInfo } from "@/lib/session";
import { getReviewVideoSignedUrl } from "@/lib/storage";
import { ArrowLeft, Trash2 } from "lucide-react";
import { ReviewViewer } from "@/components/review/review-viewer";
import { deleteReview } from "@/lib/actions/review";

export default async function ReviewDetailPage(props: {
  params: Promise<{ id: string }>;
}) {
  const info = await getSessionInfo();
  if (!info) redirect("/login");

  const { id } = await props.params;

  const review = await db.videoReview.findUnique({
    where: { id },
    include: {
      changes: { orderBy: { sortOrder: "asc" } },
      notes: { orderBy: { timecode: "asc" } },
    },
  });

  if (!review) notFound();

  // Generate signed URLs for video playback
  const [beforeVideoUrl, afterVideoUrl] = await Promise.all([
    getReviewVideoSignedUrl(review.beforeVideoPath),
    getReviewVideoSignedUrl(review.afterVideoPath),
  ]);

  if (!beforeVideoUrl || !afterVideoUrl) {
    return (
      <div className="text-center py-16">
        <p className="text-red-400">動画の読み込みに失敗しました</p>
      </div>
    );
  }

  const canDelete = info.role === "ADMIN" || review.createdBy === info.email;

  return (
    <div className="min-h-full bg-black p-6 md:p-8 space-y-4">
      <div className="flex items-center justify-between">
        <Link
          href="/dashboard/review"
          className="inline-flex items-center gap-1.5 text-sm text-white/40 hover:text-white/70 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          一覧に戻る
        </Link>

        {canDelete && (
          <form
            action={async () => {
              "use server";
              await deleteReview(id);
            }}
          >
            <button
              type="submit"
              className="flex items-center gap-1.5 text-xs text-red-400/50 hover:text-red-400 transition-colors"
            >
              <Trash2 className="w-3.5 h-3.5" />
              削除
            </button>
          </form>
        )}
      </div>

      <ReviewViewer
        review={{
          id: review.id,
          title: review.title,
          description: review.description,
          status: review.status,
          beforeVideoUrl,
          afterVideoUrl,
          afterDuration: review.afterDuration ?? 0,
          totalChanges: review.totalChanges,
          approvedBy: review.approvedBy,
          rejectedBy: review.rejectedBy,
          rejectionNote: review.rejectionNote,
          staffName: review.staffName,
          createdAt: review.createdAt.toISOString(),
        }}
        changes={review.changes.map((c) => ({
          id: c.id,
          type: c.type,
          timecodeIn: c.timecodeIn,
          timecodeOut: c.timecodeOut,
          description: c.description,
          confidence: c.confidence,
          beforeFramePath: c.beforeFramePath,
          afterFramePath: c.afterFramePath,
          diffFramePath: c.diffFramePath,
        }))}
        notes={review.notes.map((n) => ({
          id: n.id,
          timecode: n.timecode,
          text: n.text,
          author: n.author,
          createdAt: n.createdAt.toISOString(),
        }))}
      />
    </div>
  );
}
