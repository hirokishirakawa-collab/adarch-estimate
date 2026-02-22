"use client";

import { useState, useTransition, useEffect, useId } from "react";
import {
  DndContext,
  DragOverlay,
  MouseSensor,
  TouchSensor,
  useSensor,
  useSensors,
  closestCorners,
  type DragStartEvent,
  type DragEndEvent,
} from "@dnd-kit/core";
import { SortableContext, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { useDroppable } from "@dnd-kit/core";
import { DealCard } from "./deal-card";
import { DEAL_STATUS_OPTIONS } from "@/lib/constants/deals";
import { updateDealStatus } from "@/lib/actions/deal";
import type { DealStatusValue } from "@/lib/constants/deals";
import type { DealStatus, Prisma } from "@/generated/prisma/client";

type Deal = {
  id: string;
  title: string;
  status: DealStatus;
  amount: Prisma.Decimal | null;
  probability: number | null;
  expectedCloseDate: Date | null;
  updatedAt: Date;
  customer: { id: string; name: string; prefecture: string | null };
  assignedTo: { name: string | null } | null;
};

interface Props {
  deals: Deal[];
  showArchived: boolean;
  sevenDaysAgo: Date;
}

// ---------------------------------------------------------------
// カラム
// ---------------------------------------------------------------
function KanbanColumn({
  status,
  label,
  color,
  deals,
  archivedIds,
  showArchived,
}: {
  status: string;
  label: string;
  color: string;
  deals: Deal[];
  archivedIds: Set<string>;
  showArchived: boolean;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: status });

  const activeDeals = showArchived ? deals.filter((d) => !archivedIds.has(d.id)) : deals;
  const archivedDeals = showArchived ? deals.filter((d) => archivedIds.has(d.id)) : [];

  return (
    <div
      className={`flex flex-col min-w-[200px] w-[200px] bg-zinc-50 rounded-xl border transition-colors ${
        isOver ? "border-blue-400 bg-blue-50/40" : "border-zinc-200"
      }`}
    >
      {/* カラムヘッダー */}
      <div className="px-3 py-2.5 border-b border-zinc-200 flex-shrink-0">
        <div className="flex items-center justify-between">
          <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-full border ${color}`}>
            {label}
          </span>
          <span className="text-[11px] text-zinc-400 font-medium">
            {activeDeals.length}
            {archivedDeals.length > 0 && (
              <span className="text-zinc-300 ml-0.5">+{archivedDeals.length}</span>
            )}
          </span>
        </div>
      </div>

      {/* ドロップゾーン */}
      <SortableContext
        items={deals.map((d) => d.id)}
        strategy={verticalListSortingStrategy}
      >
        <div
          ref={setNodeRef}
          className="flex-1 p-2 space-y-2 min-h-[80px]"
        >
          {/* アクティブカード */}
          {activeDeals.map((deal) => (
            <DealCard key={deal.id} deal={deal} />
          ))}

          {/* アーカイブ区切り + アーカイブカード */}
          {archivedDeals.length > 0 && (
            <>
              <div className="flex items-center gap-1.5 py-1">
                <div className="flex-1 h-px bg-zinc-200" />
                <span className="text-[9px] text-zinc-400 uppercase tracking-wider flex-shrink-0">
                  アーカイブ
                </span>
                <div className="flex-1 h-px bg-zinc-200" />
              </div>
              {archivedDeals.map((deal) => (
                <DealCard key={deal.id} deal={deal} isArchived />
              ))}
            </>
          )}
        </div>
      </SortableContext>
    </div>
  );
}

// ---------------------------------------------------------------
// カンバン本体
// ---------------------------------------------------------------
export function DealKanban({ deals: initialDeals, showArchived, sevenDaysAgo }: Props) {
  // useId: React が SSR/CSR 両方で同じ ID を生成する → hydration mismatch ゼロ
  const dndContextId = useId();

  const [mounted, setMounted] = useState(false);
  const [deals, setDeals] = useState<Deal[]>(initialDeals);
  const [activeDeal, setActiveDeal] = useState<Deal | null>(null);
  const [, startTransition] = useTransition();

  useEffect(() => {
    setMounted(true);
  }, []);

  // MouseSensor: PC マウス操作 — activationConstraint.distance で
  //   クリックとドラッグを区別（5px 動かさないと開始しない）
  // TouchSensor: スマホ・タブレット — 150ms 長押しで開始
  const sensors = useSensors(
    useSensor(MouseSensor, {
      activationConstraint: { distance: 5 },
    }),
    useSensor(TouchSensor, {
      activationConstraint: { delay: 150, tolerance: 5 },
    })
  );

  // アーカイブ済み案件の ID セット
  const sevenDaysAgoMs = sevenDaysAgo.getTime();
  const archivedIds = new Set(
    deals
      .filter(
        (d) =>
          (d.status === "CLOSED_WON" || d.status === "CLOSED_LOST") &&
          new Date(d.updatedAt).getTime() < sevenDaysAgoMs
      )
      .map((d) => d.id)
  );

  const dealsByStatus = DEAL_STATUS_OPTIONS.reduce(
    (acc, opt) => {
      acc[opt.value] = deals.filter((d) => d.status === opt.value);
      return acc;
    },
    {} as Record<DealStatusValue, Deal[]>
  );

  // ドラッグ開始 — DragOverlay 用にアクティブカードを記憶
  function handleDragStart(event: DragStartEvent) {
    const deal = deals.find((d) => d.id === String(event.active.id));
    setActiveDeal(deal ?? null);
  }

  // ドラッグ終了 — ターゲットカラムを特定してステータスを更新
  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    setActiveDeal(null);

    if (!over) return;

    const dealId = String(active.id);
    const overId = String(over.id);

    // over.id がカラムのステータス値か確認
    const isColumnDrop = DEAL_STATUS_OPTIONS.some((o) => o.value === overId);

    let targetStatus: DealStatus;
    if (isColumnDrop) {
      // カラムの空き領域にドロップ
      targetStatus = overId as DealStatus;
    } else {
      // 別カードの上にドロップ → そのカードが属するカラムのステータスを使う
      const overDeal = deals.find((d) => d.id === overId);
      if (!overDeal) return;
      targetStatus = overDeal.status;
    }

    const sourceDeal = deals.find((d) => d.id === dealId);
    if (!sourceDeal || sourceDeal.status === targetStatus) return;

    // UI を即座に更新（楽観的）
    const nextDeals = deals.map((d) =>
      d.id === dealId ? { ...d, status: targetStatus, updatedAt: new Date() } : d
    );
    setDeals(nextDeals);

    // サーバーへ反映（バックグラウンド）
    startTransition(() => {
      updateDealStatus(dealId, targetStatus);
    });
  }

  // ドラッグキャンセル
  function handleDragCancel() {
    setActiveDeal(null);
  }

  // DndContext はクライアント専用 — SSR 時はスケルトンを返してハイドレーションミスマッチを防ぐ
  if (!mounted) {
    return (
      <div className="flex gap-3 overflow-x-auto pb-4">
        {DEAL_STATUS_OPTIONS.map((opt) => (
          <div
            key={opt.value}
            className="flex flex-col min-w-[200px] w-[200px] bg-zinc-50 rounded-xl border border-zinc-200"
          >
            <div className="px-3 py-2.5 border-b border-zinc-200">
              <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-full border ${opt.color}`}>
                {opt.label}
              </span>
            </div>
            <div className="flex-1 p-2 space-y-2 min-h-[80px]">
              <div className="h-16 rounded-lg bg-zinc-100 animate-pulse" />
              <div className="h-16 rounded-lg bg-zinc-100 animate-pulse" />
            </div>
          </div>
        ))}
      </div>
    );
  }

  return (
    <DndContext
      id={dndContextId}
      sensors={sensors}
      collisionDetection={closestCorners}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
      onDragCancel={handleDragCancel}
    >
      <div className="flex gap-3 overflow-x-auto pb-4">
        {DEAL_STATUS_OPTIONS.map((opt) => (
          <KanbanColumn
            key={opt.value}
            status={opt.value}
            label={opt.label}
            color={opt.color}
            deals={dealsByStatus[opt.value] ?? []}
            archivedIds={archivedIds}
            showArchived={showArchived}
          />
        ))}
      </div>

      {/* DragOverlay: ドラッグ中に cursor に追従するゴースト */}
      <DragOverlay dropAnimation={null}>
        {activeDeal ? (
          <div className="rotate-1 scale-105 drop-shadow-xl">
            <DealCard deal={activeDeal} isOverlay />
          </div>
        ) : null}
      </DragOverlay>
    </DndContext>
  );
}
