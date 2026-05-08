import { redirect } from "next/navigation";
import { Building2, Check, X, ExternalLink } from "lucide-react";
import { getMyBillingInfo, updateMyBillingInfo } from "@/lib/actions/partner-billing";
import { BillingSettingsForm } from "./billing-settings-form";

const ENTITY_LABELS: Record<string, string> = {
  CORPORATION: "法人",
  SOLE_PROPRIETOR: "個人事業主",
  UNKNOWN: "未設定",
};

export default async function BillingSettingsPage() {
  const billingInfo = await getMyBillingInfo();
  if (!billingInfo) redirect("/dashboard/billing");

  const hasEntity = billingInfo.entityType !== "UNKNOWN";
  const hasBank = !!(billingInfo.bankName && billingInfo.bankAccountNumber);
  const allRegistered = hasEntity && billingInfo.invoiceRegistered && hasBank;

  return (
    <div className="px-6 py-6 max-w-2xl mx-auto w-full">
      <div className="flex items-center gap-3 mb-6">
        <div className="w-9 h-9 bg-indigo-50 rounded-xl flex items-center justify-center">
          <Building2
            className="text-indigo-600"
            style={{ width: "1.125rem", height: "1.125rem" }}
          />
        </div>
        <div>
          <h2 className="text-lg font-bold text-zinc-900">経理情報の登録</h2>
          <p className="text-xs text-zinc-500 mt-0.5">
            法人区分・インボイス登録・振込先口座を登録してください
          </p>
        </div>
      </div>

      {/* 企業情報（読み取り専用） */}
      <div className="bg-zinc-50 border border-zinc-200 rounded-xl p-4 mb-4">
        <p className="text-sm font-bold text-zinc-900">{billingInfo.ownerName}</p>
        <p className="text-xs text-zinc-500">{billingInfo.name}</p>
        {billingInfo.registeredName && (
          <p className="text-xs text-indigo-600 mt-0.5">{billingInfo.registeredName}</p>
        )}
      </div>

      {/* 現在の登録状況サマリー */}
      <div className={`mb-4 border rounded-xl p-4 ${allRegistered ? "bg-emerald-50 border-emerald-200" : "bg-amber-50 border-amber-200"}`}>
        <p className={`text-xs font-semibold mb-3 ${allRegistered ? "text-emerald-800" : "text-amber-800"}`}>
          {allRegistered ? "すべての経理情報が登録されています" : "登録が完了していない項目があります"}
        </p>
        <div className="space-y-2">
          <StatusRow
            label="事業形態"
            value={ENTITY_LABELS[billingInfo.entityType] ?? "未設定"}
            registered={hasEntity}
            detail={billingInfo.corporateNumber ? `法人番号: ${billingInfo.corporateNumber}` : undefined}
          />
          <StatusRow
            label="インボイス"
            value={billingInfo.invoiceRegistered ? "登録済" : "未登録"}
            registered={billingInfo.invoiceRegistered}
            detail={billingInfo.invoiceNumber ? `登録番号: ${billingInfo.invoiceNumber}` : undefined}
          />
          <StatusRow
            label="振込先口座"
            value={hasBank ? `${billingInfo.bankName} ${billingInfo.bankBranch ?? ""}` : "未登録"}
            registered={hasBank}
            detail={hasBank ? `${billingInfo.bankAccountType === "SAVINGS" ? "普通" : "当座"} ${billingInfo.bankAccountNumber} / ${billingInfo.bankAccountHolder}` : undefined}
          />
        </div>
      </div>

      {/* 説明 */}
      <div className="mb-4 px-4 py-3 bg-blue-50 border border-blue-200 rounded-xl">
        <p className="text-xs font-semibold text-blue-800 mb-1">経理情報の登録をお願いします</p>
        <ul className="text-[11px] text-blue-700 space-y-0.5 list-disc list-inside">
          <li>法人か個人事業主かによって、本部からの支払い時に源泉徴収の処理が変わります</li>
          <li>インボイス登録番号をお持ちの方は登録してください</li>
          <li>振込先口座は正確にご入力ください（本部からの支払いに使用します）</li>
        </ul>
      </div>

      <div className="bg-white rounded-xl border border-zinc-200 p-6">
        <BillingSettingsForm
          billingInfo={billingInfo}
          action={updateMyBillingInfo}
        />
      </div>
    </div>
  );
}

function StatusRow({
  label,
  value,
  registered,
  detail,
}: {
  label: string;
  value: string;
  registered: boolean;
  detail?: string;
}) {
  return (
    <div className="flex items-start gap-2">
      {registered ? (
        <Check className="w-3.5 h-3.5 text-emerald-600 mt-0.5 flex-shrink-0" />
      ) : (
        <X className="w-3.5 h-3.5 text-red-500 mt-0.5 flex-shrink-0" />
      )}
      <div>
        <div className="flex items-center gap-2">
          <span className="text-xs font-medium text-zinc-700">{label}:</span>
          <span className={`text-xs ${registered ? "text-zinc-800" : "text-red-600 font-medium"}`}>
            {value}
          </span>
        </div>
        {detail && (
          <p className="text-[11px] text-zinc-400">{detail}</p>
        )}
      </div>
    </div>
  );
}
