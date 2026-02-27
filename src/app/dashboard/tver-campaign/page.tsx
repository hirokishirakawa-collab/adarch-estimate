import Link from "next/link";
import { Tv2, Plus, ExternalLink } from "lucide-react";
import { getTverCampaignList } from "@/lib/actions/tver-campaign";
import {
  getCampaignStatusOption,
  getBudgetTypeLabel,
} from "@/lib/constants/tver-campaign";

function fmtDate(d: Date | null): string {
  if (!d) return "—";
  return new Intl.DateTimeFormat("ja-JP", {
    year: "numeric", month: "short", day: "numeric",
  }).format(new Date(d));
}

function fmtBudget(v: unknown): string {
  const n = Number(v);
  return isNaN(n) ? "—" : `¥${n.toLocaleString("ja-JP")}`;
}

export default async function TverCampaignPage() {
  const { campaigns, role } = await getTverCampaignList();
  const isAdmin = role === "ADMIN";

  return (
    <div className="px-6 py-6 max-w-screen-xl mx-auto w-full">
      <div className="flex items-center justify-between mb-6 flex-wrap gap-4">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 bg-blue-50 rounded-xl flex items-center justify-center">
            <Tv2 className="text-blue-700" style={{ width: "1.125rem", height: "1.125rem" }} />
          </div>
          <div>
            <h2 className="text-lg font-bold text-zinc-900">TVer配信申請</h2>
            <p className="text-xs text-zinc-500 mt-0.5">
              {isAdmin ? "全拠点のTVer配信申請を管理します" : "TVer広告の配信を申請します"}
            </p>
          </div>
        </div>

        <Link
          href="/dashboard/tver-campaign/new"
          className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-700 text-white
                     text-xs font-medium rounded-lg hover:bg-blue-800 transition-colors"
        >
          <Plus className="w-3.5 h-3.5" />
          新規申請
        </Link>
      </div>

      {/* テーブル */}
      <div className="bg-white rounded-xl border border-zinc-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-zinc-50 border-b border-zinc-100">
                {[
                  ["キャンペーン名", "text-left"],
                  ["広告主",         "text-left"],
                  ["予算（税抜）",   "text-left"],
                  ["配信期間",       "text-left"],
                  ["予算タイプ",     "text-left"],
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
              {campaigns.map((c) => {
                const status = getCampaignStatusOption(c.status);
                return (
                  <tr key={c.id} className="hover:bg-zinc-50/50 transition-colors group">
                    <td className="px-4 py-3 max-w-[200px]">
                      <Link
                        href={`/dashboard/tver-campaign/${c.id}`}
                        className="text-sm font-semibold text-zinc-800 hover:text-blue-700
                                   hover:underline truncate block"
                      >
                        {c.campaignName}
                      </Link>
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      <span className="text-xs text-zinc-600">{c.advertiser?.name ?? "—"}</span>
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      <span className="text-xs text-zinc-600 font-mono">{fmtBudget(c.budget)}</span>
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      <span className="text-xs text-zinc-500">
                        {fmtDate(c.startDate)} 〜 {fmtDate(c.endDate)}
                      </span>
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      <span className="text-xs text-zinc-500">{getBudgetTypeLabel(c.budgetType)}</span>
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      <span className={`inline-flex items-center px-2 py-0.5 text-[11px]
                                        font-semibold rounded-full border ${status.className}`}>
                        {status.label}
                      </span>
                    </td>
                    {isAdmin && (
                      <td className="px-4 py-3 whitespace-nowrap">
                        <span className="text-xs text-zinc-500">{c.branch?.name ?? "—"}</span>
                      </td>
                    )}
                    <td className="px-4 py-3 whitespace-nowrap">
                      <span className="text-xs text-zinc-500">{fmtDate(c.createdAt)}</span>
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100
                                      transition-opacity">
                        <Link
                          href={`/dashboard/tver-campaign/${c.id}`}
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

              {campaigns.length === 0 && (
                <tr>
                  <td
                    colSpan={isAdmin ? 9 : 8}
                    className="px-4 py-16 text-center text-sm text-zinc-400"
                  >
                    TVer配信申請がまだありません
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
