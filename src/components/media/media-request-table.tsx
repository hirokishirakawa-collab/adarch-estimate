import Link from "next/link";
import { ExternalLink } from "lucide-react";
import {
  MEDIA_REQUEST_STATUS_OPTIONS,
  getMediaTypeLabel,
  getStatusOption,
} from "@/lib/constants/media";
import type { UserRole } from "@/types/roles";

type MediaRequest = {
  id: string;
  mediaType: string;
  mediaName: string;
  status: string;
  startDate: Date | null;
  endDate: Date | null;
  createdAt: Date;
  customer: { id: string; name: string } | null;
  createdBy: { name: string | null } | null;
  branch: { name: string } | null;
};

interface Props {
  requests: MediaRequest[];
  role: UserRole;
}

function fmtDate(d: Date | null): string {
  if (!d) return "—";
  return new Intl.DateTimeFormat("ja-JP", { year: "numeric", month: "short", day: "numeric" })
    .format(new Date(d));
}

export function MediaRequestTable({ requests, role }: Props) {
  const isAdmin = role === "ADMIN";

  const counts = MEDIA_REQUEST_STATUS_OPTIONS.map((opt) => ({
    ...opt,
    count: requests.filter((r) => r.status === opt.value).length,
  }));

  return (
    <div className="space-y-5">
      {/* ── サマリーカード ── */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {counts.map(({ label, className, count }) => (
          <div key={label} className="bg-white border border-zinc-200 rounded-xl px-4 py-3">
            <p className="text-[11px] text-zinc-500 font-semibold uppercase tracking-wider mb-0.5">
              {label}
            </p>
            <div className="flex items-center gap-2">
              <p className="text-xl font-bold text-zinc-800">{count}</p>
              <span className={`inline-flex items-center px-1.5 py-0.5 text-[10px] font-semibold
                                rounded-full border ${className}`}>
                {label}
              </span>
            </div>
          </div>
        ))}
      </div>

      {/* ── テーブル ── */}
      <div className="bg-white rounded-xl border border-zinc-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-zinc-50 border-b border-zinc-100">
                {[
                  ["媒体種別",   "text-left"],
                  ["媒体名",     "text-left"],
                  ["顧客",       "text-left"],
                  ...(isAdmin ? [["拠点", "text-left"]] : []),
                  ["掲載期間",   "text-left"],
                  ["ステータス", "text-left"],
                  ["登録日",     "text-left"],
                  ["",          ""],
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
              {requests.map((req) => {
                const statusOpt = getStatusOption(req.status);
                const period =
                  req.startDate || req.endDate
                    ? `${fmtDate(req.startDate)} 〜 ${fmtDate(req.endDate)}`
                    : "—";

                return (
                  <tr key={req.id} className="hover:bg-zinc-50/50 transition-colors group">
                    {/* 媒体種別 */}
                    <td className="px-4 py-3 whitespace-nowrap">
                      <Link
                        href={`/dashboard/media/${req.id}`}
                        className="text-sm font-semibold text-zinc-800 hover:text-amber-700 hover:underline"
                      >
                        {getMediaTypeLabel(req.mediaType)}
                      </Link>
                    </td>

                    {/* 媒体名 */}
                    <td className="px-4 py-3 max-w-[160px]">
                      <span className="text-xs text-zinc-600 truncate block">{req.mediaName}</span>
                    </td>

                    {/* 顧客 */}
                    <td className="px-4 py-3 max-w-[140px]">
                      {req.customer ? (
                        <Link
                          href={`/dashboard/customers/${req.customer.id}`}
                          className="text-xs text-amber-600 hover:underline truncate block"
                        >
                          {req.customer.name}
                        </Link>
                      ) : (
                        <span className="text-xs text-zinc-400">—</span>
                      )}
                    </td>

                    {/* 拠点（ADMIN のみ） */}
                    {isAdmin && (
                      <td className="px-4 py-3 whitespace-nowrap">
                        <span className="text-xs text-zinc-500">{req.branch?.name ?? "—"}</span>
                      </td>
                    )}

                    {/* 掲載期間 */}
                    <td className="px-4 py-3 whitespace-nowrap">
                      <span className="text-xs text-zinc-500">{period}</span>
                    </td>

                    {/* ステータス */}
                    <td className="px-4 py-3 whitespace-nowrap">
                      <span className={`inline-flex items-center px-2 py-0.5 text-[11px] font-semibold
                                        rounded-full border ${statusOpt.className}`}>
                        {statusOpt.label}
                      </span>
                    </td>

                    {/* 登録日 */}
                    <td className="px-4 py-3 whitespace-nowrap">
                      <span className="text-xs text-zinc-500">{fmtDate(req.createdAt)}</span>
                    </td>

                    {/* 操作 */}
                    <td className="px-4 py-3 whitespace-nowrap">
                      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        <Link
                          href={`/dashboard/media/${req.id}`}
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

              {requests.length === 0 && (
                <tr>
                  <td
                    colSpan={isAdmin ? 8 : 7}
                    className="px-4 py-16 text-center text-sm text-zinc-400"
                  >
                    媒体依頼がまだありません
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
