import { auth } from "@/lib/auth";
import { Suspense } from "react";
import { ListChecks, Upload, Download } from "lucide-react";
import Link from "next/link";
import { db } from "@/lib/db";
import type { LeadStatus, LeadSource } from "@/generated/prisma/client";
import { LEAD_STATUS_OPTIONS } from "@/lib/constants/leads";
import { LeadListTable } from "@/components/leads/lead-list-table";
import { LeadListFilters } from "@/components/leads/lead-list-filters";
import { LeadActivityFeed } from "@/components/leads/lead-activity-feed";
import { CustomerPagination } from "@/components/customers/customer-pagination";
import { LeadDeleteAllButton } from "@/components/leads/lead-delete-all-button";
import { LeadExportButtons } from "@/components/leads/lead-export-buttons";
import { LeadCsvImport } from "@/components/leads/lead-csv-import";
import type { UserRole } from "@/types/roles";
import { FavoriteButton } from "@/components/layout/favorite-button";

const PER_PAGE = 20;

interface PageProps {
  searchParams: Promise<{
    q?: string;
    status?: string;
    assigneeId?: string;
    industry?: string;
    area?: string;
    source?: string;
    sort?: string;
    page?: string;
  }>;
}

export default async function LeadListPage({ searchParams }: PageProps) {
  const session = await auth();
  if (!session?.user) return null;

  const role = (session.user.role ?? "USER") as UserRole;
  const isAdmin = role === "ADMIN";
  const canSelect = true;

  const params = await searchParams;
  const q = params.q?.trim() ?? "";
  const statusParam = params.status ?? "";
  const assigneeIdParam = params.assigneeId ?? "";
  const industryParam = params.industry ?? "";
  const areaParam = params.area ?? "";
  const sourceParam = params.source ?? "";
  const sortParam = params.sort ?? "";
  const page = Math.max(1, parseInt(params.page ?? "1") || 1);

  // ---------------------------------------------------------------
  // WHERE 条件を構築
  // ---------------------------------------------------------------
  // SKIPPED（=TVerプールの「却下」含む）はリード管理から完全に不可視化する。
  // 詳細: memory/feedback_tver_rejected_hidden.md
  type WhereInput = {
    OR?: Array<{
      name?: { contains: string; mode: "insensitive" };
      address?: { contains: string; mode: "insensitive" };
      memo?: { contains: string; mode: "insensitive" };
    }>;
    status?: LeadStatus | { not: LeadStatus };
    assigneeId?: string | null;
    industry?: string;
    area?: { contains: string; mode: "insensitive" };
    source?: LeadSource;
  };

  const where: WhereInput = { status: { not: "SKIPPED" } };
  if (q) {
    where.OR = [
      { name: { contains: q, mode: "insensitive" } },
      { address: { contains: q, mode: "insensitive" } },
      { memo: { contains: q, mode: "insensitive" } },
    ];
  }
  if (statusParam && statusParam !== "SKIPPED") {
    where.status = statusParam as LeadStatus;
  }
  if (assigneeIdParam) {
    where.assigneeId = assigneeIdParam === "unassigned" ? null : assigneeIdParam;
  }
  if (industryParam) where.industry = industryParam;
  if (areaParam) where.area = { contains: areaParam, mode: "insensitive" };
  if (sourceParam) where.source = sourceParam as LeadSource;

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
    db.lead.count({ where: { status: { not: "SKIPPED" } } }),
    db.lead.count({ where: { status: "UNTOUCHED" } }),
    db.lead.count({ where: { status: "CALLED" } }),
    db.lead.count({ where: { status: "APPOINTMENT" } }),
    db.lead.count({ where: { status: "DEAL_CONVERTED" } }),
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
  };

  // SKIPPED はリード管理から不可視化のため、サマリーカード／フィルターから除外する
  const visibleStatusOptions = LEAD_STATUS_OPTIONS.filter((o) => o.value !== "SKIPPED");

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
            <div className="flex items-center gap-1.5">
              <h2 className="text-lg font-bold text-zinc-900">リード管理</h2>
              <FavoriteButton path="/dashboard/leads/list" label="リード管理" />
            </div>
            <p className="text-xs text-zinc-500 mt-0.5">
              リード獲得AIで取得した営業候補のステータス管理
            </p>
          </div>
        </div>
        <div data-tour="lead-list-import" className="flex items-center gap-3">
          <LeadExportButtons />
          {isAdmin && <LeadDeleteAllButton totalCount={totalAll} />}
        </div>
      </div>

      {/* ===== 営業報告インポートバナー ===== */}
      <div className="bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-200 rounded-xl px-5 py-4">
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-10 h-10 bg-blue-100 rounded-xl flex items-center justify-center flex-shrink-0">
              <Upload className="w-5 h-5 text-blue-600" />
            </div>
            <div className="min-w-0">
              <p className="text-sm font-bold text-blue-900">
                ツールを使わずに営業した場合の報告はこちら
              </p>
              <p className="text-xs text-blue-600 mt-0.5">
                訪問営業・電話営業・紹介営業など、OS外で獲得したリードをCSVで一括インポートできます
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 flex-shrink-0">
            <a
              href="/api/leads/import/template"
              download
              className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-medium text-blue-700 bg-white border border-blue-200 rounded-lg hover:bg-blue-50 transition-colors"
            >
              <Download className="w-3.5 h-3.5" />
              テンプレート
            </a>
            <LeadCsvImport />
          </div>
        </div>
      </div>

      {/* ===== サマリーカード ===== */}
      <div data-tour="lead-list-summary" className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        <Link
          href="/dashboard/leads/list"
          className={`rounded-lg border px-4 py-3 transition-all hover:shadow-md ${
            !statusParam
              ? "bg-white border-blue-400 ring-2 ring-blue-200"
              : "bg-white border-zinc-200 hover:border-zinc-300"
          }`}
        >
          <p className="text-[11px] text-zinc-500">総リード数</p>
          <p className="text-xl font-bold text-zinc-900 mt-0.5">
            {totalAll.toLocaleString()}
          </p>
        </Link>
        {visibleStatusOptions.map((opt) => {
          const count = statusCounts[opt.value as keyof typeof statusCounts];
          const isActive = statusParam === opt.value;
          return (
            <Link
              key={opt.value}
              href={`/dashboard/leads/list?status=${opt.value}`}
              className={`rounded-lg border px-4 py-3 transition-all hover:shadow-md ${opt.className} ${
                isActive ? "ring-2 ring-offset-1 ring-current" : ""
              }`}
            >
              <p className="text-[11px] opacity-80">{opt.icon} {opt.label}</p>
              <p className="text-xl font-bold mt-0.5">{count}</p>
            </Link>
          );
        })}
      </div>

      {/* ===== フィルター ===== */}
      <div data-tour="lead-list-filters" className="bg-white rounded-xl border border-zinc-200 px-5 py-4">
        <Suspense>
          <LeadListFilters
            users={users}
            industries={industries.map((i) => i.industry!).filter(Boolean)}
            areas={areas.map((a) => a.area!).filter(Boolean)}
          />
        </Suspense>
      </div>

      {/* ===== テーブル ===== */}
      <div data-tour="lead-list-table">
        <LeadListTable
          leads={leads.map((l) => ({
            ...l,
            scoreBreakdown: l.scoreBreakdown as Record<string, number> | null,
          }))}
          users={users}
          isAdmin={isAdmin}
          canSelect={canSelect}
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

      {/* ===== アクティビティフィード ===== */}
      {recentLogs.length > 0 && (
        <LeadActivityFeed logs={recentLogs} />
      )}
    </div>
  );
}
