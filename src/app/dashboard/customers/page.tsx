import { auth } from "@/lib/auth";
import Link from "next/link";
import { Suspense } from "react";
import { Plus, Users, UserCheck, ListChecks, FolderKanban, ArrowRight } from "lucide-react";
import { WikiHelpLink } from "@/components/wiki/wiki-help-link";
import { Button } from "@/components/ui/button";
import { db } from "@/lib/db";
import { getMockBranchId } from "@/lib/data/customers";
import type { UserRole } from "@/types/roles";
import type { CustomerRank, CustomerStatus } from "@/generated/prisma/client";
import { CustomerSearch } from "@/components/customers/customer-search";
import { CustomerTable } from "@/components/customers/customer-table";
import { CustomerPagination } from "@/components/customers/customer-pagination";
import { BulkCustomerImport } from "@/components/customers/bulk-customer-import";
import { FavoriteButton } from "@/components/layout/favorite-button";

const PER_PAGE = 20;

interface PageProps {
  searchParams: Promise<{
    q?: string;
    rank?: string;
    prefecture?: string;
    status?: string;
    locked?: string;
    mine?: string;
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
  const locked     = params.locked ?? "";
  const mine       = params.mine ?? "";
  const page       = Math.max(1, parseInt(params.page ?? "1") || 1);

  // 「自分の顧客」= 登録者(staffName)が自分。staffName は登録時に name ?? email で記録される。
  const myStaffName = session?.user?.name ?? email;

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
    staffName?: string;
  };

  const where: WhereInput = {};
  if (mine === "1") where.staffName = myStaffName;
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
  if (locked === "1") (where as Record<string, unknown>).lockExpiresAt = { gt: new Date() };

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
          lockedBy: { select: { name: true } },
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
  const hasFilter  = !!(q || rankParam || prefecture || status || locked || mine);

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
            <div className="flex items-center gap-1.5">
              <h2 className="text-lg font-bold text-zinc-900">顧客管理 (CRM)</h2>
              <FavoriteButton path="/dashboard/customers" label="顧客管理" />
            </div>
            <p className="text-xs text-zinc-500 mt-0.5">
              全拠点の顧客データを一元表示
              {role !== "ADMIN" && " — 他拠点の商談金額は非表示"}
            </p>
            <WikiHelpLink query="顧客管理" />
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Link href={mine === "1" ? "/dashboard/customers" : "/dashboard/customers?mine=1"}>
            <Button
              size="sm"
              variant={mine === "1" ? "default" : "outline"}
              className="gap-1.5"
            >
              <UserCheck className="w-3.5 h-3.5" />
              {mine === "1" ? "自分の顧客のみ" : "自分の顧客"}
            </Button>
          </Link>
          <BulkCustomerImport />
          <Link data-tour="customer-new" href="/dashboard/customers/new">
            <Button size="sm" className="gap-1.5">
              <Plus className="w-3.5 h-3.5" />
              ＋新規顧客を追加
            </Button>
          </Link>
        </div>
      </div>

      {/* ===== 導線ガイド: リード → 顧客 → プロジェクト ===== */}
      {/* 顧客管理は営業の起点。ここから前後（リード・プロジェクト）へ迷わず動けるようにする。 */}
      <div className="bg-white rounded-xl border border-zinc-200 px-5 py-4">
        <p className="text-[11px] font-semibold text-zinc-500 mb-3">
          案件が前に進む順番 — 顧客管理はこの真ん中にあります
        </p>
        <div className="flex flex-col sm:flex-row sm:items-stretch gap-2">
          <FlowStep
            href="/dashboard/leads/list"
            icon={ListChecks}
            step="①"
            label="リード管理"
            desc="声かけ先を集めて連絡する。手応えのある先は「顧客に転換」を押す"
          />
          <FlowArrow />
          <FlowStep
            icon={Users}
            step="②"
            label="顧客管理（この画面）"
            desc="転換した顧客を登録し、商談管理（SFA）で提案・見積を進める"
            current
          />
          <FlowArrow />
          <FlowStep
            href="/dashboard/projects/new"
            icon={FolderKanban}
            step="③"
            label="プロジェクト登録"
            desc="受注したら登録して制作へ。顧客詳細の「プロジェクト作成」からも登録できる"
          />
        </div>
      </div>

