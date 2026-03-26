import Link from "next/link";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { getSessionInfo } from "@/lib/session";
import {
  Plus,
  Film,
  CheckCircle2,
  XCircle,
  Loader2,
  AlertTriangle,
  Clock,
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

  const reviews = await db.videoReview.findMany({
    orderBy: { createdAt: "desc" },
    take: 50,
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-white/90">映像チェッカー</h1>
          <p className="text-sm text-white/40 mt-0.5">
            修正前後の動画を自動解析し、変更点を検出します
          </p>
        </div>
        <Link
          href="/dashboard/review/new"
          className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-gradient-to-r from-amber-600 to-amber-700 text-white font-semibold text-sm hover:from-amber-500 hover:to-amber-600 transition-all"
        >
          <Plus className="w-4 h-4" />
          新規チェック
        </Link>
      </div>

      {reviews.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <Film className="w-16 h-16 text-white/10 mb-4" />
          <p className="text-white/40 text-lg font-medium mb-1">
            レビューはまだありません
          </p>
          <p className="text-white/25 text-sm mb-6">
            修正前後の動画をアップロードして、変更点を自動検出しましょう
          </p>
          <Link
            href="/dashboard/review/new"
            className="px-5 py-2.5 rounded-xl bg-amber-600/15 text-amber-400 border border-amber-500/20 font-medium text-sm hover:bg-amber-600/25 transition-all"
          >
            最初のレビューを作成
          </Link>
        </div>
      ) : (
        <div className="space-y-2">
          {reviews.map((review) => {
            const config = STATUS_CONFIG[review.status] ?? STATUS_CONFIG.COMPLETED;
            const Icon = config.icon;
            return (
              <Link
                key={review.id}
                href={`/dashboard/review/${review.id}`}
                className="flex items-center gap-4 px-4 py-3.5 rounded-xl bg-white/[0.02] border border-white/5 hover:border-amber-500/20 hover:bg-white/[0.04] transition-all group"
              >
                <Film className="w-5 h-5 text-white/20 group-hover:text-amber-500/50 transition-colors flex-shrink-0" />

                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-white/80 truncate">
                    {review.title}
                  </p>
                  <p className="text-xs text-white/30 mt-0.5">
                    {review.staffName} ・{" "}
                    {new Date(review.createdAt).toLocaleDateString("ja-JP")}
                  </p>
                </div>

                {review.totalChanges > 0 && (
                  <span className="text-xs px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-400/70 border border-amber-500/15 font-medium flex-shrink-0">
                    {review.totalChanges} 件
                  </span>
                )}

                <div className={`flex items-center gap-1.5 text-xs font-medium flex-shrink-0 ${config.color}`}>
                  <Icon className={`w-3.5 h-3.5 ${review.status === "ANALYZING" ? "animate-spin" : ""}`} />
                  {config.label}
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
