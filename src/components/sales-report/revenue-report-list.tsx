"use client";

import { Fragment, useState, useTransition } from "react";
import Link from "next/link";
import { ChevronDown, Pencil, Trash2, ChevronLeft, ChevronRight, Download } from "lucide-react";
import { deleteRevenueReport } from "@/lib/actions/sales-report";
import { BILLED_BY_LABEL, type BilledBy } from "@/lib/constants/sales-report";

type Item = {
  id: string;
  billedBy: BilledBy;
  clientName: string;
  projectName: string;
  amountExclTax: { toString(): string };
  amountInclTax: { toString(): string };
  memo: string | null;
};

type Report = {
  id: string;
  amount: { toString(): string };
  selfAmount: { toString(): string };
  hqAmount: { toString(): string };
  targetMonth: Date;
  memo: string | null;
  projectName: string | null;
  createdAt: Date;
  items: Item[];
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

/** 請求元の区分がついていない旧データぶん（amount − self − hq） */
function unclassified(r: Report): number {
  return Math.max(0, Number(r.amount) - Number(r.selfAmount) - Number(r.hqAmount));
}

function isThisMonth(d: Date, now: Date): boolean {
  const t = new Date(d);
  return t.getFullYear() === now.getFullYear() && t.getMonth() === now.getMonth();
}

function billedBadge(billedBy: BilledBy) {
  const cls =
    billedBy === "HQ"
      ? "bg-violet-50 text-violet-700 border-violet-200"
      : "bg-blue-50 text-blue-700 border-blue-200";
  return (
    <span className={`inline-block px-2 py-0.5 text-[10px] font-medium border rounded-full whitespace-nowrap ${cls}`}>
      {BILLED_BY_LABEL[billedBy]}
    </span>
  );
}

/** 明細1行 = CSV 1行で書き出す（本部の経理側で扱いやすい形） */
function exportCsv(reports: Report[]) {
  const header = [
    "計上月", "請求元", "クライアント名", "案件名",
    "金額（税抜）", "金額（税込）", "備考", "登録日",
  ];
  const rows: string[][] = [];
  for (const r of reports) {
    const month = fmtMonth(r.targetMonth);
    const created = new Intl.DateTimeFormat("ja-JP", { year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date(r.createdAt));
    if (r.items.length === 0) {
      // 明細なし（0円報告 / 旧データ）は1行だけ出す
      rows.push([month, "", "", r.projectName ?? "", String(Number(r.amount)), "", (r.memo ?? "").replace(/"/g, '""'), created]);
      continue;
    }
    for (const it of r.items) {
      rows.push([
        month,
        BILLED_BY_LABEL[it.billedBy],
        it.clientName,
        it.projectName,
        String(Number(it.amountExclTax)),
        String(Number(it.amountInclTax)),
        (it.memo ?? "").replace(/"/g, '""'),
        created,
      ]);
    }
  }
  const csv = [header, ...rows]
    .map((row) => row.map((v) => `"${v}"`).join(","))
    .join("\r\n");
  const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `月次報告_${new Date().toISOString().slice(0, 10)}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

function DeleteButton({ reportId }: { reportId: string }) {
  const [isPending, startTransition] = useTransition();

  function handleDelete() {
    if (!confirm("この月次報告を削除してもよいですか？")) return;
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
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const totalPages = Math.max(1, Math.ceil(reports.length / PAGE_SIZE));
  const slice = reports.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  const now = new Date();
  const thisMonthReports = reports.filter((r) => isThisMonth(r.targetMonth, now));
  const thisMonthTotal = thisMonthReports.reduce((sum, r) => sum + Number(r.amount), 0);
  const thisMonthSelf  = thisMonthReports.reduce((sum, r) => sum + Number(r.selfAmount), 0);
  const thisMonthHq    = thisMonthReports.reduce((sum, r) => sum + Number(r.hqAmount), 0);
  const thisMonthOther = thisMonthReports.reduce((sum, r) => sum + unclassified(r), 0);

  const thisMonthLabel = new Intl.DateTimeFormat("ja-JP", {
    year: "numeric",
    month: "long",
  }).format(now);

  return (
    <div className="space-y-5">
      {/* ── 今月の合計サマリー ── */}
      <div className="bg-gradient-to-br from-blue-50 to-indigo-50 border border-blue-100
                      rounded-xl px-6 py-5 space-y-4">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <p className="text-xs text-blue-500 font-semibold uppercase tracking-wider mb-1">
              {thisMonthLabel}の売上合計（税抜）
            </p>
            <p className="text-3xl font-bold text-blue-900 tracking-tight">
              ¥{thisMonthTotal.toLocaleString("ja-JP")}
            </p>
          </div>
          <div className="flex flex-col items-end gap-2">
            <div className="text-right text-xs text-blue-400">
              <p>全 {reports.length} 件</p>
              <p className="mt-0.5">今月 {thisMonthReports.length} 件</p>
            </div>
            {reports.length > 0 && (
              <button
                onClick={() => exportCsv(reports)}
                className="inline-flex items-center gap-1.5 px-2.5 py-1 text-[11px] font-medium
                           bg-white/80 border border-blue-200 text-blue-700 rounded-lg
                           hover:bg-white transition-colors"
              >
                <Download className="w-3 h-3" />
                明細CSV書き出し
              </button>
            )}
          </div>
        </div>

        {/* 請求元別の内訳 */}
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          <div className="bg-white/70 border border-blue-100 rounded-lg px-4 py-3">
            <p className="text-[11px] font-semibold text-blue-600 mb-0.5">自分で請求</p>
            <p className="text-lg font-bold text-blue-900 tabular-nums">
              ¥{thisMonthSelf.toLocaleString("ja-JP")}
            </p>
          </div>
          <div className="bg-white/70 border border-violet-100 rounded-lg px-4 py-3">
            <p className="text-[11px] font-semibold text-violet-600 mb-0.5">本部から請求</p>
            <p className="text-lg font-bold text-violet-900 tabular-nums">
              ¥{thisMonthHq.toLocaleString("ja-JP")}
            </p>
          </div>
          {thisMonthOther > 0 && (
            <div className="bg-white/70 border border-zinc-200 rounded-lg px-4 py-3">
              <p className="text-[11px] font-semibold text-zinc-500 mb-0.5">区分なし（旧データ）</p>
              <p className="text-lg font-bold text-zinc-700 tabular-nums">
                ¥{thisMonthOther.toLocaleString("ja-JP")}
              </p>
            </div>
          )}
        </div>
      </div>

      {/* ── テーブル ── */}
      <div className="bg-white rounded-xl border border-zinc-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-zinc-50 border-b border-zinc-100">
                {[
                  ["計上月",       "text-left"],
                  ["案件",         "text-left"],
                  ["自分で請求",   "text-right"],
                  ["本部から請求", "text-right"],
                  ["合計（税抜）", "text-right"],
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
              {slice.map((report) => {
                const isExpanded = expandedId === report.id;
                const other = unclassified(report);
                return (
                  <Fragment key={report.id}>
                    <tr
                      className="hover:bg-zinc-50/50 transition-colors group cursor-pointer"
                      onClick={() => setExpandedId(isExpanded ? null : report.id)}
                    >
                      {/* 計上月 */}
                      <td className="px-4 py-3 whitespace-nowrap">
                        <span className="text-sm font-semibold text-zinc-800 inline-flex items-center gap-1">
                          <ChevronDown className={`w-3 h-3 text-zinc-400 transition-transform ${isExpanded ? "rotate-180" : ""}`} />
                          {fmtMonth(report.targetMonth)}
                        </span>
                      </td>

                      {/* 案件 */}
                      <td className="px-4 py-3 max-w-[220px]">
                        <span className="text-xs text-zinc-600 truncate block">
                          {report.projectName ?? "—"}
                        </span>
                        {report.items.length > 0 && (
                          <span className="text-[10px] text-zinc-400">{report.items.length}件の明細</span>
                        )}
                      </td>

                      {/* 自分で請求 */}
                      <td className="px-4 py-3 text-right whitespace-nowrap">
                        <span className="text-xs font-semibold text-blue-700 tabular-nums">
                          {fmtAmount(report.selfAmount)}
                        </span>
                      </td>

                      {/* 本部から請求 */}
                      <td className="px-4 py-3 text-right whitespace-nowrap">
                        <span className="text-xs font-semibold text-violet-700 tabular-nums">
                          {fmtAmount(report.hqAmount)}
                        </span>
                      </td>

                      {/* 合計 */}
                      <td className="px-4 py-3 text-right whitespace-nowrap">
                        <span className="text-sm font-bold text-zinc-900 tabular-nums">
                          {fmtAmount(report.amount)}
                        </span>
                        {other > 0 && (
                          <p className="text-[10px] text-zinc-400">区分なし {fmtAmount(other)}</p>
                        )}
                      </td>

                      {/* 操作 */}
                      <td className="px-4 py-3 whitespace-nowrap" onClick={(e) => e.stopPropagation()}>
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

                    {/* 明細の展開 */}
                    {isExpanded && (
                      <tr>
                        <td colSpan={6} className="bg-zinc-50/80 px-6 py-4 border-b border-zinc-100">
                          {report.items.length === 0 ? (
                            <p className="text-xs text-zinc-400">明細はありません（0円報告、または明細機能の導入前に登録された報告です）</p>
                          ) : (
                            <table className="w-full text-xs">
                              <thead>
                                <tr className="text-[10px] text-zinc-400 uppercase tracking-wider">
                                  <th className="text-left pb-2 font-semibold">請求元</th>
                                  <th className="text-left pb-2 font-semibold">クライアント名</th>
                                  <th className="text-left pb-2 font-semibold">案件名</th>
                                  <th className="text-right pb-2 font-semibold">税抜</th>
                                  <th className="text-right pb-2 font-semibold">税込</th>
                                  <th className="text-left pb-2 pl-4 font-semibold">備考</th>
                                </tr>
                              </thead>
                              <tbody className="divide-y divide-zinc-200/60">
                                {report.items.map((it) => (
                                  <tr key={it.id}>
                                    <td className="py-2 pr-3 whitespace-nowrap">{billedBadge(it.billedBy)}</td>
                                    <td className="py-2 pr-3 text-zinc-800">{it.clientName}</td>
                                    <td className="py-2 pr-3 text-zinc-700">{it.projectName}</td>
                                    <td className="py-2 text-right font-semibold text-zinc-900 tabular-nums whitespace-nowrap">
                                      {fmtAmount(it.amountExclTax)}
                                    </td>
                                    <td className="py-2 text-right text-zinc-500 tabular-nums whitespace-nowrap">
                                      {fmtAmount(it.amountInclTax)}
                                    </td>
                                    <td className="py-2 pl-4 text-zinc-500">{it.memo ?? "—"}</td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          )}
                          {report.memo && (
                            <div className="mt-3 pt-3 border-t border-zinc-200/60">
                              <span className="text-[10px] font-semibold text-zinc-400 uppercase tracking-wider">補足コメント</span>
                              <p className="mt-1 text-xs text-zinc-700 whitespace-pre-wrap leading-relaxed">{report.memo}</p>
                            </div>
                          )}
                        </td>
                      </tr>
                    )}
                  </Fragment>
                );
              })}

              {reports.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-4 py-16 text-center text-sm text-zinc-400">
                    月次報告がまだありません
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
