import Link from "next/link";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { WikiHelpLink } from "@/components/wiki/wiki-help-link";
import { DealKanban } from "@/components/deals/deal-kanban";
import { DealSearch } from "@/components/deals/deal-search";
import { ArchiveToggle } from "@/components/deals/archive-toggle";
import { DealViewTabs } from "@/components/deals/deal-view-tabs";
import { StalledDealsPanel } from "@/components/deals/stalled-deals-panel";
import { ActivityKpiBar } from "@/components/dashboard/activity-kpi-bar";
import { getActivityKpi } from "@/lib/kpis/activity";
import { DEAL_STATUS_OPTIONS } from "@/lib/constants/deals";
import { TrendingUp, Plus, UserCheck } from "lucide-react";
import { FavoriteButton } from "@/components/layout/favorite-button";
import type { Prisma, DealStatus } from "@/generated/prisma/client";

interface PageProps {
  searchParams: Promise<{ showArchived?: string; mine?: string }>;
}

// アーカイブ対象（受注・失注のみ）— 休眠・先送りはカンバンに常時表示
const CLOSED_STATUSES: DealStatus[] = ["CLOSED_WON", "CLOSED_LOST"];

export default async function DealsPage({ searchParams }: PageProps) {
  const { showArchived: showArchivedParam, mine: mineParam } = await searchParams;
  const showArchived = showArchivedParam === "true";
  const mine = mineParam === "1";

  const session = await auth();
  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

  // ロールに応じた拠点フィルタ
  const role = (session?.user?.role ?? "USER") as string;
  const currentUser = await db.user.findUnique({
    where: { email: session?.user?.email ?? "" },
    select: { id: true, branchId: true },
  });
  const whereBase: Prisma.DealWhereInput = role === "ADMIN" ? {} : { branchId: currentUser?.branchId ?? undefined };
  // 「自分の商談」= 自分が主担当(assignedToId)。サマリー・カンバンとも自分のものに絞る。
  if (mine && currentUser?.id) whereBase.assignedToId = currentUser.id;

  // アーカイブ数 (7日以上前にクローズした案件)
  const archivedCount = await db.deal.count({
    where: {
      ...whereBase,
      status: { in: CLOSED_STATUSES },
      updatedAt: { lt: sevenDaysAgo },
    },
  });

  // メインクエリ: デフォルトはアーカイブ済みを除外
  const where: Prisma.DealWhereInput = showArchived
    ? whereBase
    : {
        ...whereBase,
        OR: [
          { status: { notIn: CLOSED_STATUSES } },
          {
            status: { in: CLOSED_STATUSES },
            updatedAt: { gte: sevenDaysAgo },
          },
        ],
      };

  const deals = await db.deal.findMany({
    where,
    include: {
      customer: { select: { id: true, name: true, prefecture: true } },
      assignedTo: { select: { name: true } },
    },
    orderBy: { updatedAt: "desc" },
    take: 500,
  });

  const wonCount = deals.filter((d) => d.status === "CLOSED_WON").length;
  const activeCount = deals.filter((d) => !CLOSED_STATUSES.includes(d.status)).length;

  // 受注率・商談総数（全期間・アーカイブ含む）
  const [allWonCount, allLostCount, totalDealCount] = await Promise.all([
    db.deal.count({ where: { ...whereBase, status: "CLOSED_WON" as DealStatus } }),
    db.deal.count({ where: { ...whereBase, status: "CLOSED_LOST" as DealStatus } }),
    db.deal.count({ where: whereBase }),
  ]);
  const winRate =
    allWonCount + allLostCount > 0
      ? Math.round((allWonCount / (allWonCount + allLostCount)) * 100)
      : null;

  // ---------------------------------------------------------------
  // 停滞商談: 実商談ステージ(初期声掛け/初回商談/提案中)で
  // 一定日数 更新がないもの。NEGOTIATION(=休眠/先送り)・受注/失注は対象外。
  // ---------------------------------------------------------------
  const STALL_DAYS = 60;
  const now = sevenDaysAgo.getTime() + 7 * 24 * 60 * 60 * 1000; // 既存の基準時刻を再利用（追加のDate呼び出しを避ける）
  const stallThreshold = new Date(now - STALL_DAYS * 24 * 60 * 60 * 1000);
  const ACTIVE_SELLING: DealStatus[] = ["PROSPECTING", "QUALIFYING", "PROPOSAL"];
  const stalledRaw = await db.deal.findMany({
    where: {
      ...whereBase,
      status: { in: ACTIVE_SELLING },
      updatedAt: { lt: stallThreshold },
    },
    include: {
      customer: { select: { name: true } },
      assignedTo: { select: { name: true } },
    },
    orderBy: { updatedAt: "asc" },
    take: 500,
  });
  const stalledDeals = stalledRaw.map((d) => ({
    id: d.id,
    title: d.title,
    customerName: d.customer.name,
    assigneeName: d.assignedTo?.name ?? null,
    status: d.status as string,
    daysStale: Math.floor((now - d.updatedAt.getTime()) / (24 * 60 * 60 * 1000)),
    overdue: d.expectedCloseDate ? d.expectedCloseDate.getTime() < now : false,
  }));

  // 今月の活動KPI（声かけ→商談→受注）
  const activityKpi = await getActivityKpi();

  return (
    <div className="px-6 py-6 max-w-screen-2xl mx-auto w-full">
      {/* ヘッダー */}
      <div className="flex items-center justify-between mb-6 flex-wrap gap-4">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 bg-blue-50 rounded-xl flex items-center justify-center">
            <TrendingUp className="text-blue-600 w-4.5 h-4.5" style={{ width: "1.125rem", height: "1.125rem" }} />
          </div>
          <div>
            <div className="flex items-center gap-1.5">
              <h2 className="text-lg font-bold text-zinc-900">商談管理 (SFA)</h2>
              <FavoriteButton path="/dashboard/deals" label="商談管理" />
            </div>
            <p className="text-xs text-zinc-500 mt-0.5">パイプラインをカンバンで管理</p>
            <WikiHelpLink query="商談管理" />
          </div>
          <div data-tour="deal-view"><DealViewTabs /></div>
        </div>
        <div className="flex items-center gap-2">
          <DealSearch
            deals={deals.map((d) => ({ id: d.id, title: d.title, status: d.status, customer: { name: d.customer.name } }))}
            statusLabels={Object.fromEntries(DEAL_STATUS_OPTIONS.map((o) => [o.value, o.label]))}
          />
          <ArchiveToggle showArchived={showArchived} archivedCount={archivedCount} />
          <Link
            href={mine ? "/dashboard/deals" : "/dashboard/deals?mine=1"}
            className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg transition-colors border ${
              mine
                ? "bg-blue-600 text-white border-blue-600 hover:bg-blue-700"
                : "bg-white text-zinc-700 border-zinc-300 hover:bg-zinc-50"
            }`}
          >
            <UserCheck className="w-3.5 h-3.5" />
            {mine ? "自分の商談のみ" : "自分の商談"}
          </Link>
          <Link
            data-tour="deal-new"
            href="/dashboard/deals/new"
            className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 text-white text-xs font-medium rounded-lg hover:bg-blue-700 transition-colors"
          >
            <Plus className="w-3.5 h-3.5" />
            新規商談
          </Link>
        </div>
      </div>

      {/* 今月の活動KPI */}
      <div className="mb-6">
        <ActivityKpiBar kpi={activityKpi} />
      </div>

      {/* サマリーカード */}
      <div data-tour="deal-summary" className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <div className="bg-white rounded-xl border border-zinc-200 px-4 py-3">
          <div className="flex items-center gap-1.5 mb-1">
            <p className="text-[11px] text-zinc-400">商談総数</p>
            <p className="text-[9px] text-zinc-300">アーカイブ含む</p>
          </div>
          <p className="text-xl font-bold text-zinc-900">{totalDealCount}</p>
        </div>
        <div className="bg-white rounded-xl border border-zinc-200 px-4 py-3">
          <p className="text-[11px] text-zinc-400 mb-1">アクティブ商談</p>
          <p className="text-xl font-bold text-zinc-900">{activeCount}</p>
        </div>
        <div className="bg-white rounded-xl border border-zinc-200 px-4 py-3">
          <div className="flex items-center gap-1.5 mb-1">
            <p className="text-[11px] text-zinc-400">受注済み</p>
            <p className="text-[9px] text-zinc-300">アーカイブ含む</p>
          </div>
          <p className="text-xl font-bold text-emerald-600">{allWonCount}</p>
        </div>
        <div className="bg-white rounded-xl border border-zinc-200 px-4 py-3">
          <div className="flex items-center gap-1.5 mb-1">
            <p className="text-[11px] text-zinc-400">受注率（累計）</p>
            <p className="text-[9px] text-zinc-300">受注後アーカイブ分を含む</p>
          </div>
          <p className="text-xl font-bold text-emerald-600">
            {winRate !== null ? `${winRate}%` : "—"}
          </p>
        </div>
      </div>

      {/* 停滞商談パネル（要対応） */}
      <StalledDealsPanel deals={stalledDeals} thresholdDays={STALL_DAYS} />

      {/* カンバンボード */}
      <div data-tour="deal-kanban" className="bg-white rounded-xl border border-zinc-200 p-4">
        {deals.length === 0 && !showArchived ? (
          <div className="py-20 text-center">
            <p className="text-sm text-zinc-400">商談がありません。</p>
            <Link
              href="/dashboard/deals/new"
              className="mt-3 inline-flex items-center gap-1 text-xs text-blue-600 hover:underline"
            >
              <Plus className="w-3 h-3" /> 最初の商談を作成する
            </Link>
          </div>
        ) : (
          <DealKanban deals={deals} showArchived={showArchived} sevenDaysAgo={sevenDaysAgo} />
        )}
      </div>
    </div>
  );
}
