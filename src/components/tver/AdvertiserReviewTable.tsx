import Link from "next/link";
import { ExternalLink } from "lucide-react";
import {
  ADVERTISER_REVIEW_STATUS_OPTIONS,
  getReviewStatusOption,
} from "@/lib/constants/advertiser-review";
import type { UserRole } from "@/types/roles";

type AdvertiserReview = {
  id: string;
  name: string;
  websiteUrl: string;
  corporateNumber: string | null;
  hasNoCorporateNumber: boolean;
  status: string;
  desiredStartDate: Date | null;
  createdAt: Date;
  createdBy: { name: string | null } | null;
  branch: { name: string } | null;
};

interface Props {
  reviews: AdvertiserReview[];
  role: UserRole;
}

function fmtDate(d: Date | null): string {
  if (!d) return "—";
  return new Intl.DateTimeFormat("ja-JP", {
    year: "numeric",
    month: "short",
    day: "numeric",
  }).format(new Date(d));
}

export function AdvertiserReviewTable({ reviews, role }: Props) {
  const isAdmin = role === "ADMIN";

  const counts = ADVERTISER_REVIEW_STATUS_OPTIONS.map((opt) => ({
    ...opt,
    count: reviews.filter((r) => r.status === opt.value).length,
  }));

  return (
    <div className="space-y-5">
      {/* ── サマリーカード ── */}
      <div className="grid grid-cols-3 gap-3">
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
                  ["広告主名",     "text-left"],
                  ["法人番号",     "text-left"],
                  ...(isAdmin ? [["拠点", "text-left"]] : []),
                  ["希望開始日",   "text-left"],
                  ["ステータス",   "text-left"],
                  ["申請者",       "text-left"],
                  ["申請日",       "text-left"],
                  ["",            ""],
                ].map(([label, cls], i) => (
                  <th
                    key={i}
                    className={`px-4 py-2.5 text-[11px] font-semibold text-zinc-500
                                uppercase tracking-wider whitespace-nowrap ${cls}`}
                  >
                    {label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-50">
              {reviews.map((rev) => {
                const statusOpt = getReviewStatusOption(rev.status);
                const corpDisplay = rev.hasNoCorporateNumber
                  ? "なし"
                  : rev.corporateNumber ?? "—";

                return (
                  <tr key={rev.id} className="hover:bg-zinc-50/50 transition-colors group">
                    {/* 広告主名 */}
                    <td className="px-4 py-3 max-w-[180px]">
                      <Link
                        href={`/dashboard/tver-review/${rev.id}`}
                        className="text-sm font-semibold text-zinc-800 hover:text-blue-700
                                   hover:underline truncate block"
                      >
                        {rev.name}
                      </Link>
                      <a
                        href={rev.websiteUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-[11px] text-zinc-400 hover:text-blue-600 truncate block"
                      >
                        {rev.websiteUrl}
                      </a>
                    </td>

                    {/* 法人番号 */}
                    <td className="px-4 py-3 whitespace-nowrap">
                      <span className="text-xs text-zinc-600 font-mono">{corpDisplay}</span>
                    </td>

                    {/* 拠点（ADMIN のみ） */}
                    {isAdmin && (
                      <td className="px-4 py-3 whitespace-nowrap">
                        <span className="text-xs text-zinc-500">
                          {rev.branch?.name ?? "—"}
                        </span>
                      </td>
                    )}

                    {/* 希望開始日 */}
                    <td className="px-4 py-3 whitespace-nowrap">
                      <span className="text-xs text-zinc-500">
                        {fmtDate(rev.desiredStartDate)}
                      </span>
                    </td>

                    {/* ステータス */}
                    <td className="px-4 py-3 whitespace-nowrap">
                      <span className={`inline-flex items-center px-2 py-0.5 text-[11px]
                                        font-semibold rounded-full border ${statusOpt.className}`}>
                        {statusOpt.label}
                      </span>
                    </td>

                    {/* 申請者 */}
                    <td className="px-4 py-3 whitespace-nowrap">
                      <span className="text-xs text-zinc-500">
                        {rev.createdBy?.name ?? "—"}
                      </span>
                    </td>

                    {/* 申請日 */}
                    <td className="px-4 py-3 whitespace-nowrap">
                      <span className="text-xs text-zinc-500">
                        {fmtDate(rev.createdAt)}
                      </span>
                    </td>

                    {/* 操作 */}
                    <td className="px-4 py-3 whitespace-nowrap">
                      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100
                                      transition-opacity">
                        <Link
                          href={`/dashboard/tver-review/${rev.id}`}
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
                    colSpan={isAdmin ? 8 : 7}
                    className="px-4 py-16 text-center text-sm text-zinc-400"
                  >
                    業態考査の申請がまだありません
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
