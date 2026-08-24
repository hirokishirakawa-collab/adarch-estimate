"use client";

import { useState, useTransition } from "react";
import { Check, Trash2 } from "lucide-react";
import { STAGE_OPTIONS, getStage } from "@/lib/constants/group-move";
import { moveStage, touchGroupMove, deleteGroupMove } from "@/lib/actions/group-move";
import { cn } from "@/lib/utils";

interface Props {
  moveId: string;
  stage: string;
}

// ---------------------------------------------------------------
// 段階を1クリックで動かすボタン列。
// 「まだ動いてる」は段階を変えずに日付だけ進める（止まって見えるのを防ぐ）。
// ---------------------------------------------------------------
export function MoveStageBar({ moveId, stage }: Props) {
  const [current, setCurrent] = useState(stage);
  const [gone, setGone] = useState(false);
  const [pending, startTransition] = useTransition();

  if (gone) return null;

  function press(value: string) {
    if (pending || value === current) return;
    startTransition(async () => {
      const res = await moveStage(moveId, value);
      if (res.error) return alert(res.error);
      setCurrent(res.stage ?? current);
    });
  }

  function touch() {
    if (pending) return;
    startTransition(async () => {
      const res = await touchGroupMove(moveId);
      if (res.error) alert(res.error);
    });
  }

  function remove() {
    if (pending) return;
    startTransition(async () => {
      const res = await deleteGroupMove(moveId);
      if (res.error) return alert(res.error);
      setGone(true);
    });
  }

  return (
    <div className="flex items-center gap-1 flex-wrap mt-1.5">
      {STAGE_OPTIONS.map((opt) => {
        const active = current === opt.value;
        return (
          <button
            key={opt.value}
            type="button"
            onClick={() => press(opt.value)}
            disabled={pending}
            title={`段階を「${opt.label}」にする`}
            className={cn(
              "text-[10px] font-bold px-1.5 py-0.5 border rounded transition-colors whitespace-nowrap",
              "disabled:opacity-40 disabled:cursor-not-allowed",
              active ? getStage(opt.value).className : cn("bg-white opacity-60", opt.buttonClassName),
            )}
          >
            {opt.label}
          </button>
        );
      })}
      <button
        type="button"
        onClick={touch}
        disabled={pending}
        title="段階はそのままで「まだ動いている」と印をつける"
        className="text-[10px] px-1.5 py-0.5 border border-zinc-200 rounded text-zinc-500
                   hover:bg-zinc-50 transition-colors disabled:opacity-40 inline-flex items-center gap-0.5"
      >
        <Check className="w-2.5 h-2.5" />まだ動いてる
      </button>
      <button
        type="button"
        onClick={remove}
        disabled={pending}
        title="この動きを消す"
        className="text-[10px] px-1 py-0.5 text-zinc-300 hover:text-red-500 transition-colors disabled:opacity-40"
      >
        <Trash2 className="w-3 h-3" />
      </button>
      {pending && <span className="text-[10px] text-zinc-400">保存中…</span>}
    </div>
  );
}
