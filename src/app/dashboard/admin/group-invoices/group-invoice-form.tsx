"use client";

import { useActionState, useState } from "react";
import Link from "next/link";
import { Loader2, Plus, Trash2 } from "lucide-react";
import { invoiceTotals } from "@/lib/royalty-monthly";

type Partner = { id: string; name: string; ownerName: string; invoiceRegistered: boolean };
type ItemRow = { name: string; detail: string; quantity: number; unitPrice: number };

interface Props {
  action: (prev: { error?: string } | null, formData: FormData) => Promise<{ error?: string }>;
  partners: Partner[];
  defaults?: { type?: string; groupCompanyId?: string; targetMonth?: string; amount?: number };
}

const inputCls =
  "w-full px-3 py-2 text-sm border border-zinc-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-300 focus:border-indigo-400 bg-white text-zinc-900";

const TYPE_OPTIONS = [
  { value: "ROYALTY", label: "月額ロイヤリティ", placeholder: "月額ロイヤリティ" },
  { value: "MEMBERSHIP", label: "加盟参画費用", placeholder: "加盟参画費用" },
  { value: "OTHER", label: "その他", placeholder: "" },
];

function fmtNum(n: number): string {
  return n.toLocaleString("ja-JP");
}

export function GroupInvoiceForm({ action, partners, defaults }: Props) {
  const [state, formAction, isPending] = useActionState(action, null);

  const [type, setType] = useState(defaults?.type ?? "ROYALTY");
  const [partnerId, setPartnerId] = useState(defaults?.groupCompanyId ?? "");
  const [targetMonth, setTargetMonth] = useState(defaults?.targetMonth ?? "");
  const typeOpt = TYPE_OPTIONS.find((o) => o.value === type);
  const [rows, setRows] = useState<ItemRow[]>([
    {
      name: typeOpt?.placeholder ?? "",
      detail: "",
      quantity: 1,
      unitPrice: defaults?.amount ?? 0,
    },
  ]);

  const partner = partners.find((p) => p.id === partnerId);

  const itemsWithAmount = rows.map((r) => ({ ...r, amount: Math.round((r.quantity || 0) * (r.unitPrice || 0)) }));
  const subtotal = itemsWithAmount.reduce((s, r) => s + r.amount, 0);
  const totals = invoiceTotals(subtotal);

  const validRows = itemsWithAmount.filter((r) => r.name.trim() && r.amount > 0);
  const canSubmit = !!partnerId && validRows.length > 0;

  function updateRow(idx: number, patch: Partial<ItemRow>) {
    setRows((prev) => prev.map((r, i) => (i === idx ? { ...r, ...patch } : r)));
  }
  function addRow() { setRows((prev) => [...prev, { name: "", detail: "", quantity: 1, unitPrice: 0 }]); }
  function removeRow(idx: number) { setRows((prev) => (prev.length <= 1 ? prev : prev.filter((_, i) => i !== idx))); }

  return (
    <form action={formAction} className="space-y-5 max-w-2xl">
      {state?.error && (
        <div className="px-4 py-3 rounded-lg bg-red-50 border border-red-200 text-sm text-red-700">{state.error}</div>
      )}

      <div className="grid grid-cols-2 gap-4">
        {/* 請求先 */}
        <div>
          <label className="block text-xs font-semibold text-zinc-700 mb-1.5">請求先パートナー<span className="text-red-500 ml-0.5">*</span></label>
          <select name="groupCompanyId" value={partnerId} onChange={(e) => setPartnerId(e.target.value)} required className={inputCls}>
            <option value="">選択してください</option>
            {partners.map((p) => (
              <option key={p.id} value={p.id}>{p.name}（{p.ownerName}）</option>
            ))}
          </select>
          {partner && (
            <span className={`inline-block mt-2 px-2 py-0.5 text-[11px] font-semibold rounded-full border ${partner.invoiceRegistered ? "bg-emerald-50 text-emerald-700 border-emerald-200" : "bg-zinc-50 text-zinc-500 border-zinc-200"}`}>
              インボイス{partner.invoiceRegistered ? "登録済" : "未登録"}
            </span>
          )}
        </div>

        {/* 区分 */}
        <div>
          <label className="block text-xs font-semibold text-zinc-700 mb-1.5">区分</label>
          <select name="type" value={type} onChange={(e) => setType(e.target.value)} className={inputCls}>
            {TYPE_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        {/* 件名 */}
        <div>
          <label className="block text-xs font-semibold text-zinc-700 mb-1.5">件名<span className="text-red-500 ml-0.5">*</span></label>
          <input type="text" name="title" required maxLength={200} defaultValue={defaults?.targetMonth && type === "ROYALTY" ? `${defaults.targetMonth} ロイヤリティ` : ""} placeholder="例: 2026年5月分 ロイヤリティ" className={inputCls} />
        </div>
        {/* 対象月（ロイヤリティ用） */}
        <div>
          <label className="block text-xs font-semibold text-zinc-700 mb-1.5">対象月{type === "ROYALTY" && <span className="text-zinc-400 ml-1">(ロイヤリティ)</span>}</label>
          <input type="month" name="targetMonth" value={targetMonth} onChange={(e) => setTargetMonth(e.target.value)} className={inputCls} />
        </div>
      </div>

      {/* 支払期限 */}
      <div className="w-1/2 pr-2">
        <label className="block text-xs font-semibold text-zinc-700 mb-1.5">支払期限</label>
        <input type="date" name="dueDate" className={inputCls} />
      </div>

      {/* 明細行 */}
      <div className="border border-zinc-200 rounded-xl p-4 space-y-3 bg-zinc-50">
        <div className="flex items-center justify-between">
          <p className="text-xs font-semibold text-zinc-600 uppercase tracking-wider">明細（単価は税抜）</p>
          <button type="button" onClick={addRow} className="inline-flex items-center gap-1 px-2 py-1 text-[11px] font-semibold text-indigo-700 bg-indigo-50 border border-indigo-200 rounded-md hover:bg-indigo-100 transition-colors">
            <Plus className="w-3 h-3" />行を追加
          </button>
        </div>

        <div className="space-y-2">
          {rows.map((row, i) => (
            <div key={i} className="flex gap-2 items-start">
              <div className="flex-1 space-y-1">
                <input type="text" value={row.name} onChange={(e) => updateRow(i, { name: e.target.value })} maxLength={200} placeholder="品目（例: 月額ロイヤリティ）" className={`${inputCls} text-xs`} />
                <input type="text" value={row.detail} onChange={(e) => updateRow(i, { detail: e.target.value })} maxLength={200} placeholder="補足（任意）" className={`${inputCls} text-xs`} />
              </div>
              <div className="w-16">
                <input type="number" min={0} step={0.5} value={row.quantity} onChange={(e) => updateRow(i, { quantity: Math.max(0, parseFloat(e.target.value) || 0) })} placeholder="数量" className={`${inputCls} text-xs text-right`} />
                <p className="text-[10px] text-zinc-400 text-center mt-0.5">数量</p>
              </div>
              <div className="w-32">
                <div className="relative">
                  <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-zinc-400 text-xs">¥</span>
                  <input type="number" min={0} step={1} value={row.unitPrice === 0 ? "" : row.unitPrice} onChange={(e) => updateRow(i, { unitPrice: Math.max(0, parseInt(e.target.value, 10) || 0) })} placeholder="単価(税抜)" className={`${inputCls} pl-6 text-xs text-right`} />
                </div>
                <p className="text-[10px] text-zinc-400 text-right mt-0.5">= ¥{fmtNum(itemsWithAmount[i].amount)}</p>
              </div>
              <button type="button" onClick={() => removeRow(i)} disabled={rows.length <= 1} className="mt-1.5 text-zinc-300 hover:text-red-500 disabled:opacity-30 transition-colors" aria-label="行を削除">
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          ))}
        </div>

        {/* 合計プレビュー */}
        <div className="pt-3 border-t border-zinc-200 space-y-1">
          <div className="flex justify-between text-xs"><span className="text-zinc-600">小計（税抜）</span><span className="font-medium">¥{fmtNum(totals.subtotalExclTax)}</span></div>
          <div className="flex justify-between text-xs"><span className="text-zinc-600">消費税（10%）</span><span className="font-medium">¥{fmtNum(totals.taxAmount)}</span></div>
          <div className="flex justify-between text-base pt-1 border-t border-indigo-200"><span className="font-semibold text-zinc-700">ご請求金額（税込）</span><span className="font-bold text-indigo-700">¥{fmtNum(totals.totalInclTax)}</span></div>
        </div>

        <input type="hidden" name="items" value={JSON.stringify(validRows.map((r) => ({ name: r.name, detail: r.detail, quantity: r.quantity, unitPrice: r.unitPrice })))} />
      </div>

      {/* 備考 */}
      <div>
        <label className="block text-xs font-semibold text-zinc-700 mb-1.5">備考</label>
        <textarea name="description" rows={3} placeholder="特記事項など" className={`${inputCls} resize-y`} />
      </div>

      <div className="flex items-center gap-3 pt-2">
        <button type="submit" disabled={isPending || !canSubmit} className="inline-flex items-center gap-1.5 px-5 py-2 bg-indigo-600 text-white text-sm font-semibold rounded-lg hover:bg-indigo-700 disabled:opacity-60 transition-colors">
          {isPending && <Loader2 className="w-4 h-4 animate-spin" />}
          下書きとして作成
        </button>
        <Link href="/dashboard/admin/group-invoices" className="px-4 py-2 text-sm text-zinc-500 hover:text-zinc-800 transition-colors">キャンセル</Link>
      </div>
    </form>
  );
}
