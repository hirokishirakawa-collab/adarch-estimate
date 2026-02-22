"use client";

import { useActionState, useState, useCallback } from "react";
import Link from "next/link";
import { Loader2, Save, Send, Plus, Eye, EyeOff, Scissors } from "lucide-react";
import { createEstimation } from "@/lib/actions/estimate";
import { ESTIMATION_STATUS_OPTIONS } from "@/lib/constants/estimates";
import { EstimationItemRow, type TemplateOption, type ItemState } from "./estimate-item-row";
import { cn } from "@/lib/utils";

type Customer = { id: string; name: string };
type Project  = { id: string; title: string };

interface Props {
  staffName: string;
  templates: TemplateOption[];
  customers: Customer[];
  projects: Project[];
}

let _uid = 0;
function uid() { return `item_${++_uid}_${Date.now()}`; }

function emptyItem(): ItemState {
  return { _key: uid(), name: "", spec: "", quantity: 1, unit: "日", unitPrice: 0, costPrice: null, templateId: null };
}

const DISCOUNT_REASONS = [
  { value: "BUDGET_FIRST", label: "予算先行型（顧客予算が先に決定）" },
  { value: "EXISTING",     label: "既存優待（既存顧客・累積利益あり）" },
  { value: "INVESTMENT",   label: "先行投資（初受注・リピート期待）" },
  { value: "OTHER",        label: "その他（自由記述）" },
];

const inputCls =
  "w-full px-3 py-2 text-sm bg-white border border-zinc-200 rounded-lg " +
  "focus:outline-none focus:ring-2 focus:ring-blue-400 focus:border-transparent " +
  "placeholder:text-zinc-400 transition-colors";

