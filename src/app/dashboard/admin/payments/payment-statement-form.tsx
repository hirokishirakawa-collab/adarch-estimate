"use client";

import { useActionState, useState } from "react";
import Link from "next/link";
import { Loader2, AlertTriangle, Plus, Trash2 } from "lucide-react";
import { computeBreakdown } from "@/lib/payment-statement-calc";

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

type ClientRow = { clientName: string; grossAmount: number; note: string };

function fmtNum(n: number): string {
  return n.toLocaleString("ja-JP");
}

const inputCls =
  "w-full px-3 py-2 text-sm border border-zinc-200 rounded-lg " +
  "focus:outline-none focus:ring-2 focus:ring-emerald-300 focus:border-emerald-400 bg-white text-zinc-900";

export function PaymentStatementForm({ action, partners }: Props) {
  const [state, formAction, isPending] = useActionState(action, null);

  const [selectedPartnerId, setSelectedPartnerId] = useState("");
  const [rows, setRows] = useState<ClientRow[]>([{ clientName: "", grossAmount: 0, note: "" }]);
  const [commissionRate, setCommissionRate] = useState(10);
  const [adMediaCost, setAdMediaCost] = useState(0);

  const partner = partners.find((p) => p.id === selectedPartnerId);
  const isSoleProprietor = partner?.entityType === "SOLE_PROPRIETOR";
  const isInvoiceUnregistered = partner ? !partner.invoiceRegistered : false;
  const isUnknownEntity = partner?.entityType === "UNKNOWN";

  // 入金額（税込）合計
  const grossInclTax = rows.reduce((sum, r) => sum + (r.grossAmount || 0), 0);

  // 税抜ベースで一括計算（共通ロジック）
  const b = computeBreakdown({
    grossInclTax,
    commissionRate,
    adMediaCostInclTax: adMediaCost,
    isSoleProprietor: !!isSoleProprietor,
    isInvoiceUnregistered,
  });

  const validRows = rows.filter((r) => r.clientName.trim() && r.grossAmount > 0);
  const canSubmit = !!selectedPartnerId && validRows.length > 0;

  function updateRow(idx: number, patch: Partial<ClientRow>) {
    setRows((prev) => prev.map((r, i) => (i === idx ? { ...r, ...patch } : r)));
  }
  function addRow() {
    setRows((prev) => [...prev, { clientName: "", grossAmount: 0, note: "" }]);
  }
  function removeRow(idx: number) {
    setRows((prev) => (prev.length <= 1 ? prev : prev.filter((_, i) => i !== idx)));
  }

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
        <input type="text" name="title" required maxLength={200} placeholder="例: 2026年5月 グループ案件 支払明細" className={inputCls} />
      </div>

      {/* クライアント明細行 */}
      <div className="border border-zinc-200 rounded-xl p-4 space-y-3 bg-zinc-50">
        <div className="flex items-center justify-between">
          <p className="text-xs font-semibold text-zinc-600 uppercase tracking-wider">クライアント別 入金内訳（税込）</p>
          <button
            type="button"
            onClick={addRow}
            className="inline-flex items-center gap-1 px-2 py-1 text-[11px] font-semibold text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-md hover:bg-emerald-100 transition-colors"
          >
            <Plus className="w-3 h-3" />
            クライアントを追加
          </button>
        </div>

        <div className="space-y-2">
          {rows.map((row, i) => (
            <div key={i} className="flex gap-2 items-start">
              <div className="flex-1">
                <input
                  type="text"
                  value={row.clientName}
                  onChange={(e) => updateRow(i, { clientName: e.target.value })}
                  maxLength={200}
                  placeholder={`クライアント名${rows.length > 1 ? ` ${i + 1}` : ""}`}
                  className={`${inputCls} text-xs`}
                />
              </div>
              <div className="w-36">
                <div className="relative">
                  <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-zinc-400 text-xs">¥</span>
                  <input
                    type="number" min={0} step={1}
                    value={row.grossAmount === 0 ? "" : row.grossAmount}
                    onChange={(e) => updateRow(i, { grossAmount: Math.max(0, parseInt(e.target.value, 10) || 0) })}
                    placeholder="入金額(税込)"
                    className={`${inputCls} pl-6 text-xs`}
                  />
                </div>
              </div>
              <button
                type="button"
                onClick={() => removeRow(i)}
                disabled={rows.length <= 1}
                className="mt-1.5 text-zinc-300 hover:text-red-500 disabled:opacity-30 disabled:hover:text-zinc-300 transition-colors"
                aria-label="行を削除"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          ))}
        </div>

        <div className="flex justify-between text-xs pt-2 border-t border-zinc-200">
          <span className="text-zinc-600 font-semibold">入金額合計（税込）</span>
          <span className="font-bold text-zinc-900">¥{fmtNum(grossInclTax)}</span>
        </div>
        <div className="flex justify-between text-[11px] text-zinc-500">
          <span>うち 本体（税抜） ¥{fmtNum(b.grossExclTax)}</span>
          <span>消費税 ¥{fmtNum(b.grossTax)}</span>
        </div>

        {/* 行データを JSON で送信 */}
        <input type="hidden" name="items" value={JSON.stringify(validRows)} />
        <input type="hidden" name="grossAmount" value={grossInclTax} />
      </div>

      {/* 手数料・税セクション */}
      <div className="border border-zinc-200 rounded-xl p-4 space-y-4 bg-zinc-50">
        <p className="text-xs font-semibold text-zinc-600 uppercase tracking-wider">手数料・控除</p>

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
            <label className="block text-xs font-semibold text-zinc-700 mb-1.5">手数料額（税抜）</label>
            <p className="px-3 py-2 text-sm font-bold text-zinc-700 bg-white border border-zinc-200 rounded-lg">
              ¥{fmtNum(b.commissionExclTax)}
            </p>
          </div>
        </div>

        {/* 広告媒体費（税込・実際の請求額・源泉対象外・支払から差引） */}
        <div className="pt-3 border-t border-zinc-200 space-y-2">
          <label className="block text-[11px] text-zinc-500">広告媒体費（税込・実際の請求額）</label>
          <div className="relative">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400 text-sm">¥</span>
            <input
              type="number" name="adMediaCost" min={0} step={1}
              value={adMediaCost === 0 ? "" : adMediaCost}
              onChange={(e) => setAdMediaCost(Math.max(0, parseInt(e.target.value, 10) || 0))}
              placeholder="0"
              className={`${inputCls} pl-7 text-xs`}
            />
          </div>
          <p className="text-[11px] text-zinc-400">
            媒体への実際の請求額（税込）を入力してください（例: 媒体費10万なら税込11万）。この税込額をパートナー報酬から差し引きます。残り（制作費 ¥{fmtNum(b.productionExclTax)}・税抜）が源泉徴収の対象です。
          </p>
        </div>

        {/* 計算結果（税抜ベース） */}
        <div className="pt-3 border-t border-zinc-200 space-y-2">
          <div className="flex justify-between text-xs">
            <span className="text-zinc-600">入金額 合計（税込）</span>
            <span className="font-medium">¥{fmtNum(b.grossInclTax)}</span>
          </div>
          <div className="flex justify-between text-[11px] text-zinc-400">
            <span className="pl-3">本体（税抜）</span>
            <span>¥{fmtNum(b.grossExclTax)}</span>
          </div>
          <div className="flex justify-between text-[11px] text-zinc-400">
            <span className="pl-3">消費税（10%）</span>
            <span>¥{fmtNum(b.grossTax)}</span>
          </div>
          <div className="flex justify-between text-xs pt-1">
            <span className="text-zinc-600">本部手数料（{commissionRate}%・税抜）</span>
            <span className="font-medium text-red-600">-¥{fmtNum(b.commissionExclTax)}</span>
          </div>

          <div className="flex justify-between text-xs pt-1 border-t border-zinc-100">
            <span className="text-zinc-600">パートナー報酬（税抜）</span>
            <span className="font-medium">¥{fmtNum(b.partnerFeeExclTax)}</span>
          </div>
          <div className="flex justify-between text-xs">
            <span className="text-zinc-600">消費税（10%）</span>
            <span className="font-medium">+¥{fmtNum(b.partnerTax)}</span>
          </div>
          <div className="flex justify-between text-xs">
            <span className="text-zinc-600">パートナー報酬（税込）</span>
            <span className="font-medium">¥{fmtNum(b.partnerInclTax)}</span>
          </div>

          {b.adMediaCostInclTax > 0 && (
            <div className="flex justify-between text-xs">
              <span className="text-zinc-600">広告媒体費（税込・源泉対象外）</span>
              <span className="font-medium text-red-600">-¥{fmtNum(b.adMediaCostInclTax)}</span>
            </div>
          )}
          {isSoleProprietor && b.withholdingTaxAmount > 0 && (
            <div className="flex justify-between text-xs">
              <span className="text-zinc-600">源泉徴収税（制作費 ¥{fmtNum(b.productionExclTax)}）</span>
              <span className="font-medium text-red-600">-¥{fmtNum(b.withholdingTaxAmount)}</span>
            </div>
          )}
          {isInvoiceUnregistered && b.nonDeductibleTaxAmount > 0 && (
            <div className="flex justify-between text-xs">
              <span className="text-zinc-600">控除不可消費税（インボイス未登録）</span>
              <span className="font-medium text-red-600">-¥{fmtNum(b.nonDeductibleTaxAmount)}</span>
            </div>
          )}

          <div className="flex justify-between text-base pt-2 border-t border-emerald-200">
            <span className="font-semibold text-zinc-700">差引支払額</span>
            <span className="font-bold text-emerald-700">¥{fmtNum(b.netPaymentAmount)}</span>
          </div>
        </div>
      </div>

      {/* 備考 */}
      <div>
        <label className="block text-xs font-semibold text-zinc-700 mb-1.5">備考</label>
        <textarea name="description" rows={3} placeholder="特記事項など" className={`${inputCls} resize-y`} />
      </div>

      {/* 送信 */}
      <div className="flex items-center gap-3 pt-2">
        <button
          type="submit" disabled={isPending || !canSubmit}
          className="inline-flex items-center gap-1.5 px-5 py-2 bg-emerald-600 text-white text-sm font-semibold rounded-lg hover:bg-emerald-700 disabled:opacity-60 transition-colors"
        >
          {isPending && <Loader2 className="w-4 h-4 animate-spin" />}
          作成する
        </button>
        <Link href="/dashboard/admin/payments" className="px-4 py-2 text-sm text-zinc-500 hover:text-zinc-800 transition-colors">
          キャンセル
        </Link>
      </div>
    </form>
  );
}
