import { notFound } from "next/navigation";
import Link from "next/link";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { updateDeal } from "@/lib/actions/deal";
import { DealEditForm } from "@/components/deals/deal-edit-form";
import { ChevronLeft, TrendingUp } from "lucide-react";
import type { UserRole } from "@/types/roles";

interface PageProps {
  params: Promise<{ id: string }>;
}

export default async function EditDealPage({ params }: PageProps) {
  const { id } = await params;

  const session = await auth();
  const role = (session?.user?.role ?? "MANAGER") as UserRole;
  void role; // 将来の権限チェック用

  const deal = await db.deal.findUnique({
    where: { id },
    include: { customer: { select: { name: true } } },
  });

  if (!deal) notFound();

  const boundAction = updateDeal.bind(null, deal.id);

  const defaultValues = {
    title: deal.title,
    status: deal.status,
    amount: deal.amount ? String(Number(deal.amount)) : null,
    probability: deal.probability !== null ? String(deal.probability) : null,
    expectedCloseDate: deal.expectedCloseDate
      ? deal.expectedCloseDate.toISOString().slice(0, 10)
      : null,
    notes: deal.notes,
  };

  return (
    <div className="px-6 py-6 max-w-2xl mx-auto w-full">
      <Link
        href={`/dashboard/deals/${id}`}
        className="inline-flex items-center gap-1 text-xs text-zinc-500 hover:text-zinc-800 transition-colors mb-4"
      >
        <ChevronLeft className="w-3.5 h-3.5" />
        商談詳細に戻る
      </Link>

      <div className="flex items-center gap-3 mb-6">
        <div className="w-9 h-9 bg-blue-50 rounded-xl flex items-center justify-center">
          <TrendingUp className="text-blue-600" style={{ width: "1.125rem", height: "1.125rem" }} />
        </div>
        <div>
          <h2 className="text-lg font-bold text-zinc-900">商談を編集</h2>
          <p className="text-xs text-zinc-500 mt-0.5 truncate max-w-xs">{deal.customer.name}</p>
        </div>
      </div>

      <div className="bg-white rounded-xl border border-zinc-200 p-6">
        <DealEditForm action={boundAction} defaultValues={defaultValues} />
      </div>
    </div>
  );
}
