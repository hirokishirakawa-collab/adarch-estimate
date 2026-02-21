import { auth } from "@/lib/auth";
import { CustomerTable } from "@/components/customers/customer-table";
import { CustomerSearch } from "@/components/customers/customer-search";
import {
  getFilteredCustomers,
  getMockBranchId,
  BRANCH_MAP,
} from "@/lib/data/customers";
import { Button } from "@/components/ui/button";
import { Plus, Users } from "lucide-react";
import type { UserRole } from "@/types/roles";
import { Suspense } from "react";

// ---------------------------------------------------------------
// searchParams の型（Next.js 15: Promise）
// ---------------------------------------------------------------
interface PageProps {
  searchParams: Promise<{ q?: string; branch?: string }>;
}

// ---------------------------------------------------------------
// 顧客一覧ページ
// ---------------------------------------------------------------
export default async function CustomersPage({ searchParams }: PageProps) {
  const session = await auth();
  const role = (session?.user?.role ?? "MANAGER") as UserRole;
  const email = session?.user?.email ?? "";

  // Phase 1: メールからモック branchId を取得
  // Phase 2: DB の users テーブルから取得する
  const userBranchId = getMockBranchId(email, role);

  const params = await searchParams;
  const query = params.q ?? "";
  const branchFilter = params.branch ?? "";

  const customers = getFilteredCustomers({ query, branchFilter });

  // 統計サマリー
  const totalDeals = customers.reduce((sum, c) => sum + c.deals.length, 0);
  const lockedCount = customers.filter((c) => c.lockedByName).length;
  const branchCounts = Object.values(BRANCH_MAP).map((b) => ({
    ...b,
    count: customers.filter((c) => c.branchId === b.id).length,
  }));

  return (
    <div className="px-6 py-6 space-y-5 max-w-screen-2xl mx-auto w-full">
      {/* ヘッダー */}
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 bg-blue-50 rounded-xl flex items-center justify-center">
            <Users className="w-4.5 h-4.5 text-blue-600" style={{ width: "1.125rem", height: "1.125rem" }} />
          </div>
          <div>
            <h2 className="text-lg font-bold text-zinc-900">顧客管理 (CRM)</h2>
            <p className="text-xs text-zinc-500 mt-0.5">
              全拠点の顧客データを一元表示
              {role !== "ADMIN" && " — 他拠点の商談金額は非表示"}
            </p>
          </div>
        </div>
        <Button size="sm" className="gap-1.5">
          <Plus className="w-3.5 h-3.5" />
          顧客登録
        </Button>
      </div>

      {/* サマリーカード */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="bg-white rounded-lg border border-zinc-200 px-4 py-3">
          <p className="text-[11px] text-zinc-500">総顧客数</p>
          <p className="text-xl font-bold text-zinc-900 mt-0.5">{customers.length}</p>
        </div>
        <div className="bg-white rounded-lg border border-zinc-200 px-4 py-3">
          <p className="text-[11px] text-zinc-500">総商談数</p>
          <p className="text-xl font-bold text-zinc-900 mt-0.5">{totalDeals}</p>
        </div>
        <div className="bg-white rounded-lg border border-zinc-200 px-4 py-3">
          <p className="text-[11px] text-zinc-500">先着ロック中</p>
          <p className="text-xl font-bold text-amber-600 mt-0.5">{lockedCount}</p>
        </div>
        <div className="bg-white rounded-lg border border-zinc-200 px-4 py-3">
          <p className="text-[11px] text-zinc-500 mb-1.5">拠点別</p>
          <div className="flex flex-wrap gap-1">
            {branchCounts.map((b) => (
              <span
                key={b.id}
                className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-medium border ${b.badgeClass}`}
              >
                {b.code} {b.count}
              </span>
            ))}
          </div>
        </div>
      </div>

      {/* 検索・フィルター（Client Component） */}
      <Suspense>
        <CustomerSearch />
      </Suspense>

      {/* 顧客テーブル */}
      <CustomerTable
        customers={customers}
        userRole={role}
        userBranchId={userBranchId}
      />
    </div>
  );
}
