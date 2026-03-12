"use client";

import { useActionState } from "react";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { createProjectRequestAdmin } from "@/lib/actions/project-matching";
import {
  CATEGORY_OPTIONS,
  FREQUENCY_OPTIONS,
  PREFECTURES,
} from "@/lib/constants/project-matching";

type Company = { id: string; name: string; ownerName: string };

export function AdminProjectRequestForm({
  companies,
}: {
  companies: Company[];
}) {
  const router = useRouter();
  const [state, action, isPending] = useActionState(
    createProjectRequestAdmin,
    null
  );
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (state && !state.error) {
      router.push("/dashboard/project-matching");
    }
  }, [state, router]);

  const toggleCompany = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const selectAll = () => {
    setSelectedIds(new Set(companies.map((c) => c.id)));
  };

  const clearAll = () => {
    setSelectedIds(new Set());
  };

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
        <div>
          <label className="block text-xs font-medium text-zinc-700 mb-1">
            予算（税抜・円）
          </label>
          <input
            type="number"
            name="budget"
            min="0"
            step="1"
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

      {/* 対象企業選択 */}
      <div className="rounded-lg border border-blue-200 bg-blue-50/50 p-4">
        <div className="flex items-center justify-between mb-2">
          <label className="block text-xs font-semibold text-blue-800">
            対象企業を選択（{selectedIds.size}/{companies.length}社）
          </label>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={selectAll}
              className="text-[11px] text-blue-600 hover:underline"
            >
              全選択
            </button>
            <button
              type="button"
              onClick={clearAll}
              className="text-[11px] text-zinc-500 hover:underline"
            >
              全解除
            </button>
          </div>
        </div>
        <p className="text-[11px] text-blue-600 mb-3">
          未選択の場合は全資格企業に通知されます。選択した場合はその企業のみに通知＋自動応募されます。
        </p>
        <div className="grid grid-cols-2 gap-1.5 max-h-64 overflow-y-auto">
          {companies.map((c) => (
            <label
              key={c.id}
              className={`flex items-center gap-2 px-2.5 py-1.5 rounded-md text-xs cursor-pointer transition-colors ${
                selectedIds.has(c.id)
                  ? "bg-blue-100 border border-blue-300"
                  : "bg-white border border-zinc-200 hover:bg-zinc-50"
              }`}
            >
              <input
                type="checkbox"
                name="targetCompanyIds"
                value={c.id}
                checked={selectedIds.has(c.id)}
                onChange={() => toggleCompany(c.id)}
                className="rounded border-zinc-300 text-blue-600 focus:ring-blue-500"
              />
              <span className="truncate">
                {c.name}
                <span className="text-zinc-400 ml-1">({c.ownerName})</span>
              </span>
            </label>
          ))}
        </div>
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
