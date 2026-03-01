import Link from "next/link";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { getMockBranchId } from "@/lib/data/customers";
import { DealKanban } from "@/components/deals/deal-kanban";
import { ArchiveToggle } from "@/components/deals/archive-toggle";
import { DealViewTabs } from "@/components/deals/deal-view-tabs";
import { TrendingUp, Plus } from "lucide-react";
import type { UserRole } from "@/types/roles";
import type { Prisma, DealStatus } from "@/generated/prisma/client";

interface PageProps {
  searchParams: Promise<{ showArchived?: string }>;
}

// アーカイブ対象（受注・失注のみ）— 休眠・先送りはカンバンに常時表示
const CLOSED_STATUSES: DealStatus[] = ["CLOSED_WON", "CLOSED_LOST"];

export default async function DealsPage({ searchParams }: PageProps) {
  const { showArchived: showArchivedParam } = await searchParams;
  const showArchived = showArchivedParam === "true";

  const session = await auth();
  const role = (session?.user?.role ?? "MANAGER") as UserRole;
  const email = session?.user?.email ?? "";
  const userBranchId = getMockBranchId(email, role);

  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

  const whereBase: Prisma.DealWhereInput =
    role === "ADMIN" || !userBranchId ? {} : { branchId: userBranchId };

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
  });

  const wonCount = deals.filter((d) => d.status === "CLOSED_WON").length;
  const activeCount = deals.filter((d) => !CLOSED_STATUSES.includes(d.status)).length;

  // 受注率・商談総数（全期間・アーカイブ含む）
  const [allWonCount, allLostCount, totalDealCount] = await Promise.all([
    db.deal.count({ where: { ...whereBase, status: "CLOSED_WON" } }).catch(() => 0),
    db.deal.count({ where: { ...whereBase, status: "CLOSED_LOST" } }).catch(() => 0),
    db.deal.count({ where: whereBase }).catch(() => 0),
  ]);
  const winRate =
    allWonCount + allLostCount > 0
      ? Math.round((allWonCount / (allWonCount + allLostCount)) * 100)
      : null;

  return (
    <div className="px-6 py-6 max-w-screen-2xl mx-auto w-full">
      {/* ヘッダー */}
      <div className="flex items-center justify-between mb-6 flex-wrap gap-4">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 bg-blue-50 rounded-xl flex items-center justify-center">
            <TrendingUp className="text-blue-600 w-4.5 h-4.5" style={{ width: "1.125rem", height: "1.125rem" }} />
          </div>
          <div>
            <h2 className="text-lg font-bold text-zinc-900">商談管理 (SFA)</h2>
            <p className="text-xs text-zinc-500 mt-0.5">パイプラインをカンバンで管理</p>
          </div>
          <DealViewTabs />
        </div>
        <div className="flex items-center gap-2">
          <ArchiveToggle showArchived={showArchived} archivedCount={archivedCount} />
          <Link
            href="/dashboard/deals/new"
            className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 text-white text-xs font-medium rounded-lg hover:bg-blue-700 transition-colors"
          >
            <Plus className="w-3.5 h-3.5" />
            新規商談
          </Link>
        </div>
      </div>

      {/* サマリーカード */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
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
          <p className="text-[11px] text-zinc-400 mb-1">受注済み</p>
          <p className="text-xl font-bold text-emerald-600">{wonCount}</p>
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

      {/* カンバンボード */}
      <div className="bg-white rounded-xl border border-zinc-200 p-4">
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
