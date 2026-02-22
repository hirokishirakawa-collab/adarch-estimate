"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { Pencil, Trash2, ChevronLeft, ChevronRight } from "lucide-react";
import { deleteRevenueReport } from "@/lib/actions/sales-report";

type Report = {
  id: string;
  amount: { toString(): string };
  targetMonth: Date;
  memo: string | null;
  projectName: string | null;
  createdAt: Date;
};

interface Props {
  reports: Report[];
}

const PAGE_SIZE = 20;

function fmtAmount(a: { toString(): string }): string {
  return `¥${Number(a).toLocaleString("ja-JP")}`;
}

function fmtMonth(d: Date): string {
  return new Intl.DateTimeFormat("ja-JP", { year: "numeric", month: "long" }).format(new Date(d));
}

// 今月の合計を計算
function calcThisMonthTotal(reports: Report[]): number {
  const now = new Date();
  const y = now.getFullYear();
  const m = now.getMonth();
  return reports
    .filter((r) => {
      const d = new Date(r.targetMonth);
      return d.getFullYear() === y && d.getMonth() === m;
    })
    .reduce((sum, r) => sum + Number(r.amount), 0);
}

function DeleteButton({ reportId }: { reportId: string }) {
  const [isPending, startTransition] = useTransition();

  function handleDelete() {
    if (!confirm("この売上報告を削除してもよいですか？")) return;
    startTransition(async () => {
      await deleteRevenueReport(reportId);
    });
  }

  return (
    <button
      onClick={handleDelete}
      disabled={isPending}
      className="inline-flex items-center gap-1 px-2 py-1 text-[11px] text-zinc-400
                 hover:text-red-600 hover:bg-red-50 rounded transition-colors
                 whitespace-nowrap disabled:opacity-40"
    >
      <Trash2 className="w-3 h-3" />
      削除
    </button>
  );
}

export function RevenueReportList({ reports }: Props) {
  const [page, setPage] = useState(1);
  const totalPages = Math.max(1, Math.ceil(reports.length / PAGE_SIZE));
  const slice = reports.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  const thisMonthTotal = calcThisMonthTotal(reports);
  const now = new Date();
  const thisMonthLabel = new Intl.DateTimeFormat("ja-JP", {
    year: "numeric",
    month: "long",
  }).format(now);

  return (
    <div className="space-y-5">
      {/* ── 今月の合計サマリー ── */}
      <div className="bg-gradient-to-br from-blue-50 to-indigo-50 border border-blue-100
                      rounded-xl px-6 py-5 flex items-center justify-between">
        <div>
          <p className="text-xs text-blue-500 font-semibold uppercase tracking-wider mb-1">
            {thisMonthLabel}の売上合計（税抜）
          </p>
          <p className="text-3xl font-bold text-blue-900 tracking-tight">
            ¥{thisMonthTotal.toLocaleString("ja-JP")}
          </p>
        </div>
        <div className="text-right text-xs text-blue-400">
          <p>全 {reports.length} 件</p>
          <p className="mt-0.5">今月 {reports.filter((r) => {
            const d = new Date(r.targetMonth);
            return d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth();
          }).length} 件</p>
        </div>
      </div>

      {/* ── テーブル ── */}
      <div className="bg-white rounded-xl border border-zinc-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-zinc-50 border-b border-zinc-100">
                {[
                  ["計上月",           "text-left"],
                  ["関連プロジェクト", "text-left"],
                  ["金額（税抜）",     "text-right"],
                  ["メモ",            "text-left"],
                  ["",               ""],
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
              {slice.map((report) => (
                <tr key={report.id} className="hover:bg-zinc-50/50 transition-colors group">
                  {/* 計上月 */}
                  <td className="px-4 py-3 whitespace-nowrap">
                    <span className="text-sm font-semibold text-zinc-800">
                      {fmtMonth(report.targetMonth)}
                    </span>
                  </td>

                  {/* プロジェクト */}
                  <td className="px-4 py-3 max-w-[200px]">
                    <span className="text-xs text-zinc-600 truncate block">
                      {report.projectName ?? "—"}
                    </span>
                  </td>

                  {/* 金額 */}
                  <td className="px-4 py-3 text-right whitespace-nowrap">
                    <span className="text-sm font-bold text-zinc-900">
                      {fmtAmount(report.amount)}
                    </span>
                  </td>

                  {/* メモ */}
                  <td className="px-4 py-3 max-w-[260px]">
                    <p className="text-xs text-zinc-500 line-clamp-2 leading-snug">
                      {report.memo ?? "—"}
                    </p>
                  </td>

                  {/* 操作 */}
                  <td className="px-4 py-3 whitespace-nowrap">
                    <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      <Link
                        href={`/dashboard/sales-report/${report.id}/edit`}
                        className="inline-flex items-center gap-1 px-2 py-1 text-[11px] text-zinc-400
                                   hover:text-zinc-800 hover:bg-zinc-100 rounded transition-colors"
                      >
                        <Pencil className="w-3 h-3" />
                        編集
                      </Link>
                      <DeleteButton reportId={report.id} />
                    </div>
                  </td>
                </tr>
              ))}

              {reports.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-4 py-16 text-center text-sm text-zinc-400">
                    売上報告がまだありません
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* ── ページネーション ── */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between text-xs text-zinc-500">
          <span>{reports.length} 件中 {(page - 1) * PAGE_SIZE + 1}〜{Math.min(page * PAGE_SIZE, reports.length)} 件</span>
          <div className="flex items-center gap-1">
            <button
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page === 1}
              className="p-1 rounded hover:bg-zinc-100 disabled:opacity-30"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <span className="px-2">{page} / {totalPages}</span>
            <button
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={page === totalPages}
              className="p-1 rounded hover:bg-zinc-100 disabled:opacity-30"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
