import Link from "next/link";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { getSessionInfo } from "@/lib/session";
import { WikiHelpLink } from "@/components/wiki/wiki-help-link";
import {
  Plus,
  Film,
  CheckCircle2,
  XCircle,
  Loader2,
  AlertTriangle,
  Clock,
  Layers,
} from "lucide-react";

const STATUS_CONFIG: Record<
  string,
  { label: string; icon: React.ElementType; color: string }
> = {
  UPLOADING:  { label: "アップロード中", icon: Loader2,       color: "text-white/40" },
  ANALYZING:  { label: "解析中",         icon: Loader2,       color: "text-amber-400" },
  COMPLETED:  { label: "解析完了",       icon: Clock,         color: "text-blue-400" },
  FAILED:     { label: "失敗",           icon: AlertTriangle, color: "text-red-400" },
  APPROVED:   { label: "承認済み",       icon: CheckCircle2,  color: "text-emerald-400" },
  REJECTED:   { label: "差し戻し",       icon: XCircle,       color: "text-red-400" },
};

export default async function ReviewListPage() {
  const info = await getSessionInfo();
  if (!info) redirect("/login");

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
        select: { version: true, status: true, totalChanges: true },
      },
      members: {
        select: { user: { select: { name: true } } },
        take: 5,
      },
    },
  });

  return (
    <div className="min-h-full bg-black p-6 md:p-8 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-white">映像チェッカー</h1>
          <p className="text-sm text-zinc-500 mt-0.5">
            修正前後の動画を自動解析し、変更点をバージョン管理します
          </p>
          <WikiHelpLink query="映像チェッカー" />
        </div>
        <Link
          href="/dashboard/review/new"
          className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-gradient-to-r from-amber-600 to-amber-700 text-white font-semibold text-sm hover:from-amber-500 hover:to-amber-600 transition-all"
        >
          <Plus className="w-4 h-4" />
          新規プロジェクト
        </Link>
      </div>

      {projects.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <Film className="w-16 h-16 text-zinc-700 mb-4" />
          <p className="text-zinc-400 text-lg font-medium mb-1">
            プロジェクトはまだありません
          </p>
          <p className="text-zinc-600 text-sm mb-6">
            修正前後の動画をアップロードして、変更点を自動検出しましょう
          </p>
          <Link
            href="/dashboard/review/new"
            className="px-5 py-2.5 rounded-xl bg-amber-600/15 text-amber-400 border border-amber-500/20 font-medium text-sm hover:bg-amber-600/25 transition-all"
          >
            最初のプロジェクトを作成
          </Link>
        </div>
      ) : (
        <div className="space-y-2">
          {projects.map((project) => {
            const latest = project.reviews[0];
            const config = latest
              ? STATUS_CONFIG[latest.status] ?? STATUS_CONFIG.COMPLETED
              : STATUS_CONFIG.COMPLETED;
            const Icon = config.icon;

            return (
              <Link
                key={project.id}
                href={`/dashboard/review/${project.id}`}
                className="flex items-center gap-4 px-4 py-3.5 rounded-xl bg-zinc-900 border border-zinc-800 hover:border-amber-500/30 hover:bg-zinc-900/80 transition-all group"
              >
                <Film className="w-5 h-5 text-zinc-600 group-hover:text-amber-500/50 transition-colors flex-shrink-0" />

                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-white truncate">
                    {project.title}
                  </p>
                  <p className="text-xs text-zinc-500 mt-0.5">
                    {project.staffName} ・{" "}
                    {new Date(project.createdAt).toLocaleDateString("ja-JP")}
                  </p>
                </div>

                {latest && (
                  <span className="flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-full bg-zinc-800 text-zinc-400 border border-zinc-700 font-medium flex-shrink-0">
                    <Layers className="w-3 h-3" />
                    v{latest.version}
                  </span>
                )}

                {latest && latest.totalChanges > 0 && (
                  <span className="text-xs px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-400/70 border border-amber-500/15 font-medium flex-shrink-0">
                    {latest.totalChanges} 件
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