      {/* ===== サマリーカード（クリックでフィルタ） ===== */}
      <div data-tour="customer-summary" className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <Link href="/dashboard/customers" className={`bg-white rounded-lg border px-4 py-3 transition-all hover:shadow-md hover:-translate-y-0.5 ${!hasFilter ? "border-blue-300 ring-1 ring-blue-100" : "border-zinc-200"}`}>
          <p className="text-[11px] text-zinc-500">総顧客数</p>
          <p className="text-xl font-bold text-zinc-900 mt-0.5">
            {totalAll.toLocaleString()}
          </p>
        </Link>
        <Link href="/dashboard/customers?status=ACTIVE" className={`bg-white rounded-lg border px-4 py-3 transition-all hover:shadow-md hover:-translate-y-0.5 ${status === "ACTIVE" ? "border-emerald-300 ring-1 ring-emerald-100" : "border-zinc-200"}`}>
          <p className="text-[11px] text-zinc-500">取引中</p>
          <p className="text-xl font-bold text-emerald-600 mt-0.5">
            {activeCount}
          </p>
        </Link>
        <Link href="/dashboard/customers?locked=1" className={`bg-white rounded-lg border px-4 py-3 transition-all hover:shadow-md hover:-translate-y-0.5 ${locked === "1" ? "border-amber-300 ring-1 ring-amber-100" : "border-zinc-200"}`}>
          <p className="text-[11px] text-zinc-500">先着ロック中</p>
          <p className="text-xl font-bold text-amber-600 mt-0.5">
            {lockedCount}
          </p>
        </Link>
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
      <div data-tour="customer-search" className="bg-white rounded-xl border border-zinc-200 px-5 py-4">
        <Suspense>
          <CustomerSearch />
        </Suspense>
      </div>

      {/* ===== 顧客テーブル ===== */}
      <div data-tour="customer-table">
      <CustomerTable
        customers={customers}
        userRole={role}
        userBranchId={userBranchId}
      />
      </div>

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

// ---------------------------------------------------------------
// 導線ガイドの部品
// ---------------------------------------------------------------
function FlowStep({
  href,
  icon: Icon,
  step,
  label,
  desc,
  current = false,
}: {
  href?: string;
  icon: React.ElementType;
  step: string;
  label: string;
  desc: string;
  current?: boolean;
}) {
  const body = (
    <>
      <div className="flex items-center gap-2">
        <span
          className={`text-xs font-bold ${current ? "text-blue-600" : "text-zinc-400"}`}
        >
          {step}
        </span>
        <Icon
          className={`w-4 h-4 shrink-0 ${
            current ? "text-blue-600" : "text-zinc-400 group-hover:text-blue-600"
          } transition-colors`}
        />
        <p
          className={`text-sm font-semibold ${
            current ? "text-blue-700" : "text-zinc-900 group-hover:text-blue-700"
          } transition-colors`}
        >
          {label}
        </p>
      </div>
      <p className="text-[11px] text-zinc-500 mt-1 leading-snug">{desc}</p>
    </>
  );

  if (!href) {
    return (
      <div className="flex-1 rounded-lg border border-blue-300 bg-blue-50/60 px-4 py-3 ring-1 ring-blue-100">
        {body}
      </div>
    );
  }

  return (
    <Link
      href={href}
      className="group flex-1 rounded-lg border border-zinc-200 bg-white px-4 py-3 transition-all hover:border-blue-300 hover:shadow-sm"
    >
      {body}
    </Link>
  );
}

function FlowArrow() {
  return (
    <div className="flex items-center justify-center shrink-0 rotate-90 sm:rotate-0">
      <ArrowRight className="w-4 h-4 text-zinc-300" />
    </div>
  );
}
