import { redirect } from "next/navigation";
import Link from "next/link";
import { auth } from "@/lib/auth";
import { FileText, Plus, TrendingUp } from "lucide-react";
import type { UserRole } from "@/types/roles";
import { getGroupInvoices } from "@/lib/actions/group-invoice";
import { GroupInvoiceTable } from "./group-invoice-table";

export default async function AdminGroupInvoicesPage() {
  const session = await auth();
  const role = (session?.user?.role ?? "USER") as UserRole;
  if (role !== "ADMIN") redirect("/dashboard");

  const invoices = await getGroupInvoices();

  const rows = invoices.map((inv) => ({
    id: inv.id,
    invoiceNo: inv.invoiceNo,
    type: inv.type,
    title: inv.title,
    targetMonth: inv.targetMonth,
    partnerName: inv.groupCompany.name,
    ownerName: inv.groupCompany.ownerName,
    totalInclTax: Number(inv.totalInclTax),
    status: inv.status,
    createdAt: inv.createdAt.toISOString(),
  }));

  const counts = {
    draft: rows.filter((r) => r.status === "DRAFT").length,
    issued: rows.filter((r) => r.status === "ISSUED").length,
    paid: rows.filter((r) => r.status === "PAID").length,
  };

  return (
    <div className="px-6 py-6 max-w-screen-xl mx-auto w-full">
      <div className="flex items-center justify-between mb-6 flex-wrap gap-4">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 bg-indigo-50 rounded-xl flex items-center justify-center">
            <FileText className="text-indigo-600" style={{ width: "1.125rem", height: "1.125rem" }} />
          </div>
          <div>
            <h2 className="text-lg font-bold text-zinc-900">グループ請求書</h2>
            <p className="text-xs text-zinc-500 mt-0.5">本部 → パートナーへの請求（ロイヤリティ・加盟参画費用ほか・ADMIN専用）</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Link
            href="/dashboard/admin/royalty"
            className="flex items-center gap-1.5 px-3 py-1.5 bg-white border border-zinc-200 text-zinc-700 text-xs font-medium rounded-lg hover:bg-zinc-50 transition-colors"
          >
            <TrendingUp className="w-3.5 h-3.5" />
            ロイヤリティ状況
          </Link>
          <Link
            href="/dashboard/admin/group-invoices/new"
            className="flex items-center gap-1.5 px-3 py-1.5 bg-indigo-600 text-white text-xs font-medium rounded-lg hover:bg-indigo-700 transition-colors"
          >
            <Plus className="w-3.5 h-3.5" />
            請求書を作成
          </Link>
        </div>
      </div>

      {/* サマリー */}
      <div className="grid grid-cols-3 gap-3 mb-6">
        <div className="bg-zinc-50 border border-zinc-200 rounded-xl px-4 py-3">
          <p className="text-[11px] text-zinc-500 font-semibold">下書き</p>
          <p className="text-2xl font-bold text-zinc-600">{counts.draft}</p>
        </div>
        <div className="bg-blue-50 border border-zinc-200 rounded-xl px-4 py-3">
          <p className="text-[11px] text-zinc-500 font-semibold">発行済</p>
          <p className="text-2xl font-bold text-blue-700">{counts.issued}</p>
        </div>
        <div className="bg-emerald-50 border border-zinc-200 rounded-xl px-4 py-3">
          <p className="text-[11px] text-zinc-500 font-semibold">入金済</p>
          <p className="text-2xl font-bold text-emerald-700">{counts.paid}</p>
        </div>
      </div>

      <GroupInvoiceTable rows={rows} />
    </div>
  );
}
