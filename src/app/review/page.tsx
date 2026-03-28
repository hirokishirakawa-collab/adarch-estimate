import Link from "next/link";
import { db } from "@/lib/db";
import { getSessionInfo } from "@/lib/session";
import { redirect } from "next/navigation";
import { getThumbnailUrl } from "@/lib/mux";
import {
  Plus,
  Film,
  CheckCircle2,
  XCircle,
  Loader2,
  AlertTriangle,
  Clock,
  Layers,
  ArrowLeft,
} from "lucide-react";

const STATUS_CONFIG: Record<
  string,
  { label: string; icon: React.ElementType; color: string }
> = {
  UPLOADING:  { label: "準備中",   icon: Loader2,       color: "text-zinc-500" },
  ANALYZING:  { label: "解析中",   icon: Loader2,       color: "text-amber-400" },
  COMPLETED:  { label: "完了",     icon: Clock,         color: "text-blue-400" },
  FAILED:     { label: "失敗",     icon: AlertTriangle, color: "text-red-400" },
  APPROVED:   { label: "承認",     icon: CheckCircle2,  color: "text-emerald-400" },
  REJECTED:   { label: "差し戻し", icon: XCircle,       color: "text-red-400" },
};

export default async function ReviewListPage() {
  const info = await getSessionInfo();
  if (!info) redirect("/login");

  // ADMINは全件、それ以外はメンバー登録済み or 自分が作成者のみ
  const where = info.role === "ADMIN"
    ? {}
    : {
        OR: [
          { createdBy: info.email },
          { members: { some: { userId: info.userId } } },
        ],
      };

  const projects = await db.reviewProject.findMany({
    where,
    orderBy: { updatedAt: "desc" },
    take: 50,
    include: {
      reviews: {
        orderBy: { version: "desc" },
        take: 1,
        select: { version: true, status: true, totalChanges: true, afterVideoPath: true },
      },
      members: {
        select: { user: { select: { name: true } } },
        take: 5,
      },
    },
  });

  return (
    <div className="max-w-4xl mx-auto px-6 py-8">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div className="flex items-center gap-4">
          <Link
            href="/dashboard"
            className="p-2 rounded-lg text-zinc-600 hover:text-zinc-300 hover:bg-zinc-900 transition-colors"
          >
            <ArrowLeft className="w-5 h-5" />
          </Link>
          <div>
            <h1 className="text-2xl font-bold text-white tracking-tight">映像チェッカー</h1>
            <p className="text-sm text-zinc-500 mt-0.5">
              修正前後の動画を自動解析
            </p>
          </div>
        </div>
        <Link
          href="/review/new"
          className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-white text-black font-semibold text-sm hover:bg-zinc-200 transition-colors"
        >
          <Plus className="w-4 h-4" />
          新規
        </Link>
      </div>

      {projects.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-24 text-center">
          <div className="w-20 h-20 rounded-2xl bg-zinc-900 flex items-center justify-center mb-6">
            <Film className="w-10 h-10 text-zinc-700" />
          </div>
          <p className="text-zinc-400 text-lg font-medium mb-2">
            プロジェクトはまだありません
          </p>
          <p className="text-zinc-600 text-sm mb-8 max-w-sm">
            修正前後の動画をアップロードすると、変更点を自動検出します
          </p>
          <Link
            href="/review/new"
            className="px-6 py-3 rounded-xl bg-white text-black font-semibold text-sm hover:bg-zinc-200 transition-colors"
          >
            最初のプロジェクトを作成
          </Link>
        </div>
      ) : (
        <div className="space-y-2" data-tour="review-list">
          {projects.map((project) => {
            const latest = project.reviews[0];
            const config = latest
              ? STATUS_CONFIG[latest.status] ?? STATUS_CONFIG.COMPLETED
              : STATUS_CONFIG.COMPLETED;
            const Icon = config.icon;
            const playbackId = latest?.afterVideoPath;
            const thumbnail = playbackId && !playbackId.includes("/")
              ? getThumbnailUrl(playbackId, { time: 2, width: 160 })
              : null;

            return (
              <Link
                key={project.id}
                href={`/review/${project.id}`}
                className="flex items-center gap-4 px-4 py-3 rounded-2xl bg-zinc-900/60 border border-zinc-800/60 hover:border-zinc-700 hover:bg-zinc-900 transition-all group"
              >
                {/* Thumbnail */}
                <div className="w-24 h-14 rounded-lg bg-zinc-800 flex-shrink-0 overflow-hidden">
                  {thumbnail ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={thumbnail}
                      alt=""
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center">
                      <Film className="w-5 h-5 text-zinc-700" />
                    </div>
                  )}
                </div>

                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-white truncate">
                    {project.title}
                  </p>
                  <p className="text-xs text-zinc-600 mt-0.5">
                    {project.staffName} ・ {new Date(project.createdAt).toLocaleDateString("ja-JP")}
                  </p>
                </div>

                {/* メンバー */}
                {project.members.length > 0 && (
                  <div className="flex items-center gap-0.5 flex-shrink-0">
                    {project.members.map((m, i) => (
                      <span
                        key={i}
                        className="w-6 h-6 rounded-full bg-zinc-700 flex items-center justify-center text-[10px] text-zinc-300 font-medium border border-zinc-600"
                        title={m.user.name ?? ""}
                      >
                        {(m.user.name ?? "?")[0]}
                      </span>
                    ))}
                  </div>
                )}

                {latest && (
                  <span className="flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-lg bg-zinc-800 text-zinc-400 font-mono flex-shrink-0">
                    <Layers className="w-3 h-3" />
                    v{latest.version}
                  </span>
                )}

                {latest && latest.totalChanges > 0 && (
                  <span className="text-xs px-2.5 py-1 rounded-lg bg-amber-500/10 text-amber-400 font-medium flex-shrink-0">
                    {latest.totalChanges}件
                  </span>
                )}

                {latest && (
                  <div className={`flex items-center gap-1.5 text-xs font-medium flex-shrink-0 ${config.color}`}>
                    <Icon className={`w-3.5 h-3.5 ${latest.status === "ANALYZING" ? "animate-spin" : ""}`} />
                    {config.label}
                  </div>
                )}
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
