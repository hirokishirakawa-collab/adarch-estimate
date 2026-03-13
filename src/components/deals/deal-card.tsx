"use client";

import Link from "next/link";
import { useState, useEffect } from "react";
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { GripVertical, User } from "lucide-react";

interface DealCardProps {
  deal: {
    id: string;
    title: string;
    customer: { id: string; name: string; prefecture: string | null };
    assignedTo: { name: string | null } | null;
  };
  isOverlay?: boolean;
  isArchived?: boolean;
  isDuplicate?: boolean;
  /** 同一顧客内での商談番号（1=初回, 2=2件目...）。1件のみの場合は undefined */
  dealIndex?: number;
}

export function DealCard({ deal, isOverlay, isArchived, isDuplicate, dealIndex }: DealCardProps) {
  // ── マウント確認: SSR では attributes を展開しない ──────────────
  // dnd-kit の aria-describedby ID が SSR/CSR でズレるのを防ぐ
  const [mounted, setMounted] = useState(false);
  useEffect(() => { setMounted(true); }, []);

  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: deal.id });

  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.35 : isArchived ? 0.5 : 1,
    filter: isArchived && !isDragging ? "grayscale(0.5)" : undefined,
    zIndex: isDragging ? 999 : "auto",
  };

  // ── 商談番号ラベル ──────────────────────────────────────────────
  const dealIndexLabel = dealIndex !== undefined
    ? dealIndex === 1 ? "初回" : `${dealIndex}件目`
    : null;

  // ── テキスト部分（Link の中身） ──────────────────────────────────
  const textContent = (
    <>
      <p className="text-sm font-bold text-zinc-900 leading-snug line-clamp-2 mb-1">
        {deal.customer.name}
      </p>
      <div className="flex items-center gap-1.5 flex-wrap">
        {dealIndexLabel && (
          <span className="text-[9px] font-medium text-blue-600 bg-blue-50 border border-blue-200 rounded px-1 py-px">
            {dealIndexLabel}
          </span>
        )}
        {deal.title && (
          <span className="text-[10px] text-zinc-400 truncate leading-snug">
            {deal.title}
          </span>
        )}
      </div>
      <div className="flex items-center gap-2 flex-wrap mt-1">
        {deal.assignedTo?.name && (
          <span className="inline-flex items-center gap-0.5 text-[10px] font-medium text-violet-600 bg-violet-50 border border-violet-200 rounded px-1 py-px">
            <User className="w-2.5 h-2.5 flex-shrink-0" />
            {deal.assignedTo.name}
          </span>
        )}
        {deal.customer.prefecture && (
          <span className="text-[10px] text-zinc-400">
            📍 {deal.customer.prefecture}
          </span>
        )}
      </div>
    </>
  );

  return (
    // ── カード外枠: flex で [テキスト | ハンドル] を横並び ──────────
    <div
      ref={setNodeRef}
      style={style}
      {...(mounted ? attributes : {})}
      className="flex items-stretch bg-white rounded-lg border border-zinc-200
                 shadow-sm select-none hover:shadow-md hover:border-zinc-300
                 transition-all overflow-hidden"
    >
      {/* ── テキスト: クリックで詳細へ ─────────────────────────────
          ドラッグハンドルは Link の外にあるため、
          ハンドルをつかんでもナビゲーションは発火しない       ── */}
      {isOverlay ? (
        <div className="flex-1 px-3 py-2.5 min-w-0">
          {textContent}
        </div>
      ) : (
        <Link
          href={`/dashboard/deals/${deal.id}`}
          draggable={false}
          className="flex-1 px-3 py-2.5 min-w-0 block"
        >
          {textContent}
        </Link>
      )}

      {/* ── ドラッグハンドル: Link の外側 (全高ストリップ) ─────────
          listeners は onPointerDown などのイベントハンドラのみ。
          Link と干渉しないため、ここに展開する。              ── */}
      <div
        style={{ touchAction: "none", cursor: isOverlay ? "grabbing" : "grab" }}
        className="w-7 flex-shrink-0 flex items-center justify-center
                   border-l border-zinc-100 hover:bg-zinc-50 transition-colors"
        {...listeners}
      >
        <GripVertical className="w-3.5 h-3.5 text-zinc-300 pointer-events-none" />
      </div>
    </div>
  );
}
