"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Loader2, X } from "lucide-react";
import {
  clearRoyaltyPaymentCheck,
  setRoyaltyPaymentCheck,
  type RoyaltyCheckCell,
  type RoyaltyCheckRow,
  type RoyaltyYearCheck,
} from "@/lib/actions/royalty-check";
import type { RoyaltyPaymentMethod } from "@/generated/prisma/client";

const METHOD_LABEL: Record<RoyaltyPaymentMethod, string> = {
  BANK_TRANSFER: "振込（三菱UFJ）",
  GMO: "振込（GMOあおぞら）",
  SQUARE: "Square（カード）",
  OFFSET: "相殺（支払明細で控除）",
  OTHER: "その他",
};
const METHOD_SHORT: Record<RoyaltyPaymentMethod, string> = {
  BANK_TRANSFER: "振込",
  GMO: "GMO",
  SQUARE: "Square",
  OFFSET: "相殺",
  OTHER: "他",
};

const CELL_STYLE: Record<RoyaltyCheckCell["status"], { mark: string; cls: string; title: string }> = {
  PAID: { mark: "✅", cls: "bg-emerald-50 hover:bg-emerald-100 border-emerald-200", title: "入金済" },
  OFFSET: { mark: "🔷", cls: "bg-sky-50 hover:bg-sky-100 border-sky-200", title: "相殺済（案件10%で最低保証クリア・支払不要）" },
  EXEMPT: { mark: "➖", cls: "bg-zinc-50 hover:bg-zinc-100 border-zinc-200 text-zinc-400", title: "免除" },
  OVERDUE: { mark: "🔴", cls: "bg-red-50 hover:bg-red-100 border-red-300", title: "未入金（期限超過）" },
  PENDING: { mark: "⬜", cls: "bg-white hover:bg-zinc-50 border-zinc-200", title: "未確認（期限前）" },
  FUTURE: { mark: "", cls: "bg-zinc-50/40 border-zinc-100 text-zinc-300", title: "未到来" },
};

