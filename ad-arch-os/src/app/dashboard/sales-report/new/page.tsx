import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { getMockBranchId } from "@/lib/data/customers";
import { RevenueReportForm } from "@/components/sales-report/revenue-report-form";
import { createRevenueReport } from "@/lib/actions/sales-report";
import { BarChart2 } from "lucide-react";
import type { UserRole } from "@/types/roles";

export default async function NewSalesReportPage() {
  const session = await auth();
  const role = (session?.user?.role ?? "MANAGER") as UserRole;
  const email = session?.user?.email ?? "";
  getMockBranchId(email, role); // ロール確認のみ

  if (role === "USER") redirect("/dashboard");

  return (
    <div className="px-6 py-6 max-w-2xl mx-auto w-full">
      <div className="flex items-center gap-3 mb-6">
        <div className="w-9 h-9 bg-amber-50 rounded-xl flex items-center justify-center">
          <BarChart2 className="text-amber-600" style={{ width: "1.125rem", height: "1.125rem" }} />
        </div>
        <div>
          <h2 className="text-lg font-bold text-zinc-900">売上を報告する</h2>
          <p className="text-xs text-zinc-500 mt-0.5">金額はすべて税抜で入力してください</p>
        </div>
      </div>

      <div className="bg-white rounded-xl border border-zinc-200 p-6">
        <RevenueReportForm action={createRevenueReport} />
      </div>
    </div>
  );
}
