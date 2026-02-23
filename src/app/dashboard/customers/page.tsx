import { auth } from "@/lib/auth";
import Link from "next/link";
import { Suspense } from "react";
import { Plus, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { db } from "@/lib/db";
import { getMockBranchId } from "@/lib/data/customers";
import type { UserRole } from "@/types/roles";
import type { CustomerRank, CustomerStatus } from "@/generated/prisma/client";
import { CustomerSearch } from "@/components/customers/customer-search";
import { CustomerTable } from "@/components/customers/customer-table";
import { CustomerPagination } from "@/components/customers/customer-pagination";

const PER_PAGE = 20;

interface PageProps {
  searchParams: Promise<{
    q?: string;
    rank?: string;
    prefecture?: string;
    status?: string;
    page?: string;
  }>;
}

export default async function CustomersPage({ searchParams }: PageProps) {
  const session = await auth();
  const role = (session?.user?.role ?? "MANAGER") as UserRole;
  const email = session?.user?.email ?? "";
  const userBranchId = getMockBranchId(email, role);

  const params = await searchParams;
  const q          = params.q?.trim() ?? "";
  const rankParam  = params.rank ?? "";
  const prefecture = params.prefecture ?? "";
  const status     = params.status ?? "";
  const page       = Math.max(1, parseInt(params.page ?? "1") || 1);

  // ---------------------------------------------------------------
  // Prisma WHERE 条件を構築
  // ---------------------------------------------------------------
  type WhereInput = {
    OR?: Array<{
      name?: { contains: string; mode: "insensitive" };
      nameKana?: { contains: string; mode: "insensitive" };
      contactName?: { contains: string; mode: "insensitive" };
    }>;
    rank?: CustomerRank;
    prefecture?: string;
    status?: CustomerStatus;
  };

  const where: WhereInput = {};
  if (q) {
    where.OR = [
      { name:        { contains: q, mode: "insensitive" } },
      { nameKana:    { contains: q, mode: "insensitive" } },
      { contactName: { contains: q, mode: "insensitive" } },
    ];
  }
  if (rankParam)  where.rank       = rankParam  as CustomerRank;
  if (prefecture) where.prefecture = prefecture;
  if (status)     where.status     = status     as CustomerStatus;

  // ---------------------------------------------------------------
  // データ取得（フィルタ済みリスト + サマリー統計）
  // ---------------------------------------------------------------
  const [customers, total, totalAll, activeCount, lockedCount] =
    await Promise.all([
      db.customer.findMany({
        where,
        include: {
          deals: { orderBy: { createdAt: "desc" }, take: 1 },
          _count: { select: { deals: true } },
        },
        orderBy: { updatedAt: "desc" },
        skip: (page - 1) * PER_PAGE,
        take: PER_PAGE,
      }).then((rows) =>
        rows.map((c) => ({
          ...c,
          deals: c.deals.map((d) => ({
            ...d,
            amount: d.amount != null ? Number(d.amount) : null,
          })),
        }))
      ),
      db.customer.count({ where }),
      db.customer.count(),
      db.customer.count({ where: { status: "ACTIVE" } }),
      db.customer.count({ where: { lockExpiresAt: { gt: new Date() } } }),
    ]);

  const totalPages = Math.ceil(total / PER_PAGE);
  const hasFilter  = !!(q || rankParam || prefecture || status);

  return (
    <div className="px-6 py-6 space-y-5 max-w-screen-2xl mx-auto w-full">
      {/* ===== ヘッダー ===== */}
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 bg-blue-50 rounded-xl flex items-center justify-center">
            <Users
              className="text-blue-600"
              style={{ width: "1.125rem", height: "1.125rem" }}
            />
          </div>
          <div>
            <h2 className="text-lg font-bold text-zinc-900">顧客管理 (CRM)</h2>
            <p className="text-xs text-zinc-500 mt-0.5">
              全拠点の顧客データを一元表示
              {role !== "ADMIN" && " — 他拠点の商談金額は非表示"}
            </p>
          </div>
        </div>
        <Link href="/dashboard/customers/new">
          <Button size="sm" className="gap-1.5">
            <Plus className="w-3.5 h-3.5" />
            ＋新規顧客を追加
          </Button>
        </Link>
      </div>

      {/* ===== サマリーカード ===== */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="bg-white rounded-lg border border-zinc-200 px-4 py-3">
          <p className="text-[11px] text-zinc-500">総顧客数</p>
          <p className="text-xl font-bold text-zinc-900 mt-0.5">
            {totalAll.toLocaleString()}
          </p>
        </div>
        <div className="bg-white rounded-lg border border-zinc-200 px-4 py-3">
          <p className="text-[11px] text-zinc-500">取引中</p>
          <p className="text-xl font-bold text-emerald-600 mt-0.5">
            {activeCount}
          </p>
        </div>
        <div className="bg-white rounded-lg border border-zinc-200 px-4 py-3">
          <p className="text-[11px] text-zinc-500">先着ロック中</p>
          <p className="text-xl font-bold text-amber-600 mt-0.5">
            {lockedCount}
          </p>
        </div>
        <div className="bg-white rounded-lg border border-zinc-200 px-4 py-3">
          <p className="text-[11px] text-zinc-500">
            {hasFilter ? "絞り込み結果" : "全件"}
          </p>
          <p className="text-xl font-bold text-blue-600 mt-0.5">
            {total.toLocaleString()}
            {hasFilter && (
              <span className="text-xs font-normal text-zinc-400 ml-1">件</span>
            )}
          </p>
        </div>
      </div>

      {/* ===== 検索・フィルター ===== */}
      <div className="bg-white rounded-xl border border-zinc-200 px-5 py-4">
        <Suspense>
          <CustomerSearch />
        </Suspense>
      </div>

      {/* ===== 顧客テーブル ===== */}
      <CustomerTable
        customers={customers}
        userRole={role}
        userBranchId={userBranchId}
      />

      {/* ===== ページネーション ===== */}
      {totalPages > 0 && (
        <Suspense>
          <CustomerPagination
            currentPage={page}
            totalPages={totalPages}
            total={total}
            perPage={PER_PAGE}
          />
        </Suspense>
      )}
    </div>
  );
}
