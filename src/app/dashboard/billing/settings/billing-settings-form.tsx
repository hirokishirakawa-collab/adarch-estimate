"use client";

import { useActionState, useState } from "react";
import { Loader2, CheckCircle2, AlertCircle } from "lucide-react";

interface BillingInfo {
  entityType: string;
  corporateNumber: string | null;
  invoiceNumber: string | null;
  invoiceRegistered: boolean;
  bankName: string | null;
  bankBranch: string | null;
  bankAccountType: string | null;
  bankAccountNumber: string | null;
  bankAccountHolder: string | null;
}

interface Props {
  billingInfo: BillingInfo;
  action: (
    prev: { error?: string; success?: boolean } | null,
    formData: FormData
  ) => Promise<{ error?: string; success?: boolean }>;
}

const inputCls =
  "w-full px-3 py-2 text-sm border border-zinc-200 rounded-lg " +
  "focus:outline-none focus:ring-2 focus:ring-indigo-300 focus:border-indigo-400 " +
  "bg-white text-zinc-900 disabled:opacity-50";

const labelCls = "block text-xs font-semibold text-zinc-700 mb-1.5";

export function BillingSettingsForm({ billingInfo, action }: Props) {
  const [state, formAction, isPending] = useActionState(action, null);
  const [entityType, setEntityType] = useState(billingInfo.entityType);
  const [invoiceRegistered, setInvoiceRegistered] = useState(billingInfo.invoiceRegistered);

  return (
    <form action={formAction} className="space-y-6">
      {state?.error && (
        <div className="px-4 py-3 rounded-lg bg-red-50 border border-red-200 text-sm text-red-700">
          {state.error}
        </div>
      )}

      {/* ── 法人区分 ── */}
      <div className="space-y-3">
        <h3 className="text-xs font-semibold text-zinc-500 uppercase tracking-wider">法人区分</h3>
        <div>
          <label className={labelCls}>
            事業形態<span className="text-red-500 ml-0.5">*</span>
          </label>
          <select
            name="entityType"
            value={entityType}
            onChange={(e) => setEntityType(e.target.value)}
            disabled={isPending}
            className={inputCls}
          >
            <option value="UNKNOWN">選択してください</option>
            <option value="CORPORATION">法人（株式会社・合同会社等）</option>
            <option value="SOLE_PROPRIETOR">個人事業主</option>
          </select>
          {entityType === "SOLE_PROPRIETOR" && (
            <p className="mt-1.5 text-[11px] text-amber-600">
              個人事業主の場合、本部からの制作費の支払い時に源泉徴収（10.21%）が発生します。
            </p>
          )}
        </div>

        {entityType === "CORPORATION" && (
          <div>
            <label className={labelCls}>法人番号（13桁）</label>
            <input
              type="text"
              name="corporateNumber"
              defaultValue={billingInfo.corporateNumber ?? ""}
              placeholder="1234567890123"
              maxLength={13}
              disabled={isPending}
              className={inputCls}
            />
            <p className="mt-1 text-[11px] text-zinc-400">
              国税庁の法人番号公表サイトで確認できます
            </p>
          </div>
        )}
      </div>

      {/* ── インボイス ── */}
      <div className="space-y-3 pt-2 border-t border-zinc-100">
        <h3 className="text-xs font-semibold text-zinc-500 uppercase tracking-wider">インボイス制度</h3>
        <div>
          <label className="flex items-center gap-2.5 cursor-pointer">
            <input
              type="checkbox"
              name="invoiceRegistered"
              checked={invoiceRegistered}
              onChange={(e) => setInvoiceRegistered(e.target.checked)}
              disabled={isPending}
              className="rounded border-zinc-300 text-indigo-600 focus:ring-indigo-300"
            />
            <span className="text-sm text-zinc-800 font-medium">
              適格請求書発行事業者に登録済み
            </span>
          </label>
          {!invoiceRegistered && (
            <p className="mt-1.5 ml-6 text-[11px] text-amber-600">
              未登録の場合、本部が支払う消費税の一部が控除できないため、支払額から調整させていただく場合があります。
              <br />
              現在（〜2026/9）: 消費税の20%が控除不可 → 2026/10〜: 50%に拡大
            </p>
          )}
        </div>

        {invoiceRegistered && (
          <div>
            <label className={labelCls}>インボイス登録番号</label>
            <input
              type="text"
              name="invoiceNumber"
              defaultValue={billingInfo.invoiceNumber ?? ""}
              placeholder="T1234567890123"
              maxLength={14}
              disabled={isPending}
              className={inputCls}
            />
            <p className="mt-1 text-[11px] text-zinc-400">
              「T」 + 13桁の番号です。国税庁のサイトで確認できます
            </p>
          </div>
        )}
      </div>

      {/* ── 振込先口座 ── */}
      <div className="space-y-3 pt-2 border-t border-zinc-100">
        <h3 className="text-xs font-semibold text-zinc-500 uppercase tracking-wider">振込先口座</h3>
        <div>
          <label className={labelCls}>銀行名</label>
          <input
            type="text"
            name="bankName"
            defaultValue={billingInfo.bankName ?? ""}
            placeholder="例: 三菱UFJ銀行"
            disabled={isPending}
            className={inputCls}
          />
        </div>
        <div>
          <label className={labelCls}>支店名</label>
          <input
            type="text"
            name="bankBranch"
            defaultValue={billingInfo.bankBranch ?? ""}
            placeholder="例: 渋谷支店"
            disabled={isPending}
            className={inputCls}
          />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className={labelCls}>口座種別</label>
            <select
              name="bankAccountType"
              defaultValue={billingInfo.bankAccountType ?? "SAVINGS"}
              disabled={isPending}
              className={inputCls}
            >
              <option value="SAVINGS">普通</option>
              <option value="CHECKING">当座</option>
            </select>
          </div>
          <div>
            <label className={labelCls}>口座番号</label>
            <input
              type="text"
              name="bankAccountNumber"
              defaultValue={billingInfo.bankAccountNumber ?? ""}
              placeholder="1234567"
              maxLength={8}
              disabled={isPending}
              className={inputCls}
            />
          </div>
        </div>
        <div>
          <label className={labelCls}>口座名義（カナ）</label>
          <input
            type="text"
            name="bankAccountHolder"
            defaultValue={billingInfo.bankAccountHolder ?? ""}
            placeholder="例: カ）アドアーチ"
            disabled={isPending}
            className={inputCls}
          />
        </div>
      </div>

      {/* ── 送信 ── */}
      <div className="flex items-center gap-3 pt-3 border-t border-zinc-100">
        <button
          type="submit"
          disabled={isPending}
          className="inline-flex items-center gap-2 px-5 py-2 text-sm font-semibold bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-60 transition-colors"
        >
          {isPending && <Loader2 className="w-4 h-4 animate-spin" />}
          保存する
        </button>
        {state?.success && (
          <span className="flex items-center gap-1 text-sm text-emerald-600">
            <CheckCircle2 className="w-4 h-4" />
            保存しました
          </span>
        )}
        {state?.error && (
          <span className="flex items-center gap-1 text-sm text-red-600">
            <AlertCircle className="w-4 h-4" />
            {state.error}
          </span>
        )}
      </div>
    </form>
  );
}
