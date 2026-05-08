"use client";

import { useActionState, useState } from "react";
import { Loader2, AlertTriangle } from "lucide-react";

type Partner = {
  id: string;
  name: string;
  ownerName: string;
  entityType: string;
  invoiceRegistered: boolean;
};

interface Props {
  action: (prev: { error?: string } | null, formData: FormData) => Promise<{ error?: string }>;
  partners: Partner[];
}

function fmtNum(n: number): string {
  return n.toLocaleString("ja-JP");
}

function calcWithholding(productionExpense: number): number {
  if (productionExpense <= 0) return 0;
  if (productionExpense <= 1_000_000) return Math.floor(productionExpense * 0.1021);
  return Math.floor(1_000_000 * 0.1021) + Math.floor((productionExpense - 1_000_000) * 0.2042);
}

function calcNonDeductible(amountExclTax: number): number {
  if (amountExclTax <= 0) return 0;
  const tax = Math.round(amountExclTax * 0.1);
  const now = new Date();
  const rate = now < new Date("2026-10-01") ? 0.2 : now < new Date("2029-10-01") ? 0.5 : 1.0;
  return Math.floor(tax * rate);
}

const inputCls =
  "w-full px-3 py-2 text-sm border border-zinc-200 rounded-lg " +
  "focus:outline-none focus:ring-2 focus:ring-emerald-300 focus:border-emerald-400 bg-white text-zinc-900";

