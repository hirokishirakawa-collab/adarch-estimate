import { redirect } from "next/navigation";
import { Building2 } from "lucide-react";
import { getMyBillingInfo, updateMyBillingInfo } from "@/lib/actions/partner-billing";
import { BillingSettingsForm } from "./billing-settings-form";

export default async function BillingSettingsPage() {
  const billingInfo = await getMyBillingInfo();
  if (!billingInfo) redirect("/dashboard/billing");

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
      </div>

      {/* インボイス制度の説明 */}
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
