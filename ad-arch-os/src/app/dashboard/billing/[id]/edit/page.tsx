import { CreditCard } from "lucide-react";
import { InvoiceRequestForm } from "@/components/billing/invoice-request-form";
import {
  getInvoiceRequestWithAuth,
  updateInvoiceRequest,
  getProjectsForSelect,
  getCustomersForSelect,
} from "@/lib/actions/billing";

interface Props {
  params: Promise<{ id: string }>;
}

export default async function EditBillingRequestPage({ params }: Props) {
  const { id } = await params;

  const [{ request }, projects, customers] = await Promise.all([
    getInvoiceRequestWithAuth(id),
    getProjectsForSelect(),
    getCustomersForSelect(),
  ]);

  const action = updateInvoiceRequest.bind(null, id);

  return (
    <div className="px-6 py-6 max-w-2xl mx-auto w-full">
      <div className="flex items-center gap-3 mb-6">
        <div className="w-9 h-9 bg-violet-50 rounded-xl flex items-center justify-center">
          <CreditCard
            className="text-violet-600"
            style={{ width: "1.125rem", height: "1.125rem" }}
          />
        </div>
        <div>
          <h2 className="text-lg font-bold text-zinc-900">請求依頼を編集</h2>
          <p className="text-xs text-zinc-500 mt-0.5">金額はすべて税抜で入力してください（消費税10%を自動計算します）</p>
        </div>
      </div>

      <div className="bg-white rounded-xl border border-zinc-200 p-6">
        <InvoiceRequestForm
          action={action}
          projects={projects}
          customers={customers}
          submitLabel="更新する"
          defaultValues={{
            subject:          request.subject,
            customerId:       request.customerId,
            contactName:      request.contactName,
            contactEmail:     request.contactEmail,
            billingDate:      request.billingDate.toISOString().slice(0, 10),
            dueDate:          request.dueDate?.toISOString().slice(0, 10) ?? null,
            details:          request.details,
            amountExclTax:    Number(request.amountExclTax),
            inspectionStatus: request.inspectionStatus,
            fileUrl:          request.fileUrl,
            notes:            request.notes,
            projectId:        request.projectId,
          }}
        />
      </div>
    </div>
  );
}
