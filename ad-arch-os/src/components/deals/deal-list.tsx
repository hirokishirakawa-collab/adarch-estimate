"use client";

import { useState, useRef } from "react";
import Link from "next/link";
import { updateDealNotes } from "@/lib/actions/deal";
import { DEAL_STATUS_OPTIONS } from "@/lib/constants/deals";
import { Pencil, Check, Loader2 } from "lucide-react";
import type { DealStatus } from "@/generated/prisma/client";

type Deal = {
  id: string;
  title: string;
  status: DealStatus;
  amount: { toString(): string } | null;
  probability: number | null;
  expectedCloseDate: Date | null;
  notes: string | null;
  updatedAt: Date;
  customer: { id: string; name: string; prefecture: string | null };
  assignedTo: { name: string | null } | null;
};

// ── インラインメモ編集セル ──────────────────────────────────────
function NoteCell({ dealId, initialNotes }: { dealId: string; initialNotes: string | null }) {
  const [value, setValue] = useState(initialNotes ?? "");
  const [status, setStatus] = useState<"idle" | "saving" | "saved">("idle");
  const savedRef = useRef(initialNotes ?? ""); // 最後に保存された値

  async function handleBlur() {
    if (value === savedRef.current) return; // 変更なし
    setStatus("saving");
    await updateDealNotes(dealId, value);
    savedRef.current = value;
    setStatus("saved");
    setTimeout(() => setStatus("idle"), 2000);
  }

  return (
    <div className="relative">
      <textarea
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onBlur={handleBlur}
        rows={3}
        placeholder="備考・メモを入力…"
        className="w-full text-xs text-zinc-700 placeholder:text-zinc-300 resize-y
                   bg-transparent border border-transparent rounded px-1.5 py-1
                   hover:border-zinc-200 focus:border-blue-300 focus:ring-1 focus:ring-blue-200
                   outline-none transition-colors min-w-[180px]"
      />
      {status === "saving" && (
        <span className="absolute bottom-1.5 right-1.5 flex items-center gap-0.5 text-[9px] text-zinc-400">
          <Loader2 className="w-2.5 h-2.5 animate-spin" /> 保存中
        </span>
      )}
      {status === "saved" && (
        <span className="absolute bottom-1.5 right-1.5 flex items-center gap-0.5 text-[9px] text-emerald-500">
          <Check className="w-2.5 h-2.5" /> 保存
        </span>
      )}
    </div>
  );
}

