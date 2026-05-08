import Link from "next/link";
import { CreditCard, Plus, AlertTriangle } from "lucide-react";
import { getInvoiceRequestList } from "@/lib/actions/billing";
import { getMyBillingInfo } from "@/lib/actions/partner-billing";
import { InvoiceRequestList } from "@/components/billing/invoice-request-list";
import { WikiHelpLink } from "@/components/wiki/wiki-help-link";

export default async function BillingPage() {
  const [{ requests, role }, billingInfo] = await Promise.all([
    getInvoiceRequestList(),
    getMyBillingInfo(),
  ]);

  const needsSetup = billingInfo && (
    billingInfo.entityType === "UNKNOWN" ||
    !billingInfo.bankName ||
    !billingInfo.bankAccountNumber
  );

  return (
    <div className="px-6 py-6 max-w-screen-xl mx-auto w-full">
      <div className="flex items-center justify-between mb-6 flex-wrap gap-4">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 bg-violet-50 rounded-xl flex items-center justify-center">
            <CreditCard className="text-violet-600" style={{ width: "1.125rem", height: "1.125rem" }} />
          </div>
          <div>
            <h2 className="text-lg font-bold text-zinc-900">請求依頼</h2>
            <div className="flex items-center gap-2 mt-0.5">
              <p className="text-xs text-zinc-500">
                {role === "ADMIN"
                  ? "全社の請求依頼を管理します"
                  : "本部宛の請求依頼を申請・管理します（自分の依頼のみ表示）"}
              </p>
              <WikiHelpLink query="請求管理" />
            </div>
          </div>
        </div>

        <Link
          href="/dashboard/billing/new"
          data-tour="billing-new"
          className="flex items-center gap-1.5 px-3 py-1.5 bg-violet-600 text-white
                     text-xs font-medium rounded-lg hover:bg-violet-700 transition-colors"
        >
          <Plus className="w-3.5 h-3.5" />
          請求依頼を申請する
        </Link>
      </div>

      {needsSetup && role !== "ADMIN" && (
        <div className="mb-4 px-4 py-3 bg-amber-50 border border-amber-200 rounded-xl flex items-start gap-2">
          <AlertTriangle className="w-4 h-4 text-amber-600 mt-0.5 flex-shrink-0" />
          <div className="text-xs text-amber-800">
            <p className="font-semibold">経理情報が未登録です</p>
            <p className="mt-0.5">
              法人区分・振込先口座を登録すると、支払明細の発行がスムーズになります。
              <Link href="/dashboard/billing/settings" className="ml-1 text-indigo-600 hover:underline font-medium">
                登録する →
              </Link>
            </p>
          </div>
        </div>
      )}

      <div data-tour="billing-list">
        <InvoiceRequestList requests={requests} role={role} />
      </div>
    </div>
  );
}
