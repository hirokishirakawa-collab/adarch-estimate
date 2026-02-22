import Link from "next/link";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { getMockBranchId } from "@/lib/data/customers";
import { DealList } from "@/components/deals/deal-list";
import { DealViewTabs } from "@/components/deals/deal-view-tabs";
import { TrendingUp, Plus } from "lucide-react";
import type { UserRole } from "@/types/roles";
import type { Prisma } from "@/generated/prisma/client";

export default async function DealListPage() {
  const session = await auth();
  const role = (session?.user?.role ?? "MANAGER") as UserRole;
  const email = session?.user?.email ?? "";
  const userBranchId = getMockBranchId(email, role);

  const whereBase: Prisma.DealWhereInput =
    role === "ADMIN" || !userBranchId ? {} : { branchId: userBranchId };

  const deals = await db.deal.findMany({
    where: whereBase,
    include: {
      customer: { select: { id: true, name: true, prefecture: true } },
      assignedTo: { select: { name: true } },
    },
    orderBy: { updatedAt: "desc" },
  });

  return (
    <div className="px-6 py-6 max-w-screen-2xl mx-auto w-full">
      {/* ヘッダー */}
      <div className="flex items-center justify-between mb-6 flex-wrap gap-4">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 bg-blue-50 rounded-xl flex items-center justify-center">
            <TrendingUp
              className="text-blue-600"
              style={{ width: "1.125rem", height: "1.125rem" }}
            />
          </div>
          <div>
            <h2 className="text-lg font-bold text-zinc-900">商談管理 (SFA)</h2>
            <p className="text-xs text-zinc-500 mt-0.5">
              全 {deals.length} 件 — 備考欄をクリックして直接編集できます
            </p>
          </div>
          <DealViewTabs />
        </div>
        <Link
          href="/dashboard/deals/new"
          className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 text-white
                     text-xs font-medium rounded-lg hover:bg-blue-700 transition-colors"
        >
          <Plus className="w-3.5 h-3.5" />
          新規商談
        </Link>
      </div>

      <DealList deals={deals} />
    </div>
  );
}
