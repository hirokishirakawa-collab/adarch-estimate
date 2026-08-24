"use client";

import { useState, useTransition } from "react";
import { Plus, X, Loader2 } from "lucide-react";
import { addGroupMove } from "@/lib/actions/group-move";
import { STAGE_OPTIONS, METHOD_OPTIONS, BOARD_INDUSTRIES } from "@/lib/constants/group-move";
import { cn } from "@/lib/utils";

const selCls =
  "w-full px-2.5 py-2 text-sm border border-zinc-200 rounded-lg bg-white text-zinc-900 " +
  "focus:outline-none focus:ring-2 focus:ring-teal-300 focus:border-teal-400";

// ---------------------------------------------------------------
// 動きを1件足す。選ぶのは3つ、書くのは一言だけ。
// 商談に載らない動き（紹介・飛び込み・既存客への提案）をここで拾う。
// ---------------------------------------------------------------
export function AddMoveForm() {
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  // 成功したら閉じる。フォームは閉じると外れるので入力欄は自然に空に戻る
  function submit(formData: FormData) {
    startTransition(async () => {
      const res = await addGroupMove(null, formData);
      if (res.error) {
        setError(res.error);
        return;
      }
      setError(null);
      setOpen(false);
    });
  }

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => {
          setError(null);
          setOpen(true);
        }}
        className="flex items-center gap-1.5 px-3 py-1.5 bg-teal-700 text-white
                   text-xs font-medium rounded-lg hover:bg-teal-800 transition-colors"
      >
        <Plus className="w-3.5 h-3.5" />動きを足す
      </button>
    );
  }

  return (
    <div className="w-full bg-white rounded-xl border border-teal-200 p-4">
      <div className="flex items-center justify-between mb-3">
        <p className="text-sm font-bold text-zinc-900">動きを足す</p>
        <button
          type="button"
          onClick={() => setOpen(false)}
          className="text-zinc-400 hover:text-zinc-700 transition-colors"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      <p className="text-[11px] text-zinc-500 mb-3">
        商談に入れていない動き用です。会社名は書かなくて大丈夫です（金額欄はありません）。
      </p>

      {error && (
        <div className="mb-3 px-3 py-2 rounded-lg bg-red-50 border border-red-200 text-xs text-red-700">
          {error}
        </div>
      )}

      <form action={submit} className="space-y-3">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div>
            <label className="block text-[11px] font-semibold text-zinc-700 mb-1">
              業界<span className="text-red-500 ml-0.5">*</span>
            </label>
            <select name="industry" required defaultValue="" className={selCls}>
              <option value="" disabled>選ぶ</option>
              {BOARD_INDUSTRIES.map((i) => (
                <option key={i} value={i}>{i}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-[11px] font-semibold text-zinc-700 mb-1">
              当たり方<span className="text-red-500 ml-0.5">*</span>
            </label>
            <select name="method" required defaultValue="" className={selCls}>
              <option value="" disabled>選ぶ</option>
              {METHOD_OPTIONS.map((m) => (
                <option key={m.value} value={m.value}>{m.label}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-[11px] font-semibold text-zinc-700 mb-1">今どこ</label>
            <select name="stage" defaultValue="APPROACHING" className={selCls}>
              {STAGE_OPTIONS.map((s) => (
                <option key={s.value} value={s.value}>{s.label}</option>
              ))}
            </select>
          </div>
        </div>

        <div>
          <label className="block text-[11px] font-semibold text-zinc-700 mb-1">
            一言<span className="ml-1.5 text-zinc-400 font-normal">任意・120字まで</span>
          </label>
          <input
            type="text"
            name="note"
            maxLength={120}
            placeholder="例: 商工会つながりで3社まとめて。来週デモ"
            className={selCls}
          />
        </div>

        <button
          type="submit"
          disabled={isPending}
          className={cn(
            "w-full sm:w-auto flex items-center justify-center gap-1.5 px-4 py-2",
            "bg-teal-700 text-white text-xs font-medium rounded-lg",
            "hover:bg-teal-800 transition-colors disabled:opacity-50",
          )}
        >
          {isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Plus className="w-3.5 h-3.5" />}
          出す
        </button>
      </form>
    </div>
  );
}
