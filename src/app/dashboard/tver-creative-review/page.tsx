import Link from "next/link";
import { Tv2, Plus, ExternalLink } from "lucide-react";
import { getTverCreativeReviewList } from "@/lib/actions/tver-creative-review";

const STATUS_LABEL: Record<string, { label: string; className: string }> = {
  SUBMITTED: { label: "申請中",  className: "bg-amber-50  text-amber-700  border-amber-200"  },
  APPROVED:  { label: "承認",    className: "bg-green-50  text-green-700  border-green-200"  },
  REJECTED:  { label: "否決",    className: "bg-red-50    text-red-700    border-red-200"    },
};

function fmtDate(d: Date | null): string {
  if (!d) return "—";
  return new Intl.DateTimeFormat("ja-JP", {
    year: "numeric", month: "short", day: "numeric",
  }).format(new Date(d));
}

export default async function TverCreativeReviewPage() {
  const { reviews, role } = await getTverCreativeReviewList();
  const isAdmin = role === "ADMIN";

  return (
    <div className="px-6 py-6 max-w-screen-xl mx-auto w-full">
      <div className="flex items-center justify-between mb-6 flex-wrap gap-4">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 bg-blue-50 rounded-xl flex items-center justify-center">
            <Tv2 className="text-blue-700" style={{ width: "1.125rem", height: "1.125rem" }} />
          </div>
          <div>
            <h2 className="text-lg font-bold text-zinc-900">TVer クリエイティブ考査申請</h2>
            <p className="text-xs text-zinc-500 mt-0.5">
              {isAdmin ? "全拠点のクリエイティブ考査申請を管理します" : "TVer広告素材の考査を申請します"}
            </p>
          </div>
        </div>

        <Link
          href="/dashboard/tver-creative-review/new"
          className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-700 text-white
                     text-xs font-medium rounded-lg hover:bg-blue-800 transition-colors"
        >
          <Plus className="w-3.5 h-3.5" />
          新規申請
        </Link>
      </div>

      <div className="bg-white rounded-xl border border-zinc-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-zinc-50 border-b border-zinc-100">
                {[
                  ["プロジェクト名", "text-left"],
                  ["広告主",         "text-left"],
                  ["本数",           "text-left"],
                  ["ステータス",     "text-left"],
                  ...(isAdmin ? [["拠点", "text-left"]] : []),
                  ["申請日",         "text-left"],
                  ["",               ""],
                ].map(([label, cls], i) => (
                  <th key={i}
                      className={`px-4 py-2.5 text-[11px] font-semibold text-zinc-500
                                  uppercase tracking-wider whitespace-nowrap ${cls}`}>
                    {label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-50">
              {reviews.map((r) => {
                const status = STATUS_LABEL[r.status] ?? STATUS_LABEL.SUBMITTED;
                return (
                  <tr key={r.id} className="hover:bg-zinc-50/50 transition-colors group">
                    <td className="px-4 py-3 max-w-[220px]">
                      <Link
                        href={`/dashboard/tver-creative-review/${r.id}`}
                        className="text-sm font-semibold text-zinc-800 hover:text-blue-700
                                   hover:underline truncate block"
                      >
                        {r.projectName}
                      </Link>
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      <span className="text-xs text-zinc-600">{r.advertiser?.name ?? "—"}</span>
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      <span className="text-xs text-zinc-600">{r.numberOfAssets}本</span>
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      <span className={`inline-flex items-center px-2 py-0.5 text-[11px]
                                        font-semibold rounded-full border ${status.className}`}>
                        {status.label}
                      </span>
                    </td>
                    {isAdmin && (
                      <td className="px-4 py-3 whitespace-nowrap">
                        <span className="text-xs text-zinc-500">{r.branch?.name ?? "—"}</span>
                      </td>
                    )}
                    <td className="px-4 py-3 whitespace-nowrap">
                      <span className="text-xs text-zinc-500">{fmtDate(r.createdAt)}</span>
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100
                                      transition-opacity">
                        <Link
                          href={`/dashboard/tver-creative-review/${r.id}`}
                          className="inline-flex items-center gap-1 px-2 py-1 text-[11px]
                                     text-zinc-400 hover:text-zinc-800 hover:bg-zinc-100
                                     rounded transition-colors"
                        >
                          <ExternalLink className="w-3 h-3" />詳細
                        </Link>
                      </div>
                    </td>
                  </tr>
                );
              })}

              {reviews.length === 0 && (
                <tr>
                  <td
                    colSpan={isAdmin ? 7 : 6}
                    className="px-4 py-16 text-center text-sm text-zinc-400"
                  >
                    クリエイティブ考査申請がまだありません
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
