"use client";

import { useState, useTransition } from "react";
import { OUTREACH_RESULT_OPTIONS, getOutreachResultOption } from "@/lib/constants/outreach-result";
import { recordOutreachResult } from "@/lib/actions/outreach-result";
import { cn } from "@/lib/utils";

interface Props {
  leadId: string;
  /** 現在の結果（null = 返事待ち） */
  result: string | null;
  /** compact = 一覧の行に埋める小さい版 */
  size?: "normal" | "compact";
  /** 見出しを出すか（カード内では出す・一覧では省く） */
  showLabel?: boolean;
}

// ---------------------------------------------------------------
// 送った先の結果を1クリックで入れるボタン列。
// 押すと ①リードに結果を保存 ②ステータス更新 ③グループ事例DBへ自動登録。
// 同じボタンをもう一度押すと取り消して「返事待ち」に戻る。
// ---------------------------------------------------------------
export function OutreachResultBar({ leadId, result, size = "normal", showLabel = true }: Props) {
  const [current, setCurrent] = useState<string | null>(result);
  const [pending, startTransition] = useTransition();
  const compact = size === "compact";

  function press(value: string) {
    if (pending) return;
    startTransition(async () => {
      const res = await recordOutreachResult(leadId, value);
      if (res.error) {
        alert(res.error);
        return;
      }
      setCurrent(res.result ?? null);
    });
  }

  const selected = getOutreachResultOption(current);

  return (
    <div className={cn("flex items-center flex-wrap", compact ? "gap-1" : "gap-1.5")}>
      {showLabel && (
        <span className={cn("font-medium text-zinc-500 mr-0.5", compact ? "text-[10px]" : "text-xs")}>
          結果：
        </span>
      )}
      {OUTREACH_RESULT_OPTIONS.map((opt) => {
        const active = current === opt.value;
        // 結果が入っているときは、選ばれていないボタンを引っ込めて誤爆を減らす
        const dimmed = !!selected && !active;
        return (
          <button
            key={opt.value}
            type="button"
            onClick={() => press(opt.value)}
            disabled={pending}
            title={active ? "もう一度押すと取り消して返事待ちに戻します" : `結果を「${opt.label}」で記録`}
            className={cn(
              "font-bold border rounded transition-colors disabled:opacity-40 disabled:cursor-not-allowed whitespace-nowrap",
              compact ? "text-[10px] px-1.5 py-0.5" : "text-xs px-2 py-1",
              active ? opt.activeClassName : cn("bg-white", opt.className),
              dimmed && "opacity-40",
            )}
          >
            {opt.icon}
            {opt.label}
          </button>
        );
      })}
      {pending && <span className="text-[10px] text-zinc-400">保存中…</span>}
    </div>
  );
}