// ── メインリストコンポーネント ───────────────────────────────────
export function DealList({ deals }: { deals: Deal[] }) {
  const [statusFilter, setStatusFilter] = useState<DealStatus | "ALL">("ALL");

  const filtered =
    statusFilter === "ALL" ? deals : deals.filter((d) => d.status === statusFilter);

  const fmtDate = (d: Date | null | undefined) =>
    d
      ? new Intl.DateTimeFormat("ja-JP", { month: "numeric", day: "numeric" }).format(
          new Date(d)
        )
      : "—";

  const fmtAmount = (a: { toString(): string } | null) =>
    a ? `¥${Number(a).toLocaleString()}` : "—";

  return (
    <div>
      {/* ── ステータスフィルタ ── */}
      <div className="flex items-center gap-1.5 mb-4 flex-wrap">
        <button
          onClick={() => setStatusFilter("ALL")}
          className={`px-2.5 py-1 rounded-full text-xs font-medium transition-colors
            ${statusFilter === "ALL"
              ? "bg-zinc-800 text-white"
              : "bg-zinc-100 text-zinc-600 hover:bg-zinc-200"
            }`}
        >
          すべて ({deals.length})
        </button>
        {DEAL_STATUS_OPTIONS.map((opt) => {
          const count = deals.filter((d) => d.status === opt.value).length;
          if (count === 0) return null;
          return (
            <button
              key={opt.value}
              onClick={() => setStatusFilter(opt.value as DealStatus)}
              className={`px-2.5 py-1 rounded-full text-xs font-medium transition-colors border
                ${
                  statusFilter === opt.value
                    ? opt.color + " font-semibold"
                    : "bg-white text-zinc-500 border-zinc-200 hover:bg-zinc-50"
                }`}
            >
              {opt.label} ({count})
            </button>
          );
        })}
      </div>

      {/* ── テーブル ── */}
      <div className="bg-white rounded-xl border border-zinc-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-zinc-50 border-b border-zinc-100">
                {[
                  ["会社名", "text-left"],
                  ["商談タイトル", "text-left"],
                  ["ステータス", "text-left"],
                  ["金額", "text-right"],
                  ["確度", "text-right"],
                  ["予定日", "text-left"],
                  ["担当", "text-left"],
                  ["備考・メモ (フォーカスして編集)", "text-left w-72"],
                  ["", ""],
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
              {filtered.map((deal) => {
                const statusOpt = DEAL_STATUS_OPTIONS.find((o) => o.value === deal.status);
                return (
                  <tr key={deal.id} className="hover:bg-zinc-50/50 transition-colors group">
                    {/* 会社名 */}
                    <td className="px-4 py-3 align-top">
                      <Link
                        href={`/dashboard/deals/${deal.id}`}
                        className="font-semibold text-zinc-900 hover:text-blue-600 transition-colors text-sm leading-snug"
                      >
                        {deal.customer.name}
                      </Link>
                      {deal.customer.prefecture && (
                        <p className="text-[10px] text-zinc-400 mt-0.5">
                          📍 {deal.customer.prefecture}
                        </p>
                      )}
                    </td>

                    {/* 商談タイトル */}
                    <td className="px-4 py-3 align-top max-w-[220px]">
                      <p className="text-xs text-zinc-600 line-clamp-2 leading-snug">
                        {deal.title || "—"}
                      </p>
                    </td>

                    {/* ステータス */}
                    <td className="px-4 py-3 align-top whitespace-nowrap">
                      {statusOpt && (
                        <span
                          className={`inline-flex px-2 py-0.5 rounded-full text-[10px] font-semibold border ${statusOpt.color}`}
                        >
                          {statusOpt.label}
                        </span>
                      )}
                    </td>

                    {/* 金額 */}
                    <td className="px-4 py-3 align-top text-right whitespace-nowrap">
                      <span className="text-xs font-semibold text-zinc-700">
                        {fmtAmount(deal.amount)}
                      </span>
                    </td>

                    {/* 確度 */}
                    <td className="px-4 py-3 align-top text-right whitespace-nowrap">
                      <span className="text-xs text-zinc-600">
                        {deal.probability !== null ? `${deal.probability}%` : "—"}
                      </span>
                    </td>

                    {/* 予定日 */}
                    <td className="px-4 py-3 align-top whitespace-nowrap">
                      <span className="text-xs text-zinc-600">
                        {fmtDate(deal.expectedCloseDate)}
                      </span>
                    </td>

                    {/* 担当者 */}
                    <td className="px-4 py-3 align-top whitespace-nowrap">
                      <span className="text-xs text-zinc-600">
                        {deal.assignedTo?.name ?? "—"}
                      </span>
                    </td>

                    {/* 備考 (インライン編集) */}
                    <td className="px-4 py-3 align-top w-72">
                      <NoteCell dealId={deal.id} initialNotes={deal.notes} />
                    </td>

                    {/* 編集ボタン */}
                    <td className="px-4 py-3 align-top">
                      <Link
                        href={`/dashboard/deals/${deal.id}/edit`}
                        className="inline-flex items-center gap-1 px-2 py-1 text-[11px] text-zinc-400
                                   hover:text-zinc-800 hover:bg-zinc-100 rounded transition-colors
                                   whitespace-nowrap opacity-0 group-hover:opacity-100"
                      >
                        <Pencil className="w-3 h-3" />
                        編集
                      </Link>
                    </td>
                  </tr>
                );
              })}

              {filtered.length === 0 && (
                <tr>
                  <td colSpan={9} className="px-4 py-16 text-center text-sm text-zinc-400">
                    該当する商談がありません
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      <p className="mt-2 text-[11px] text-zinc-400 text-right">{filtered.length} 件表示</p>
    </div>
  );
}
