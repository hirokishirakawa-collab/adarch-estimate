"use client";

import { useActionState, useRef } from "react";
import { createExpense } from "@/lib/actions/project";
import { EXPENSE_CATEGORY_OPTIONS } from "@/lib/constants/expenses";
import { Loader2, Plus } from "lucide-react";

interface Props {
  projectId: string;
}

export function ExpenseForm({ projectId }: Props) {
  const boundAction = createExpense.bind(null, projectId);
  const [state, formAction, isPending] = useActionState(boundAction, null);
  const formRef = useRef<HTMLFormElement>(null);

  // 成功時にフォームをリセット
  if (state && !state.error && formRef.current) {
    formRef.current.reset();
  }

  // 今日の日付をデフォルト値に
  const today = new Date().toISOString().split("T")[0];

  return (
    <form
      ref={formRef}
      action={formAction}
      className="bg-zinc-50 border border-zinc-200 rounded-xl p-4 space-y-3"
    >
      <p className="text-xs font-semibold text-zinc-600">経費を追加</p>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {/* 経費名 */}
        <div>
          <label className="block text-[11px] text-zinc-500 mb-1">経費名 *</label>
          <input
            type="text"
            name="title"
            required
            placeholder="外注費・材料費など"
            className="w-full text-xs border border-zinc-200 rounded-lg px-3 py-1.5 bg-white text-zinc-700 placeholder:text-zinc-400 focus:outline-none focus:ring-2 focus:ring-blue-500/30"
          />
        </div>

        {/* 金額 */}
        <div>
          <label className="block text-[11px] text-zinc-500 mb-1">金額（円）*</label>
          <input
            type="number"
            name="amount"
            required
            min={1}
            placeholder="100000"
            className="w-full text-xs border border-zinc-200 rounded-lg px-3 py-1.5 bg-white text-zinc-700 placeholder:text-zinc-400 focus:outline-none focus:ring-2 focus:ring-blue-500/30"
          />
        </div>

        {/* カテゴリ */}
        <div>
          <label className="block text-[11px] text-zinc-500 mb-1">カテゴリ</label>
          <select
            name="category"
            defaultValue="OTHER"
            className="w-full text-xs border border-zinc-200 rounded-lg px-3 py-1.5 bg-white text-zinc-700 focus:outline-none focus:ring-2 focus:ring-blue-500/30"
          >
            {EXPENSE_CATEGORY_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.icon} {opt.label}
              </option>
            ))}
          </select>
        </div>

        {/* 発生日 */}
        <div>
          <label className="block text-[11px] text-zinc-500 mb-1">発生日</label>
          <input
            type="date"
            name="date"
            defaultValue={today}
            className="w-full text-xs border border-zinc-200 rounded-lg px-3 py-1.5 bg-white text-zinc-700 focus:outline-none focus:ring-2 focus:ring-blue-500/30"
          />
        </div>
      </div>

      {/* 備考 */}
      <div>
        <label className="block text-[11px] text-zinc-500 mb-1">備考</label>
        <input
          type="text"
          name="notes"
          placeholder="詳細・メモ（任意）"
          className="w-full text-xs border border-zinc-200 rounded-lg px-3 py-1.5 bg-white text-zinc-700 placeholder:text-zinc-400 focus:outline-none focus:ring-2 focus:ring-blue-500/30"
        />
      </div>

      {state?.error && (
        <p className="text-xs text-red-600 bg-red-50 px-3 py-2 rounded-lg border border-red-200">
          {state.error}
        </p>
      )}

      <div className="flex justify-end">
        <button
          type="submit"
          disabled={isPending}
          className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 text-white text-xs font-medium rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors"
        >
          {isPending ? (
            <Loader2 className="w-3.5 h-3.5 animate-spin" />
          ) : (
            <Plus className="w-3.5 h-3.5" />
          )}
          追加
        </button>
      </div>
    </form>
  );
}
