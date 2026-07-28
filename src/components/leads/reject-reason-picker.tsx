"use client";

import { X } from "lucide-react";
import {
  LEAD_REJECT_REASONS,
  type LeadRejectReasonValue,
} from "@/lib/constants/leads";

interface Props {
  /** 理由を選んだとき。この1タップで却下が確定する */
  onPick: (reason: LeadRejectReasonValue) => void;
  /** 理由選択をやめる */
  onCancel: () => void;
  disabled?: boolean;
  /** 一括却下など、対象が複数のときの見出し */
  title?: string;
  /** 横並び（一括操作バー用）か縦並び（カード内用）か */
  layout?: "vertical" | "horizontal";
}

/**
 * 却下理由の5択ピッカー。
 * 「なぜ外したか」はAI判定の学習データになるため、却下は必ずこの1タップを経由させる。
 * 選択肢を増やすと押されなくなるので、5択のまま維持すること。
 */
export function RejectReasonPicker({
  onPick,
  onCancel,
  disabled = false,
  title = "却下の理由は？",
  layout = "vertical",
}: Props) {
  return (
    <div
      className={`bg-white border border-zinc-300 rounded-lg p-2 shadow-sm ${
        layout === "vertical" ? "w-48" : "w-full"
      }`}
    >
      <div className="flex items-center justify-between mb-1.5 px-0.5">
        <span className="text-[10px] font-semibold text-zinc-500">{title}</span>
        <button
          type="button"
          onClick={onCancel}
          className="text-zinc-400 hover:text-zinc-700"
          aria-label="キャンセル"
        >
          <X className="w-3 h-3" />
        </button>
      </div>
      <div
        className={
          layout === "vertical"
            ? "flex flex-col gap-1"
            : "flex flex-wrap gap-1"
        }
      >
        {LEAD_REJECT_REASONS.map((r) => (
          <button
            key={r.value}
            type="button"
            disabled={disabled}
            onClick={() => onPick(r.value)}
            className="text-left text-[11px] font-medium text-zinc-700 bg-zinc-50 hover:bg-red-50 hover:text-red-700 border border-zinc-200 hover:border-red-200 px-2 py-1.5 rounded disabled:opacity-50"
          >
            <span className="mr-1">{r.icon}</span>
            {r.label}
          </button>
        ))}
      </div>
    </div>
  );
}
