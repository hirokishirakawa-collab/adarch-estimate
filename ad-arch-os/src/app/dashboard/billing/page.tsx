import Link from "next/link";
import { CreditCard, Plus } from "lucide-react";
import { getInvoiceRequestList } from "@/lib/actions/billing";
import { InvoiceRequestList } from "@/components/billing/invoice-request-list";

export default async function BillingPage() {
  const { requests, role } = await getInvoiceRequestList();

  return (
    <div className="px-6 py-6 max-w-screen-xl mx-auto w-full">
      <div className="flex items-center justify-between mb-6 flex-wrap gap-4">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 bg-violet-50 rounded-xl flex items-center justify-center">
            <CreditCard className="text-violet-600" style={{ width: "1.125rem", height: "1.125rem" }} />
          </div>
          <div>
            <h2 className="text-lg font-bold text-zinc-900">請求依頼</h2>
            <p className="text-xs text-zinc-500 mt-0.5">
              {role === "ADMIN"
                ? "全社の請求依頼を管理します"
                : "本部宛の請求依頼を申請・管理します（自分の依頼のみ表示）"}
            </p>
          </div>
        </div>

        <Link
          href="/dashboard/billing/new"
          className="flex items-center gap-1.5 px-3 py-1.5 bg-violet-600 text-white
                     text-xs font-medium rounded-lg hover:bg-violet-700 transition-colors"
        >
          <Plus className="w-3.5 h-3.5" />
          請求依頼を申請する
        </Link>
      </div>

      <InvoiceRequestList requests={requests} role={role} />
    </div>
  );
}
