import Link from "next/link";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { getMockBranchId } from "@/lib/data/customers";
import { DealForm } from "@/components/deals/deal-form";
import { TrendingUp, ChevronLeft } from "lucide-react";
import type { UserRole } from "@/types/roles";

interface PageProps {
  searchParams: Promise<{ customerId?: string }>;
}

export default async function NewDealPage({ searchParams }: PageProps) {
  const { customerId } = await searchParams;

  const session = await auth();
  const role = (session?.user?.role ?? "MANAGER") as UserRole;
  const email = session?.user?.email ?? "";
  const userBranchId = getMockBranchId(email, role);

  const where = role === "ADMIN" || !userBranchId ? {} : { branchId: userBranchId };

  const [customers, users] = await Promise.all([
    db.customer.findMany({
      where,
      select: { id: true, name: true },
      orderBy: { name: "asc" },
    }),
    db.user.findMany({
      where: where.branchId ? { branchId: where.branchId } : {},
      select: { id: true, name: true, email: true },
      orderBy: { name: "asc" },
    }),
  ]);

  return (
    <div className="px-6 py-6 max-w-2xl mx-auto w-full">
      {/* パンくず */}
      <Link
        href="/dashboard/deals"
        className="inline-flex items-center gap-1 text-xs text-zinc-500 hover:text-zinc-800 transition-colors mb-4"
      >
        <ChevronLeft className="w-3.5 h-3.5" />
        商談一覧に戻る
      </Link>

      <div className="flex items-center gap-3 mb-6">
        <div className="w-9 h-9 bg-blue-50 rounded-xl flex items-center justify-center">
          <TrendingUp className="text-blue-600" style={{ width: "1.125rem", height: "1.125rem" }} />
        </div>
        <div>
          <h2 className="text-lg font-bold text-zinc-900">新規商談</h2>
          <p className="text-xs text-zinc-500 mt-0.5">商談情報を入力してください</p>
        </div>
      </div>

      <div className="bg-white rounded-xl border border-zinc-200 p-6">
        <DealForm customers={customers} users={users} preselectedCustomerId={customerId} />
      </div>
    </div>
  );
}
