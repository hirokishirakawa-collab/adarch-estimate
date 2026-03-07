import { CreditCard } from "lucide-react";
import { InvoiceRequestForm } from "@/components/billing/invoice-request-form";
import { createInvoiceRequest, getProjectsForSelect, getCustomersForSelect } from "@/lib/actions/billing";
import { db } from "@/lib/db";
import { EXPENSE_CATEGORY_OPTIONS } from "@/lib/constants/expenses";

interface PageProps {
  searchParams: Promise<{ projectId?: string }>;
}

export default async function NewBillingRequestPage({ searchParams }: PageProps) {
  const { projectId } = await searchParams;

  const [projects, customers] = await Promise.all([
    getProjectsForSelect(),
    getCustomersForSelect(),
  ]);

  // プロジェクトから経費を自動入力
  let defaults: Record<string, string | number | null> | undefined;
  if (projectId) {
    const project = await db.project.findUnique({
      where: { id: projectId },
      select: {
        title: true,
        customerId: true,
        expenses: { orderBy: { date: "asc" }, select: { title: true, amount: true, category: true } },
      },
    });
    if (project) {
      const totalAmount = project.expenses.reduce((sum, e) => sum + Number(e.amount), 0);
      const detailLines = project.expenses.map((e) => {
        const catLabel = EXPENSE_CATEGORY_OPTIONS.find((o) => o.value === e.category)?.label ?? e.category;
        return `${e.title}（${catLabel}） ¥${Number(e.amount).toLocaleString("ja-JP")}`;
      }).join("\n");

      defaults = {
        subject: `${project.title} 請求`,
        projectId,
        customerId: project.customerId,
        amountExclTax: totalAmount,
        details: detailLines,
      };
    }
  }

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
        <InvoiceRequestForm
          action={createInvoiceRequest}
          projects={projects}
          customers={customers}
          defaultValues={defaults as Record<string, string | number | null> | undefined}
        />
      </div>
    </div>
  );
}
