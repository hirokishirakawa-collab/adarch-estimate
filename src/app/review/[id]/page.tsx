import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { db } from "@/lib/db";
import { getSessionInfo } from "@/lib/session";
import { getReviewVideoSignedUrl } from "@/lib/storage";
import { ArrowLeft, Trash2 } from "lucide-react";
import { ReviewViewer } from "@/components/review/review-viewer";
import { VersionTimeline } from "@/components/review/version-timeline";
import { AddVersionForm } from "@/components/review/add-version-form";
import { ChangeSummary } from "@/components/review/change-summary";
import { deleteProject } from "@/lib/actions/review";

export default async function ProjectDetailPage(props: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ v?: string }>;
}) {
  const info = await getSessionInfo();
  if (!info) redirect("/login");

  const { id } = await props.params;
  const { v: versionParam } = await props.searchParams;

  const project = await db.reviewProject.findUnique({
    where: { id },
    include: {
      reviews: {
        orderBy: { version: "asc" },
        include: {
          changes: { orderBy: { sortOrder: "asc" } },
          notes: { orderBy: { timecode: "asc" } },
        },
      },
    },
  });

  if (!project) notFound();

  const selectedVersion = versionParam
    ? parseInt(versionParam)
    : project.reviews[project.reviews.length - 1]?.version ?? 1;
  const selectedReview =
    project.reviews.find((r) => r.version === selectedVersion) ??
    project.reviews[project.reviews.length - 1];

  let beforeVideoUrl: string | null = null;
  let afterVideoUrl: string | null = null;
  if (selectedReview) {
    [beforeVideoUrl, afterVideoUrl] = await Promise.all([
      getReviewVideoSignedUrl(selectedReview.beforeVideoPath),
      getReviewVideoSignedUrl(selectedReview.afterVideoPath),
    ]);
  }

  const canDelete = info.role === "ADMIN" || project.createdBy === info.email;

  const allChanges = project.reviews.flatMap((r) =>
    r.changes.map((c) => ({
      version: r.version,
      type: c.type,
      timecodeIn: c.timecodeIn,
      timecodeOut: c.timecodeOut,
      description: c.description,
      status: r.status,
    }))
  );
  const allNotes = project.reviews.flatMap((r) =>
    r.notes.map((n) => ({
      version: r.version,
      timecode: n.timecode,
      text: n.text,
      author: n.author,
    }))
  );

  return (
    <div className="max-w-6xl mx-auto px-6 py-8 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link
            href="/review"
            className="p-2 rounded-lg text-zinc-600 hover:text-zinc-300 hover:bg-zinc-900 transition-colors"
          >
            <ArrowLeft className="w-5 h-5" />
          </Link>
          <div>
            <h1 className="text-xl font-bold text-white">{project.title}</h1>
            {project.description && (
              <p className="text-sm text-zinc-500 mt-0.5">{project.description}</p>
            )}
          </div>
        </div>
        {canDelete && (
          <form action={async () => { "use server"; await deleteProject(id); }}>
            <button type="submit" className="flex items-center gap-1.5 text-xs text-zinc-600 hover:text-red-400 transition-colors">
              <Trash2 className="w-3.5 h-3.5" /> 削除
            </button>
          </form>
        )}
      </div>

      {/* Version Timeline */}
      <VersionTimeline
        projectId={project.id}
        reviews={project.reviews.map((r) => ({
          id: r.id,
          version: r.version,
          status: r.status,
          totalChanges: r.totalChanges,
          createdAt: r.createdAt.toISOString(),
          staffName: r.staffName,
        }))}
        selectedVersion={selectedVersion}
        basePath="/review"
      />

      {/* Video Viewer */}
      {selectedReview && beforeVideoUrl && afterVideoUrl ? (
        <ReviewViewer
          review={{
            id: selectedReview.id,
            title: selectedReview.title,
            description: selectedReview.description,
            status: selectedReview.status,
            beforeVideoUrl,
            afterVideoUrl,
            afterDuration: selectedReview.afterDuration ?? 0,
            totalChanges: selectedReview.totalChanges,
            approvedBy: selectedReview.approvedBy,
            rejectedBy: selectedReview.rejectedBy,
            rejectionNote: selectedReview.rejectionNote,
            staffName: selectedReview.staffName,
            createdAt: selectedReview.createdAt.toISOString(),
          }}
          changes={selectedReview.changes.map((c) => ({
            id: c.id, type: c.type, timecodeIn: c.timecodeIn, timecodeOut: c.timecodeOut,
            description: c.description, confidence: c.confidence,
            beforeFramePath: c.beforeFramePath, afterFramePath: c.afterFramePath,
            diffFramePath: c.diffFramePath,
          }))}
          notes={selectedReview.notes.map((n) => ({
            id: n.id, timecode: n.timecode, text: n.text,
            author: n.author, createdAt: n.createdAt.toISOString(),
          }))}
        />
      ) : (
        <div className="text-center py-16">
          <p className="text-zinc-500">動画を読み込めませんでした</p>
        </div>
      )}

      {/* Add Version */}
      <AddVersionForm projectId={project.id} currentVersion={project.reviews.length} />

      {/* Summary */}
      {project.reviews.length > 0 && (
        <ChangeSummary
          projectTitle={project.title}
          versions={project.reviews.map((r) => r.version)}
          allChanges={allChanges}
          allNotes={allNotes}
        />
      )}
    </div>
  );
}
