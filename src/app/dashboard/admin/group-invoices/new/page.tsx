import { redirect } from "next/navigation";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { auth } from "@/lib/auth";
import type { UserRole } from "@/types/roles";
import { createGroupInvoice, getPartnersForInvoiceSelect } from "@/lib/actions/group-invoice";
import { GroupInvoiceForm } from "../group-invoice-form";

export default async function NewGroupInvoicePage({
  searchParams,
}: {
  searchParams: Promise<{ type?: string; partner?: string; month?: string; amount?: string }>;
}) {
  const session = await auth();
  const role = (session?.user?.role ?? "USER") as UserRole;
  if (role !== "ADMIN") redirect("/dashboard");

  const sp = await searchParams;
  const partners = await getPartnersForInvoiceSelect();

  return (
    <div className="px-6 py-6 max-w-screen-xl mx-auto w-full">
      <Link href="/dashboard/admin/group-invoices" className="inline-flex items-center gap-1.5 text-xs text-zinc-500 hover:text-zinc-800 mb-4 transition-colors">
        <ArrowLeft className="w-3.5 h-3.5" />
        グループ請求書に戻る
      </Link>
      <h2 className="text-lg font-bold text-zinc-900 mb-1">請求書を作成</h2>
      <p className="text-xs text-zinc-500 mb-6">本部 → パートナーへの請求書（適格請求書）を作成します。</p>

      <GroupInvoiceForm
        action={createGroupInvoice}
        partners={partners}
        defaults={{
          type: sp.type,
          groupCompanyId: sp.partner,
          targetMonth: sp.month,
          amount: sp.amount ? parseInt(sp.amount, 10) : undefined,
        }}
      />
    </div>
  );
}