function fmtMd(iso: string): string {
  const [, m, d] = iso.split("-");
  return `${parseInt(m, 10)}/${parseInt(d, 10)}`;
}
function todayIso(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

type Target = { row: RoyaltyCheckRow; cell: RoyaltyCheckCell };

export function RoyaltyCheckGrid({ data }: { data: RoyaltyYearCheck }) {
  const [target, setTarget] = useState<Target | null>(null);

  return (
    <>
      <div className="bg-white border border-zinc-200 rounded-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm border-collapse">
            <thead>
              <tr className="bg-zinc-50 border-b border-zinc-200">
                <th className="sticky left-0 z-10 bg-zinc-50 px-4 py-3 text-left text-xs font-semibold text-zinc-600 min-w-[180px]">パートナー</th>
                {data.months.map((m) => (
                  <th key={m.month} className="px-1 py-2 text-center text-xs font-semibold text-zinc-600 min-w-[60px]">
                    <div>{parseInt(m.month.split("-")[1], 10)}月</div>
                    <div className="text-[9px] font-normal text-zinc-400">期限{fmtMd(m.dueDate)}</div>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100">
              {data.rows.map((row) => (
                <tr key={row.groupCompanyId} className="hover:bg-zinc-50/50">
                  <td className="sticky left-0 z-10 bg-white px-4 py-2">
                    <p className="text-sm text-zinc-800 leading-tight">{row.name}</p>
                    {row.isExemptPermanent && <p className="text-[10px] text-zinc-400">恒久免除</p>}
                  </td>
                  {row.cells.map((cell) => {
                    const st = CELL_STYLE[cell.status];
                    const clickable = cell.status !== "FUTURE" && !(cell.status === "EXEMPT" && row.isExemptPermanent);
                    const tip =
                      cell.status === "PAID" && cell.check
                        ? `入金済 ${fmtMd(cell.check.paidOn)} ${METHOD_SHORT[cell.check.method]}${cell.check.amountInclTax != null ? ` ¥${cell.check.amountInclTax.toLocaleString("ja-JP")}` : ""}${cell.check.note ? `\n${cell.check.note}` : ""}`
                        : cell.status === "OVERDUE" || cell.status === "PENDING"
                          ? `${st.title}\n請求見込 ¥${cell.expectedInclTax.toLocaleString("ja-JP")}（税込）\n月次報告 売上 ¥${cell.revenueExclTax.toLocaleString("ja-JP")} → ロイヤリティ ¥${cell.royaltyExclTax.toLocaleString("ja-JP")}\n相殺（案件手数料）¥${cell.commissionExclTax.toLocaleString("ja-JP")}`
                          : cell.status === "OFFSET"
                            ? `${st.title}\n月次報告 売上 ¥${cell.revenueExclTax.toLocaleString("ja-JP")} → ロイヤリティ ¥${cell.royaltyExclTax.toLocaleString("ja-JP")}\n相殺（案件手数料）¥${cell.commissionExclTax.toLocaleString("ja-JP")}`
                            : st.title;
                    return (
                      <td key={cell.month} className="px-1 py-1 text-center">
                        <button
                          type="button"
                          disabled={!clickable}
                          onClick={() => setTarget({ row, cell })}
                          title={tip}
                          className={`w-full h-10 rounded-md border text-base leading-none transition-colors disabled:cursor-default ${st.cls}`}
                        >
                          <span>{st.mark}</span>
                          {cell.status === "PAID" && cell.check && (
                            <span className="block text-[9px] text-emerald-700 mt-0.5">{fmtMd(cell.check.paidOn)} {METHOD_SHORT[cell.check.method]}</span>
                          )}
                          {(cell.status === "OVERDUE" || cell.status === "PENDING") && cell.expectedInclTax > 0 && (
                            <span className={`block text-[9px] mt-0.5 ${cell.status === "OVERDUE" ? "text-red-600" : "text-zinc-400"}`}>¥{Math.round(cell.expectedInclTax / 1000)}k</span>
                          )}
                        </button>
                      </td>
                    );
                  })}
                </tr>
              ))}
              {data.rows.length === 0 && (
                <tr><td colSpan={13} className="px-4 py-12 text-center text-sm text-zinc-400">対象パートナーがいません</td></tr>
              )}
            </tbody>
          </table>
        </div>
        <div className="px-4 py-2 border-t border-zinc-100 flex flex-wrap gap-x-4 gap-y-1 text-[10px] text-zinc-500">
          <span>✅ 入金済（手で記録）</span>
          <span>🔷 相殺済＝本部控除済みの案件手数料がロイヤリティ以上・支払不要（自動）</span>
          <span>➖ 免除（自動）</span>
          <span>🔴 期限超過・未入金（自動）</span>
          <span>⬜ 期限前・未確認</span>
          <span className="text-zinc-400">※ セルをクリックで入金を記録／取り消し。相殺月に入金があった場合も記録できます</span>
        </div>
      </div>

      {target && <CheckDialog target={target} onClose={() => setTarget(null)} />}
    </>
  );
}

function CheckDialog({ target, onClose }: { target: Target; onClose: () => void }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const { row, cell } = target;
  const existing = cell.check;

  const [paidOn, setPaidOn] = useState(existing?.paidOn ?? todayIso());
  const [method, setMethod] = useState<RoyaltyPaymentMethod>(existing?.method ?? "BANK_TRANSFER");
  const [amount, setAmount] = useState<string>(
    existing?.amountInclTax != null ? String(existing.amountInclTax) : cell.expectedInclTax > 0 ? String(cell.expectedInclTax) : "",
  );
  const [note, setNote] = useState(existing?.note ?? "");

  useEffect(() => {
    function onKey(e: KeyboardEvent) { if (e.key === "Escape") onClose(); }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  function save() {
    startTransition(async () => {
      const raw = amount.trim().replace(/,/g, "");
      const res = await setRoyaltyPaymentCheck({
        groupCompanyId: row.groupCompanyId,
        month: cell.month,
        paidOn,
        method,
        amountInclTax: raw === "" ? null : parseInt(raw, 10),
        note: note.trim() || null,
      });
      if (res.error) { alert(res.error); return; }
      onClose();
      router.refresh();
    });
  }
  function clear() {
    if (!confirm("この月の入金記録を取り消します。よろしいですか？")) return;
    startTransition(async () => {
      const res = await clearRoyaltyPaymentCheck(row.groupCompanyId, cell.month);
      if (res.error) { alert(res.error); return; }
      onClose();
      router.refresh();
    });
  }

  const [y, m] = cell.month.split("-");
  const st = CELL_STYLE[cell.status];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4" onClick={onClose}>
      <div className="w-full max-w-md bg-white rounded-2xl shadow-xl border border-zinc-200" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-start justify-between px-5 pt-5 pb-3 border-b border-zinc-100">
          <div>
            <p className="text-sm font-bold text-zinc-900">{row.name}</p>
            <p className="text-xs text-zinc-500 mt-0.5">{y}年{parseInt(m, 10)}月分 ロイヤリティ（期限 {fmtMd(cell.dueDate)}）</p>
            <p className="text-[11px] text-zinc-500 mt-1">
              現在: {st.mark} {st.title}
              {cell.status !== "PAID" && cell.expectedInclTax > 0 && <>　請求見込 ¥{cell.expectedInclTax.toLocaleString("ja-JP")}（税込）</>}
            </p>
            <p className="text-[11px] text-zinc-400 mt-0.5">
              月次報告 売上 ¥{cell.revenueExclTax.toLocaleString("ja-JP")} → ロイヤリティ ¥{cell.royaltyExclTax.toLocaleString("ja-JP")}／相殺 ¥{cell.commissionExclTax.toLocaleString("ja-JP")}（税抜）
            </p>
          </div>
          <button onClick={onClose} className="p-1 rounded-lg text-zinc-400 hover:bg-zinc-100 hover:text-zinc-600"><X className="w-4 h-4" /></button>
        </div>

        <div className="px-5 py-4 space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <label className="block">
              <span className="text-[11px] font-semibold text-zinc-600">入金日</span>
              <input type="date" value={paidOn} onChange={(e) => setPaidOn(e.target.value)} className="mt-1 w-full px-2.5 py-1.5 text-sm border border-zinc-200 rounded-lg bg-white" />
            </label>
            <label className="block">
              <span className="text-[11px] font-semibold text-zinc-600">方法</span>
              <select value={method} onChange={(e) => setMethod(e.target.value as RoyaltyPaymentMethod)} className="mt-1 w-full px-2.5 py-1.5 text-sm border border-zinc-200 rounded-lg bg-white">
                {(Object.keys(METHOD_LABEL) as RoyaltyPaymentMethod[]).map((k) => (
                  <option key={k} value={k}>{METHOD_LABEL[k]}</option>
                ))}
              </select>
            </label>
          </div>
          <label className="block">
            <span className="text-[11px] font-semibold text-zinc-600">入金額（税込・空欄可）</span>
            <div className="mt-1 flex items-center gap-1">
              <span className="text-sm text-zinc-400">¥</span>
              <input type="number" min={0} value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="例: 55000" className="w-full px-2.5 py-1.5 text-sm border border-zinc-200 rounded-lg bg-white text-right" />
            </div>
          </label>
          <label className="block">
            <span className="text-[11px] font-semibold text-zinc-600">メモ（明細の摘要・カード末尾4桁など）</span>
            <textarea value={note} onChange={(e) => setNote(e.target.value)} rows={2} className="mt-1 w-full px-2.5 py-1.5 text-sm border border-zinc-200 rounded-lg bg-white" />
          </label>
        </div>

        <div className="flex items-center justify-between px-5 pb-5">
          {existing ? (
            <button onClick={clear} disabled={isPending} className="text-xs text-red-600 hover:text-red-700 disabled:opacity-60">入金記録を取り消す</button>
          ) : <span />}
          <div className="flex items-center gap-2">
            <button onClick={onClose} disabled={isPending} className="px-3 py-1.5 text-xs font-medium text-zinc-600 rounded-lg hover:bg-zinc-100">閉じる</button>
            <button onClick={save} disabled={isPending} className="inline-flex items-center gap-1.5 px-4 py-1.5 text-xs font-semibold text-white bg-emerald-600 rounded-lg hover:bg-emerald-700 disabled:opacity-60">
              {isPending && <Loader2 className="w-3 h-3 animate-spin" />}
              {existing ? "更新する" : "✅ 入金済にする"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
