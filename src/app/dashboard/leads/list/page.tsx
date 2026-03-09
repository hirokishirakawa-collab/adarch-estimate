import { auth } from "@/lib/auth";
import { Suspense } from "react";
import { ListChecks } from "lucide-react";
import { db } from "@/lib/db";
import type { LeadStatus } from "@/generated/prisma/client";
import { LEAD_STATUS_OPTIONS, getLeadStatusOption } from "@/lib/constants/leads";
import { LeadListTable } from "@/components/leads/lead-list-table";
import { LeadListFilters } from "@/components/leads/lead-list-filters";
import { LeadActivityFeed } from "@/components/leads/lead-activity-feed";
import { CustomerPagination } from "@/components/customers/customer-pagination";
import { LeadDeleteAllButton } from "@/components/leads/lead-delete-all-button";
import type { UserRole } from "@/types/roles";

const PER_PAGE = 20;

interface PageProps {
  searchParams: Promise<{
    q?: string;
    status?: string;
    assigneeId?: string;
    industry?: string;
    area?: string;
    sort?: string;
    page?: string;
  }>;
}

export default async function LeadListPage({ searchParams }: PageProps) {
  const session = await auth();
  if (!session?.user) return null;

  const role = (session.user.role ?? "USER") as UserRole;
  const isAdmin = role === "ADMIN";

  const params = await searchParams;
  const q = params.q?.trim() ?? "";
  const statusParam = params.status ?? "";
  const assigneeIdParam = params.assigneeId ?? "";
  const industryParam = params.industry ?? "";
  const areaParam = params.area ?? "";
  const sortParam = params.sort ?? "";
  const page = Math.max(1, parseInt(params.page ?? "1") || 1);

  // ---------------------------------------------------------------
  // WHERE 条件を構築
  // ---------------------------------------------------------------
  type WhereInput = {
    OR?: Array<{
      name?: { contains: string; mode: "insensitive" };
      address?: { contains: string; mode: "insensitive" };
      memo?: { contains: string; mode: "insensitive" };
    }>;
    status?: LeadStatus;
    assigneeId?: string | null;
    industry?: string;
    area?: { contains: string; mode: "insensitive" };
  };

  const where: WhereInput = {};
  if (q) {
    where.OR = [
      { name: { contains: q, mode: "insensitive" } },
      { address: { contains: q, mode: "insensitive" } },
      { memo: { contains: q, mode: "insensitive" } },
    ];
  }
  if (statusParam) where.status = statusParam as LeadStatus;
  if (assigneeIdParam) {
    where.assigneeId = assigneeIdParam === "unassigned" ? null : assigneeIdParam;
  }
  if (industryParam) where.industry = industryParam;
  if (areaParam) where.area = { contains: areaParam, mode: "insensitive" };

  // ソート
  type OrderBy = { createdAt?: "asc" | "desc"; scoreTotal?: "asc" | "desc"; area?: "asc" | "desc"; industry?: "asc" | "desc" };
  let orderBy: OrderBy = { createdAt: "desc" };
  if (sortParam === "score_desc") orderBy = { scoreTotal: "desc" };
  if (sortParam === "score_asc") orderBy = { scoreTotal: "asc" };
  if (sortParam === "area") orderBy = { area: "asc" };
  if (sortParam === "industry") orderBy = { industry: "asc" };
  if (sortParam === "newest") orderBy = { createdAt: "desc" };
  if (sortParam === "oldest") orderBy = { createdAt: "asc" };

  // ---------------------------------------------------------------
  // データ取得
  // ---------------------------------------------------------------
  const [
    leads,
    total,
    totalAll,
    untouchedCount,
    calledCount,
    appointmentCount,
    dealConvertedCount,
    skippedCount,
    users,
    recentLogs,
    industries,
    areas,
  ] = await Promise.all([
    db.lead.findMany({
      where,
      include: {
        assignee: { select: { id: true, name: true, email: true } },
        convertedCustomer: { select: { id: true, name: true } },
      },
      orderBy,
      skip: (page - 1) * PER_PAGE,
      take: PER_PAGE,
    }),
    db.lead.count({ where }),
    db.lead.count(),
    db.lead.count({ where: { status: "UNTOUCHED" } }),
    db.lead.count({ where: { status: "CALLED" } }),
    db.lead.count({ where: { status: "APPOINTMENT" } }),
    db.lead.count({ where: { status: "DEAL_CONVERTED" } }),
    db.lead.count({ where: { status: "SKIPPED" } }),
    db.user.findMany({
      where: { isActive: true },
      select: { id: true, name: true, email: true },
      orderBy: { name: "asc" },
    }),
    db.leadLog.findMany({
      include: {
        lead: { select: { name: true } },
      },
      orderBy: { createdAt: "desc" },
      take: 20,
    }),
    // 業種・エリアの選択肢を取得
    db.lead.findMany({ select: { industry: true }, distinct: ["industry"], where: { industry: { not: null } }, orderBy: { industry: "asc" } }),
    db.lead.findMany({ select: { area: true }, distinct: ["area"], where: { area: { not: null } }, orderBy: { area: "asc" } }),
  ]);

  const totalPages = Math.ceil(total / PER_PAGE);
  const hasFilter = !!(q || statusParam || assigneeIdParam);

  const statusCounts = {
    UNTOUCHED: untouchedCount,
    CALLED: calledCount,
    APPOINTMENT: appointmentCount,
    DEAL_CONVERTED: dealConvertedCount,
    SKIPPED: skippedCount,
  };

  return (
    <div className="px-6 py-6 space-y-5 max-w-screen-2xl mx-auto w-full">
      {/* ===== ヘッダー ===== */}
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 bg-blue-50 rounded-xl flex items-center justify-center">
            <ListChecks
              className="text-blue-600"
              style={{ width: "1.125rem", height: "1.125rem" }}
            />
          </div>
          <div>
            <h2 className="text-lg font-bold text-zinc-900">リード管理</h2>
            <p className="text-xs text-zinc-500 mt-0.5">
              リード獲得AIで取得した営業候補のステータス管理
            </p>
          </div>
        </div>
        {isAdmin && <LeadDeleteAllButton totalCount={totalAll} />}
      </div>

      {/* ===== サマリーカード ===== */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        <div className="bg-white rounded-lg border border-zinc-200 px-4 py-3">
          <p className="text-[11px] text-zinc-500">総リード数</p>
          <p className="text-xl font-bold text-zinc-900 mt-0.5">
            {totalAll.toLocaleString()}
          </p>
        </div>
        {LEAD_STATUS_OPTIONS.map((opt) => {
          const count = statusCounts[opt.value as keyof typeof statusCounts];
          return (
            <div
              key={opt.value}
              className={`rounded-lg border px-4 py-3 ${opt.className}`}
            >
              <p className="text-[11px] opacity-80">{opt.icon} {opt.label}</p>
              <p className="text-xl font-bold mt-0.5">{count}</p>
            </div>
          );
        })}
      </div>

      {/* ===== フィルター ===== */}
      <div className="bg-white rounded-xl border border-zinc-200 px-5 py-4">
        <Suspense>
          <LeadListFilters
            users={users}
            industries={industries.map((i) => i.industry!).filter(Boolean)}
            areas={areas.map((a) => a.area!).filter(Boolean)}
          />
        </Suspense>
      </div>

      {/* ===== テーブル ===== */}
      <LeadListTable leads={leads} users={users} isAdmin={isAdmin} />

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

      {/* ===== アクティビティフィード ===== */}
      {recentLogs.length > 0 && (
        <LeadActivityFeed logs={recentLogs} />
      )}
    </div>
  );
}