export function PaymentStatementForm({ action, partners }: Props) {
  const [state, formAction, isPending] = useActionState(action, null);

  const [selectedPartnerId, setSelectedPartnerId] = useState("");
  const [grossAmount, setGrossAmount] = useState(0);
  const [commissionRate, setCommissionRate] = useState(10);
  const [mediaExpense, setMediaExpense] = useState(0);
  const [productionExpense, setProductionExpense] = useState(0);

  const partner = partners.find((p) => p.id === selectedPartnerId);
  const isSoleProprietor = partner?.entityType === "SOLE_PROPRIETOR";
  const isInvoiceUnregistered = partner ? !partner.invoiceRegistered : false;
  const isUnknownEntity = partner?.entityType === "UNKNOWN";

  // 自動計算
  const commissionAmount = Math.floor(grossAmount * commissionRate / 100);
  const afterCommission = grossAmount - commissionAmount;
  const withholdingTaxAmount = isSoleProprietor ? calcWithholding(productionExpense) : 0;
  // 控除不可消費税: 手数料差引後の税抜額に対して計算
  const partnerAmountExclTax = Math.round(afterCommission / 1.1);
  const nonDeductibleTaxAmount = isInvoiceUnregistered ? calcNonDeductible(partnerAmountExclTax) : 0;
  const netPaymentAmount = afterCommission - withholdingTaxAmount - nonDeductibleTaxAmount;

  return (
    <form action={formAction} className="space-y-5 max-w-xl">
      {state?.error && (
        <div className="px-4 py-3 rounded-lg bg-red-50 border border-red-200 text-sm text-red-700">
          {state.error}
        </div>
      )}

      {/* パートナー選択 */}
      <div>
        <label className="block text-xs font-semibold text-zinc-700 mb-1.5">
          支払先パートナー<span className="text-red-500 ml-0.5">*</span>
        </label>
        <select
          name="groupCompanyId"
          value={selectedPartnerId}
          onChange={(e) => setSelectedPartnerId(e.target.value)}
          required
          className={inputCls}
        >
          <option value="">選択してください</option>
          {partners.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}（{p.ownerName}）
            </option>
          ))}
        </select>

        {/* パートナー情報バッジ */}
        {partner && (
          <div className="flex gap-2 mt-2 flex-wrap">
            <span className={`inline-block px-2 py-0.5 text-[11px] font-semibold rounded-full border ${
              isSoleProprietor ? "bg-amber-50 text-amber-700 border-amber-200"
              : partner.entityType === "CORPORATION" ? "bg-blue-50 text-blue-700 border-blue-200"
              : "bg-red-50 text-red-700 border-red-200"
            }`}>
              {isSoleProprietor ? "個人事業主" : partner.entityType === "CORPORATION" ? "法人" : "未確認"}
            </span>
            <span className={`inline-block px-2 py-0.5 text-[11px] font-semibold rounded-full border ${
              partner.invoiceRegistered ? "bg-emerald-50 text-emerald-700 border-emerald-200"
              : "bg-red-50 text-red-700 border-red-200"
            }`}>
              インボイス{partner.invoiceRegistered ? "登録済" : "未登録"}
            </span>
          </div>
        )}

        {isUnknownEntity && (
          <div className="flex items-center gap-1.5 mt-2 text-[11px] text-red-600">
            <AlertTriangle className="w-3 h-3" />
            法人区分が未確認です。先にパートナー経理管理で設定してください。
          </div>
        )}
      </div>

      {/* 件名 */}
      <div>
        <label className="block text-xs font-semibold text-zinc-700 mb-1.5">
          件名<span className="text-red-500 ml-0.5">*</span>
        </label>
        <input type="text" name="title" required maxLength={200} placeholder="例: ○○案件 支払明細" className={inputCls} />
      </div>

      {/* クライアント名 */}
      <div>
        <label className="block text-xs font-semibold text-zinc-700 mb-1.5">クライアント名</label>
        <input type="text" name="clientName" maxLength={200} placeholder="例: ○○株式会社" className={inputCls} />
      </div>

      {/* 金額セクション */}
      <div className="border border-zinc-200 rounded-xl p-4 space-y-4 bg-zinc-50">
        <p className="text-xs font-semibold text-zinc-600 uppercase tracking-wider">金額</p>

        {/* 入金額 */}
        <div>
          <label className="block text-xs font-semibold text-zinc-700 mb-1.5">
            クライアントからの入金額（税込）<span className="text-red-500 ml-0.5">*</span>
          </label>
          <div className="relative">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400 text-sm">¥</span>
            <input
              type="number" name="grossAmount" min={0} step={1} required
              value={grossAmount === 0 ? "" : grossAmount}
              onChange={(e) => setGrossAmount(Math.max(0, parseInt(e.target.value, 10) || 0))}
              placeholder="0"
              className={`${inputCls} pl-7`}
            />
          </div>
        </div>

        {/* 手数料率 */}
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-semibold text-zinc-700 mb-1.5">本部手数料率（%）</label>
            <input
              type="number" name="commissionRate" min={0} max={100} step={0.01}
              value={commissionRate}
              onChange={(e) => setCommissionRate(Math.max(0, parseFloat(e.target.value) || 0))}
              className={inputCls}
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-zinc-700 mb-1.5">手数料額</label>
            <p className="px-3 py-2 text-sm font-bold text-zinc-700 bg-white border border-zinc-200 rounded-lg">
              ¥{fmtNum(commissionAmount)}
            </p>
          </div>
        </div>
        <input type="hidden" name="commissionAmount" value={commissionAmount} />

        {/* 媒体費 / 制作費 */}
        <div className="pt-3 border-t border-zinc-200 space-y-3">
          <p className="text-[11px] text-zinc-500">
            源泉徴収は制作費に対してのみ適用されます（媒体費は対象外）
          </p>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-[11px] text-zinc-500 mb-1">媒体費（税抜）</label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400 text-sm">¥</span>
                <input
                  type="number" name="mediaExpense" min={0} step={1}
                  value={mediaExpense === 0 ? "" : mediaExpense}
                  onChange={(e) => setMediaExpense(Math.max(0, parseInt(e.target.value, 10) || 0))}
                  placeholder="0"
                  className={`${inputCls} pl-7 text-xs`}
                />
              </div>
            </div>
            <div>
              <label className="block text-[11px] text-zinc-500 mb-1">制作費（税抜）</label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400 text-sm">¥</span>
                <input
                  type="number" name="productionExpense" min={0} step={1}
                  value={productionExpense === 0 ? "" : productionExpense}
                  onChange={(e) => setProductionExpense(Math.max(0, parseInt(e.target.value, 10) || 0))}
                  placeholder="0"
                  className={`${inputCls} pl-7 text-xs`}
                />
              </div>
            </div>
          </div>
        </div>

        {/* 計算結果 */}
        <div className="pt-3 border-t border-zinc-200 space-y-2">
          <div className="flex justify-between text-xs">
            <span className="text-zinc-600">クライアント入金額（税込）</span>
            <span className="font-medium">¥{fmtNum(grossAmount)}</span>
          </div>
          <div className="flex justify-between text-xs">
            <span className="text-zinc-600">本部手数料（{commissionRate}%）</span>
            <span className="font-medium text-red-600">-¥{fmtNum(commissionAmount)}</span>
          </div>
          <div className="flex justify-between text-xs">
            <span className="text-zinc-600">手数料差引後</span>
            <span className="font-medium">¥{fmtNum(afterCommission)}</span>
          </div>

          {isSoleProprietor && withholdingTaxAmount > 0 && (
            <div className="flex justify-between text-xs">
              <span className="text-zinc-600">源泉徴収税（制作費 ¥{fmtNum(productionExpense)}）</span>
              <span className="font-medium text-red-600">-¥{fmtNum(withholdingTaxAmount)}</span>
            </div>
          )}
          {isInvoiceUnregistered && nonDeductibleTaxAmount > 0 && (
            <div className="flex justify-between text-xs">
              <span className="text-zinc-600">控除不可消費税（インボイス未登録）</span>
              <span className="font-medium text-red-600">-¥{fmtNum(nonDeductibleTaxAmount)}</span>
            </div>
          )}

          <div className="flex justify-between text-base pt-2 border-t border-emerald-200">
            <span className="font-semibold text-zinc-700">差引支払額</span>
            <span className="font-bold text-emerald-700">¥{fmtNum(netPaymentAmount)}</span>
          </div>
        </div>
        <input type="hidden" name="withholdingTaxAmount" value={withholdingTaxAmount} />
        <input type="hidden" name="nonDeductibleTaxAmount" value={nonDeductibleTaxAmount} />
        <input type="hidden" name="netPaymentAmount" value={netPaymentAmount} />
      </div>

      {/* 備考 */}
      <div>
        <label className="block text-xs font-semibold text-zinc-700 mb-1.5">備考</label>
        <textarea name="description" rows={3} placeholder="特記事項など" className={`${inputCls} resize-y`} />
      </div>

      {/* 送信 */}
      <div className="flex items-center gap-3 pt-2">
        <button
          type="submit" disabled={isPending}
          className="inline-flex items-center gap-1.5 px-5 py-2 bg-emerald-600 text-white text-sm font-semibold rounded-lg hover:bg-emerald-700 disabled:opacity-60 transition-colors"
        >
          {isPending && <Loader2 className="w-4 h-4 animate-spin" />}
          作成する
        </button>
        <a href="/dashboard/admin/payments" className="px-4 py-2 text-sm text-zinc-500 hover:text-zinc-800 transition-colors">
          キャンセル
        </a>
      </div>
    </form>
  );
}
