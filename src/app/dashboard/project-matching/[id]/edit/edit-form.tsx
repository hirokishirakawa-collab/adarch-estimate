"use client";

import { useActionState } from "react";
import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { updateProjectRequest } from "@/lib/actions/project-matching";
import {
  CATEGORY_OPTIONS,
  FREQUENCY_OPTIONS,
  PREFECTURES,
} from "@/lib/constants/project-matching";

type Props = {
  projectRequestId: string;
  defaultValues: {
    title: string;
    description: string;
    category: string;
    frequency: string;
    budget: number | null;
    prefecture: string | null;
    deadline: string;
  };
};

export function EditProjectRequestForm({ projectRequestId, defaultValues }: Props) {
  const router = useRouter();
  const [state, action, isPending] = useActionState(updateProjectRequest, null);

  useEffect(() => {
    if (state && !state.error) {
      router.push(`/dashboard/project-matching/${projectRequestId}`);
    }
  }, [state, router, projectRequestId]);

  return (
    <form action={action} className="space-y-4">
      <input type="hidden" name="projectRequestId" value={projectRequestId} />

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
          defaultValue={defaultValues.title}
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
          defaultValue={defaultValues.description}
          className="w-full rounded-md border border-zinc-300 px-3 py-2 text-sm text-zinc-900 placeholder:text-zinc-400 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none resize-none"
        />
      </div>

      {/* カテゴリ・頻度 */}
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-xs font-medium text-zinc-700 mb-1">
            カテゴリ <span className="text-red-500">*</span>
          </label>
          <select
            name="category"
            required
            defaultValue={defaultValues.category}
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
            defaultValue={defaultValues.frequency}
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
        <div>
          <label className="block text-xs font-medium text-zinc-700 mb-1">
            予算（税抜・円）
          </label>
          <input
            type="number"
            name="budget"
            min="0"
            step="1"
            defaultValue={defaultValues.budget ?? ""}
            placeholder="例: 500000"
            className="w-full rounded-md border border-zinc-300 px-3 py-2 text-sm text-zinc-900 placeholder:text-zinc-400 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none"
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-zinc-700 mb-1">
            エリア
          </label>
          <select
            name="prefecture"
            defaultValue={defaultValues.prefecture ?? ""}
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
          defaultValue={defaultValues.deadline}
          className="w-full rounded-md border border-zinc-300 px-3 py-2 text-sm text-zinc-900 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none"
        />
      </div>

      {/* 送信 */}
      <div className="flex justify-end gap-2 pt-2">
        <button
          type="button"
          onClick={() => router.back()}
          className="inline-flex items-center px-4 py-2 text-sm font-medium text-zinc-700 bg-white border border-zinc-300 rounded-md hover:bg-zinc-50 transition-colors"
        >
          キャンセル
        </button>
        <button
          type="submit"
          disabled={isPending}
          className="inline-flex items-center px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          {isPending ? "更新中..." : "更新する"}
        </button>
      </div>
    </form>
  );
}
