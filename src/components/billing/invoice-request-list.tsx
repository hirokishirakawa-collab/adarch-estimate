"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { Trash2, ChevronLeft, ChevronRight, ExternalLink } from "lucide-react";
import { deleteInvoiceRequest } from "@/lib/actions/billing";
import type { UserRole } from "@/types/roles";

type InvoiceRequest = {
  id: string;
  subject: string;
  customer: { id: string; name: string } | null;
  amountExclTax: { toString(): string };
  amountInclTax: { toString(): string };
  status: "DRAFT" | "SUBMITTED";
  billingDate: Date;
  createdAt: Date;
  createdBy: { name: string | null } | null;
  project: { id: string; title: string } | null;
};

interface Props {
  requests: InvoiceRequest[];
  role: UserRole;
}

const PAGE_SIZE = 20;

const STATUS_CONFIG = {
  DRAFT:     { label: "未提出",  className: "bg-amber-50 text-amber-700 border-amber-200" },
  SUBMITTED: { label: "提出済",  className: "bg-emerald-50 text-emerald-700 border-emerald-200" },
} as const;

function fmtAmount(a: { toString(): string }): string {
  return `¥${Number(a).toLocaleString("ja-JP")}`;
}

function fmtDate(d: Date): string {
  return new Intl.DateTimeFormat("ja-JP", { year: "numeric", month: "short", day: "numeric" })
    .format(new Date(d));
}

function DeleteButton({ requestId }: { requestId: string }) {
  const [isPending, startTransition] = useTransition();
  return (
    <button
      onClick={() => {
        if (!confirm("この請求依頼を削除してもよいですか？")) return;
        startTransition(async () => { await deleteInvoiceRequest(requestId); });
      }}
      disabled={isPending}
      className="inline-flex items-center gap-1 px-2 py-1 text-[11px] text-zinc-400
                 hover:text-red-600 hover:bg-red-50 rounded transition-colors
                 whitespace-nowrap disabled:opacity-40"
    >
      <Trash2 className="w-3 h-3" />削除
    </button>
  );
}

export function InvoiceRequestList({ requests, role }: Props) {
  const [page, setPage] = useState(1);
  const totalPages = Math.max(1, Math.ceil(requests.length / PAGE_SIZE));
  const slice = requests.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  const adminCols = role === "ADMIN";

  return (
    <div className="space-y-5">
      {/* ── サマリー ── */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {[
          { label: "全件",  value: requests.length },
          { label: "未提出", value: requests.filter(r => r.status === "DRAFT").length },
          { label: "提出済", value: requests.filter(r => r.status === "SUBMITTED").length },
          {
            label: "税込合計",
            value: `¥${requests.reduce((s, r) => s + Number(r.amountInclTax), 0).toLocaleString("ja-JP")}`,
          },
        ].map(({ label, value }) => (
          <div key={label} className="bg-white border border-zinc-200 rounded-xl px-4 py-3">
            <p className="text-[11px] text-zinc-500 font-semibold uppercase tracking-wider mb-0.5">
              {label}
            </p>
            <p className="text-xl font-bold text-zinc-800">{value}</p>
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
                  ["件名",           "text-left"],
                  ["請求先",         "text-left"],
                  ["税込金額",       "text-right"],
                  ["ステータス",     "text-left"],
                  ["請求日",         "text-left"],
                  ...(adminCols ? [["申請者", "text-left"]] : []),
                  ["プロジェクト",   "text-left"],
                  ["",              ""],
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
              {slice.map((req) => {
                const statusCfg = STATUS_CONFIG[req.status];
                return (
                  <tr key={req.id} className="hover:bg-zinc-50/50 transition-colors group">
                    {/* 件名 */}
                    <td className="px-4 py-3 max-w-[220px]">
                      <Link href={`/dashboard/billing/${req.id}`}
                            className="text-sm font-semibold text-zinc-800 hover:text-violet-700
                                       hover:underline truncate block">
                        {req.subject}
                      </Link>
                    </td>

                    {/* 請求先 */}
                    <td className="px-4 py-3 max-w-[140px]">
                      <span className="text-xs text-zinc-600 truncate block">{req.customer?.name ?? "—"}</span>
                    </td>

                    {/* 税込金額 */}
                    <td className="px-4 py-3 text-right whitespace-nowrap">
                      <span className="text-sm font-bold text-zinc-900">
                        {fmtAmount(req.amountInclTax)}
                      </span>
                    </td>

                    {/* ステータス */}
                    <td className="px-4 py-3 whitespace-nowrap">
                      <span className={`inline-flex items-center px-2 py-0.5 text-[11px] font-semibold
                                        rounded-full border ${statusCfg.className}`}>
                        {statusCfg.label}
                      </span>
                    </td>

                    {/* 請求日 */}
                    <td className="px-4 py-3 whitespace-nowrap">
                      <span className="text-xs text-zinc-500">{fmtDate(req.billingDate)}</span>
                    </td>

                    {/* 申請者（ADMIN のみ） */}
                    {adminCols && (
                      <td className="px-4 py-3 whitespace-nowrap">
                        <span className="text-xs text-zinc-500">{req.createdBy?.name ?? "—"}</span>
                      </td>
                    )}

                    {/* プロジェクト */}
                    <td className="px-4 py-3 max-w-[140px]">
                      {req.project ? (
                        <Link href={`/dashboard/projects/${req.project.id}`}
                              className="text-xs text-violet-600 hover:underline truncate block">
                          {req.project.title}
                        </Link>
                      ) : (
                        <span className="text-xs text-zinc-400">—</span>
                      )}
                    </td>

                    {/* 操作 */}
                    <td className="px-4 py-3 whitespace-nowrap">
                      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        <Link href={`/dashboard/billing/${req.id}`}
                              className="inline-flex items-center gap-1 px-2 py-1 text-[11px]
                                         text-zinc-400 hover:text-zinc-800 hover:bg-zinc-100
                                         rounded transition-colors">
                          <ExternalLink className="w-3 h-3" />詳細
                        </Link>
                        <DeleteButton requestId={req.id} />
                      </div>
                    </td>
                  </tr>
                );
              })}

              {requests.length === 0 && (
                <tr>
                  <td colSpan={adminCols ? 8 : 7}
                      className="px-4 py-16 text-center text-sm text-zinc-400">
                    請求依頼がまだありません
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* ページネーション */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between text-xs text-zinc-500">
          <span>
            {requests.length} 件中 {(page - 1) * PAGE_SIZE + 1}〜
            {Math.min(page * PAGE_SIZE, requests.length)} 件
          </span>
          <div className="flex items-center gap-1">
            <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1}
                    className="p-1 rounded hover:bg-zinc-100 disabled:opacity-30">
              <ChevronLeft className="w-4 h-4" />
            </button>
            <span className="px-2">{page} / {totalPages}</span>
            <button onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page === totalPages}
                    className="p-1 rounded hover:bg-zinc-100 disabled:opacity-30">
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
