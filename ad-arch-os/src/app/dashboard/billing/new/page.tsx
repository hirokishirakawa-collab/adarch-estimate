import { CreditCard } from "lucide-react";
import { InvoiceRequestForm } from "@/components/billing/invoice-request-form";
import { createInvoiceRequest, getProjectsForSelect, getCustomersForSelect } from "@/lib/actions/billing";

export default async function NewBillingRequestPage() {
  const [projects, customers] = await Promise.all([
    getProjectsForSelect(),
    getCustomersForSelect(),
  ]);

  return (
    <div className="px-6 py-6 max-w-2xl mx-auto w-full">
      <div className="flex items-center gap-3 mb-6">
        <div className="w-9 h-9 bg-violet-50 rounded-xl flex items-center justify-center">
          <CreditCard className="text-violet-600" style={{ width: "1.125rem", height: "1.125rem" }} />
        </div>
        <div>
          <h2 className="text-lg font-bold text-zinc-900">請求依頼を申請する</h2>
          <p className="text-xs text-zinc-500 mt-0.5">金額はすべて税抜で入力してください（消費税10%を自動計算します）</p>
        </div>
      </div>

      <div className="bg-white rounded-xl border border-zinc-200 p-6">
        <InvoiceRequestForm action={createInvoiceRequest} projects={projects} customers={customers} />
      </div>
    </div>
  );
}
