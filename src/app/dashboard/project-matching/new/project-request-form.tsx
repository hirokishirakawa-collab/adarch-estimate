"use client";

import { useActionState, useState } from "react";
import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { createProjectRequest } from "@/lib/actions/project-matching";
import {
  CATEGORY_OPTIONS,
  FREQUENCY_OPTIONS,
  PREFECTURES,
} from "@/lib/constants/project-matching";

export function ProjectRequestForm() {
  const router = useRouter();
  const [state, action, isPending] = useActionState(createProjectRequest, null);

  useEffect(() => {
    if (state && !state.error) {
      router.push("/dashboard/project-matching");
    }
  }, [state, router]);

  return (
    <form action={action} className="space-y-4">
      {state?.error && (
        <div className="rounded-md bg-red-50 border border-red-200 px-3 py-2 text-xs text-red-700">
          {state.error}
        </div>
      )}

      {/* 案件名 */}
      <div>
        <label className="block text-xs font-medium text-zinc-700 mb-1">
          案件名 <span className="text-red-500">*</span>
        </label>
        <input
          type="text"
          name="title"
          required
          placeholder="例: 飲食店のPR動画撮影"
          className="w-full rounded-md border border-zinc-300 px-3 py-2 text-sm text-zinc-900 placeholder:text-zinc-400 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none"
        />
      </div>

      {/* 詳細 */}
      <div>
        <label className="block text-xs font-medium text-zinc-700 mb-1">
          詳細 <span className="text-red-500">*</span>
        </label>
        <textarea
          name="description"
          required
          rows={4}
          placeholder="案件の概要、求めるスキル、条件など"
          className="w-full rounded-md border border-zinc-300 px-3 py-2 text-sm text-zinc-900 placeholder:text-zinc-400 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none resize-none"
        />
      </div>

      {/* カテゴリ・レギュラー/単発 */}
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-xs font-medium text-zinc-700 mb-1">
            カテゴリ <span className="text-red-500">*</span>
          </label>
          <select
            name="category"
            required
            className="w-full rounded-md border border-zinc-300 px-3 py-2 text-sm text-zinc-900 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none"
          >
            <option value="">選択してください</option>
            {CATEGORY_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-xs font-medium text-zinc-700 mb-1">
            頻度
          </label>
          <select
            name="frequency"
            className="w-full rounded-md border border-zinc-300 px-3 py-2 text-sm text-zinc-900 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none"
          >
            {FREQUENCY_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* 予算・エリア */}
      <div className="grid grid-cols-2 gap-3">
        <BudgetField />

        <div>
          <label className="block text-xs font-medium text-zinc-700 mb-1">
            エリア
          </label>
          <select
            name="prefecture"
            className="w-full rounded-md border border-zinc-300 px-3 py-2 text-sm text-zinc-900 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none"
          >
            <option value="">指定なし</option>
            {PREFECTURES.map((pref) => (
              <option key={pref} value={pref}>
                {pref}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* 納期 */}
      <div className="max-w-[calc(50%-6px)]">
        <label className="block text-xs font-medium text-zinc-700 mb-1">
          希望納期
        </label>
        <input
          type="date"
          name="deadline"
          className="w-full rounded-md border border-zinc-300 px-3 py-2 text-sm text-zinc-900 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none"
        />
      </div>

      {/* 送信 */}
      <div className="flex justify-end pt-2">
        <button
          type="submit"
          disabled={isPending}
          className="inline-flex items-center px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          {isPending ? "投稿中..." : "案件を投稿する"}
        </button>
      </div>
    </form>
  );
}

function BudgetField() {
  const [budgetType, setBudgetType] = useState<"amount" | "negotiable">("amount");

  return (
    <div>
      <label className="block text-xs font-medium text-zinc-700 mb-1">予算</label>
      <div className="flex gap-2 mb-2">
        <label
          className={`flex-1 flex items-center justify-center gap-1.5 px-2 py-1.5 rounded-md border text-xs cursor-pointer transition-colors
            ${budgetType === "amount"
              ? "border-blue-400 bg-blue-50 text-blue-700 font-semibold"
              : "border-zinc-200 text-zinc-500 hover:border-zinc-300"
            }`}
        >
          <input
            type="radio"
            name="budgetType"
            value="amount"
            checked={budgetType === "amount"}
            onChange={() => setBudgetType("amount")}
            className="sr-only"
          />
          金額を指定
        </label>
        <label
          className={`flex-1 flex items-center justify-center gap-1.5 px-2 py-1.5 rounded-md border text-xs cursor-pointer transition-colors
            ${budgetType === "negotiable"
              ? "border-blue-400 bg-blue-50 text-blue-700 font-semibold"
              : "border-zinc-200 text-zinc-500 hover:border-zinc-300"
            }`}
        >
          <input
            type="radio"
            name="budgetType"
            value="negotiable"
            checked={budgetType === "negotiable"}
            onChange={() => setBudgetType("negotiable")}
            className="sr-only"
          />
          マッチング後相談
        </label>
      </div>
      {budgetType === "amount" ? (
        <input
          type="number"
          name="budget"
          min="0"
          step="1"
          placeholder="例: 500000（税抜・円）"
          className="w-full rounded-md border border-zinc-300 px-3 py-2 text-sm text-zinc-900 placeholder:text-zinc-400 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none"
        />
      ) : (
        <input type="hidden" name="budget" value="" />
      )}
    </div>
  );
}