export function EstimateForm({ staffName, templates, customers, projects }: Props) {
  const [state, formAction, isPending] = useActionState(createEstimation, null);
  const [items, setItems] = useState<ItemState[]>([emptyItem()]);
  const [showCost, setShowCost] = useState(false);
  const [showDiscount, setShowDiscount] = useState(false);
  const [discountAmount, setDiscountAmount] = useState(0);
  const [discountReason, setDiscountReason] = useState("");
  const [discountReasonNote, setDiscountReasonNote] = useState("");
  const [pendingIntent, setPendingIntent] = useState<"draft" | "issue" | null>(null);

  const updateItem = useCallback((idx: number, updated: ItemState) => {
    setItems((prev) => prev.map((it, i) => (i === idx ? updated : it)));
  }, []);

  const removeItem = useCallback((idx: number) => {
    setItems((prev) => prev.filter((_, i) => i !== idx));
  }, []);

  const addItem = () => setItems((prev) => [...prev, emptyItem()]);

  // 合計計算
  const subtotal       = items.reduce((s, it) => s + Math.round(it.quantity * it.unitPrice), 0);
  const discountAmt    = showDiscount && discountAmount > 0 ? discountAmount : 0;
  const afterDiscount  = Math.max(0, subtotal - discountAmt);
  const tax            = Math.round(afterDiscount * 0.1);
  const total          = afterDiscount + tax;
  const costTotal      = items.reduce((s, it) => {
    if (it.costPrice === null) return s;
    return s + Math.round(it.quantity * it.costPrice);
  }, 0);
  const hasCost        = items.some((it) => it.costPrice !== null);
  const grossProfit    = afterDiscount - costTotal;
  const profitRate     = afterDiscount > 0 ? (grossProfit / afterDiscount) * 100 : 0;

  const serializedItems = JSON.stringify(
    items.map((it) => ({
      name: it.name,
      spec: it.spec,
      quantity: it.quantity,
      unit: it.unit,
      unitPrice: it.unitPrice,
      amount: Math.round(it.quantity * it.unitPrice),
      costPrice: it.costPrice,
      templateId: it.templateId,
    }))
  );

  return (
    <form action={formAction} className="space-y-6">
      <input type="hidden" name="items" value={serializedItems} />
      <input type="hidden" name="discountAmount" value={showDiscount ? discountAmount : 0} />
      <input type="hidden" name="discountReason" value={showDiscount ? discountReason : ""} />
      <input type="hidden" name="discountReasonNote" value={showDiscount ? discountReasonNote : ""} />

      {/* ── 基本情報 ── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {/* 見積タイトル */}
        <div className="sm:col-span-2">
          <label className="block text-xs font-semibold text-zinc-600 mb-1.5">
            見積タイトル <span className="text-red-500">*</span>
          </label>
          <input
            name="title"
            type="text"
            required
            maxLength={100}
            placeholder="例: ○○様 動画制作 見積書"
            className={inputCls}
          />
        </div>

        {/* 顧客 */}
        <div>
          <label className="block text-xs font-semibold text-zinc-600 mb-1.5">顧客（任意）</label>
          <select name="customerId" className={inputCls}>
            <option value="">— 選択してください —</option>
            {customers.map((c) => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>
        </div>

        {/* プロジェクト */}
        <div>
          <label className="block text-xs font-semibold text-zinc-600 mb-1.5">関連プロジェクト（任意）</label>
          <select name="projectId" className={inputCls}>
            <option value="">— 選択してください —</option>
            {projects.map((p) => (
              <option key={p.id} value={p.id}>{p.title}</option>
            ))}
          </select>
        </div>

        {/* 見積日 */}
        <div>
          <label className="block text-xs font-semibold text-zinc-600 mb-1.5">見積日</label>
          <input
            name="estimateDate"
            type="date"
            defaultValue={new Date().toISOString().slice(0, 10)}
            className={inputCls}
          />
        </div>

        {/* 有効期限 */}
        <div>
          <label className="block text-xs font-semibold text-zinc-600 mb-1.5">有効期限</label>
          <input name="validUntil" type="date" className={inputCls} />
        </div>

        {/* 担当者 */}
        <div>
          <label className="block text-xs font-semibold text-zinc-600 mb-1.5">担当者</label>
          <div className="flex items-center gap-2 px-3 py-2 bg-zinc-50 rounded-lg border border-zinc-200">
            <div className="w-6 h-6 bg-blue-100 rounded-full flex items-center justify-center text-[10px] font-bold text-blue-600">
              {staffName.charAt(0)}
            </div>
            <span className="text-sm text-zinc-700">{staffName}</span>
          </div>
        </div>
      </div>

      {/* ── 明細テーブル ── */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <label className="text-xs font-semibold text-zinc-600">
            見積明細 <span className="text-red-500">*</span>
          </label>
          <button
            type="button"
            onClick={() => setShowCost((v) => !v)}
            className="flex items-center gap-1 px-2 py-1 text-[11px] rounded border border-zinc-200 text-zinc-500 hover:bg-zinc-100 transition-colors"
          >
            {showCost ? <EyeOff className="w-3 h-3" /> : <Eye className="w-3 h-3" />}
            {showCost ? "原価を隠す" : "原価を表示（スタッフ用）"}
          </button>
        </div>

        {showCost && (
          <p className="text-[11px] text-amber-600 bg-amber-50 border border-amber-200 rounded px-3 py-1.5 mb-2">
            ⚠️ 原価・粗利はスタッフ内部用です。PDFには出力されません。
          </p>
        )}

        <div className="overflow-x-auto border border-zinc-200 rounded-lg">
          <table className="w-full text-sm min-w-[640px]">
            <thead className="bg-zinc-50 border-b border-zinc-200">
              <tr>
                <th className="px-2 py-2 text-left text-xs font-semibold text-zinc-500">品目名</th>
                <th className="px-2 py-2 text-left text-xs font-semibold text-zinc-500">仕様・備考</th>
                <th className="px-2 py-2 text-right text-xs font-semibold text-zinc-500">数量</th>
                <th className="px-2 py-2 text-left text-xs font-semibold text-zinc-500">単位</th>
                <th className="px-2 py-2 text-right text-xs font-semibold text-zinc-500">単価</th>
                <th className="px-2 py-2 text-right text-xs font-semibold text-zinc-500">金額</th>
                {showCost && (
                  <>
                    <th className="px-2 py-2 text-right text-xs font-semibold text-amber-600">原価/単</th>
                    <th className="px-2 py-2 text-right text-xs font-semibold text-amber-600">粗利</th>
                  </>
                )}
                <th className="w-10" />
              </tr>
            </thead>
            <tbody>
              {items.map((item, idx) => (
                <EstimationItemRow
                  key={item._key}
                  item={item}
                  templates={templates}
                  showCost={showCost}
                  onChange={(updated) => updateItem(idx, updated)}
                  onRemove={() => removeItem(idx)}
                  isOnly={items.length === 1}
                />
              ))}
            </tbody>
          </table>
        </div>

        <button
          type="button"
          onClick={addItem}
          className="mt-2 flex items-center gap-1.5 px-3 py-1.5 text-xs text-blue-600 border border-blue-200 rounded-lg hover:bg-blue-50 transition-colors"
        >
          <Plus className="w-3.5 h-3.5" />
          明細を追加
        </button>
      </div>

      {/* ── 出精値引き ── */}
      <div className="border border-dashed border-zinc-300 rounded-lg px-4 py-3">
        <label className="flex items-center gap-2 cursor-pointer select-none">
          <input
            type="checkbox"
            checked={showDiscount}
            onChange={(e) => setShowDiscount(e.target.checked)}
            className="w-4 h-4 rounded border-zinc-300 accent-blue-600"
          />
          <Scissors className="w-3.5 h-3.5 text-zinc-400" />
          <span className="text-xs font-semibold text-zinc-600">出精値引きを適用する（内部用・PDF非出力）</span>
        </label>

        {showDiscount && (
          <div className="mt-3 ml-6 space-y-3">
            {/* 値引き額 */}
            <div>
              <label className="block text-xs font-semibold text-zinc-500 mb-1">値引き額（税抜）</label>
              <div className="flex items-center gap-2">
                <span className="text-sm text-zinc-400">¥</span>
                <input
                  type="number"
                  min={0}
                  max={subtotal}
                  step={1000}
                  value={discountAmount || ""}
                  onChange={(e) => setDiscountAmount(Math.max(0, Number(e.target.value)))}
                  placeholder="0"
                  className={cn(inputCls, "w-44 text-right")}
                />
                <span className="text-xs text-zinc-400 whitespace-nowrap">
                  {subtotal > 0 && discountAmount > 0 && (
                    <>（小計の {((discountAmount / subtotal) * 100).toFixed(1)}%）</>
                  )}
                </span>
              </div>
            </div>

            {/* 値引き理由 */}
            <div>
              <label className="block text-xs font-semibold text-zinc-500 mb-1">値引き理由（内部）</label>
              <select
                value={discountReason}
                onChange={(e) => setDiscountReason(e.target.value)}
                className={cn(inputCls, "max-w-sm")}
              >
                <option value="">— 選択してください —</option>
                {DISCOUNT_REASONS.map((r) => (
                  <option key={r.value} value={r.value}>{r.label}</option>
                ))}
              </select>
            </div>

            {/* その他：自由記述 */}
            {discountReason === "OTHER" && (
              <div>
                <label className="block text-xs font-semibold text-zinc-500 mb-1">理由の詳細</label>
                <input
                  type="text"
                  value={discountReasonNote}
                  onChange={(e) => setDiscountReasonNote(e.target.value)}
                  placeholder="値引き理由を詳しく記入..."
                  className={cn(inputCls, "max-w-sm")}
                />
              </div>
            )}
          </div>
        )}
      </div>

      {/* ── 合計エリア ── */}
      <div className="bg-zinc-50 border border-zinc-200 rounded-xl px-5 py-4 space-y-2 max-w-xs ml-auto">
        <div className="flex justify-between text-sm text-zinc-600">
          <span>小計（税抜）</span>
          <span className="tabular-nums font-medium">¥{subtotal.toLocaleString()}</span>
        </div>
        {discountAmt > 0 && (
          <>
            <div className="flex justify-between text-sm text-orange-600">
              <span>出精値引き</span>
              <span className="tabular-nums">−¥{discountAmt.toLocaleString()}</span>
            </div>
            <div className="flex justify-between text-sm text-zinc-600 pt-1 border-t border-zinc-200">
              <span>値引後小計</span>
              <span className="tabular-nums font-medium">¥{afterDiscount.toLocaleString()}</span>
            </div>
          </>
        )}
        <div className="flex justify-between text-sm text-zinc-500">
          <span>消費税（10%）</span>
          <span className="tabular-nums">¥{tax.toLocaleString()}</span>
        </div>
        <div className="flex justify-between text-base font-bold text-zinc-900 pt-1 border-t border-zinc-200">
          <span>合計（税込）</span>
          <span className="tabular-nums text-blue-700">¥{total.toLocaleString()}</span>
        </div>
        {showCost && hasCost && (
          <>
            <div className="pt-2 border-t border-dashed border-amber-200 flex justify-between text-xs text-amber-700">
              <span>原価合計</span>
              <span className="tabular-nums">¥{costTotal.toLocaleString()}</span>
            </div>
            <div className="flex justify-between text-xs">
              <span className="text-amber-700">粗利{discountAmt > 0 ? "（値引後）" : ""}</span>
              <span className={cn("tabular-nums font-semibold", grossProfit >= 0 ? "text-emerald-600" : "text-red-600")}>
                ¥{grossProfit.toLocaleString()}
              </span>
            </div>
            {/* 粗利率ゲージ */}
            <div className="pt-1">
              <div className="flex justify-between items-center text-[11px] text-zinc-500 mb-1">
                <span>粗利率</span>
                <span className={cn("font-bold", profitRate >= 40 ? "text-emerald-600" : profitRate >= 20 ? "text-amber-500" : "text-red-500")}>
                  {profitRate.toFixed(1)}%
                </span>
              </div>
              <div className="h-2 bg-zinc-200 rounded-full overflow-hidden">
                <div
                  className={cn(
                    "h-full rounded-full transition-all duration-300",
                    profitRate >= 40 ? "bg-emerald-500" : profitRate >= 20 ? "bg-amber-400" : "bg-red-500"
                  )}
                  style={{ width: `${Math.min(Math.max(profitRate, 0), 100)}%` }}
                />
              </div>
              <p className="text-[10px] text-zinc-400 mt-1">
                {profitRate >= 40 ? "✅ 良好" : profitRate >= 20 ? "⚠️ 要確認" : "🔴 要注意"}
              </p>
            </div>
          </>
        )}
      </div>

      {/* ── 備考 ── */}
      <div>
        <label className="block text-xs font-semibold text-zinc-600 mb-1.5">備考</label>
        <textarea
          name="notes"
          rows={3}
          placeholder="特記事項・条件など"
          className={`${inputCls} resize-none`}
        />
      </div>

      {/* エラー */}
      {state?.error && (
        <div className="px-4 py-3 bg-red-50 border border-red-200 rounded-lg">
          <p className="text-sm text-red-700">{state.error}</p>
        </div>
      )}

      {/* ボタン */}
      <div className="flex items-center justify-between pt-2">
        <Link
          href="/dashboard/estimates"
          className="px-4 py-2 text-sm text-zinc-500 hover:text-zinc-900 transition-colors"
        >
          キャンセル
        </Link>
        <div className="flex items-center gap-3">
          {/* 下書きとして保存 */}
          <button
            type="submit"
            name="_intent"
            value="draft"
            onClick={() => setPendingIntent("draft")}
            disabled={isPending}
            className="flex items-center gap-2 px-4 py-2.5 text-sm font-medium bg-white text-zinc-700 border border-zinc-300 rounded-lg hover:bg-zinc-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {isPending && pendingIntent === "draft"
              ? <Loader2 className="w-4 h-4 animate-spin" />
              : <Save className="w-4 h-4" />}
            下書きとして保存
          </button>

          {/* 発行する（通知あり） */}
          <button
            type="submit"
            name="_intent"
            value="issue"
            onClick={() => setPendingIntent("issue")}
            disabled={isPending}
            className="flex items-center gap-2 px-6 py-2.5 text-sm font-semibold bg-teal-600 text-white rounded-lg hover:bg-teal-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors shadow-sm"
          >
            {isPending && pendingIntent === "issue"
              ? <Loader2 className="w-4 h-4 animate-spin" />
              : <Send className="w-4 h-4" />}
            {isPending && pendingIntent === "issue" ? "発行中..." : "発行する"}
          </button>
        </div>
      </div>
    </form>
  );
}
