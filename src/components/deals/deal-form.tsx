"use client";

import { useActionState } from "react";
import { createDeal } from "@/lib/actions/deal";
import { DEAL_STATUS_OPTIONS } from "@/lib/constants/deals";

interface Props {
  customers: { id: string; name: string }[];
  preselectedCustomerId?: string;
}

export function DealForm({ customers, preselectedCustomerId }: Props) {
  const [state, action, pending] = useActionState(createDeal, null);

  return (
    <form action={action} className="space-y-4">
      {state?.error && (
        <div className="px-3 py-2 bg-red-50 border border-red-200 text-red-700 text-xs rounded-lg">
          {state.error}
        </div>
      )}

      {/* タイトル */}
      <div>
        <label className="block text-xs font-medium text-zinc-700 mb-1">
          商談タイトル <span className="text-red-500">*</span>
        </label>
        <input
          name="title"
          type="text"
          placeholder="例: ○○社 Web広告運用支援"
          required
          className="w-full text-sm border border-zinc-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
      </div>

      {/* 顧客 */}
      <div>
        <label className="block text-xs font-medium text-zinc-700 mb-1">
          顧客 <span className="text-red-500">*</span>
        </label>
        <select
          name="customerId"
          required
          defaultValue={preselectedCustomerId ?? ""}
          className="w-full text-sm border border-zinc-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
        >
          <option value="">-- 選択してください --</option>
          {customers.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
      </div>

      {/* ステータス */}
      <div>
        <label className="block text-xs font-medium text-zinc-700 mb-1">ステータス</label>
        <select
          name="status"
          defaultValue="PROSPECTING"
          className="w-full text-sm border border-zinc-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
        >
          {DEAL_STATUS_OPTIONS.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
      </div>

      {/* 金額・確度 */}
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-xs font-medium text-zinc-700 mb-1">見積金額（円）</label>
          <input
            name="amount"
            type="number"
            min="0"
            placeholder="例: 500000"
            className="w-full text-sm border border-zinc-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-zinc-700 mb-1">受注確度（%）</label>
          <input
            name="probability"
            type="number"
            min="0"
            max="100"
            placeholder="例: 70"
            className="w-full text-sm border border-zinc-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
      </div>

      {/* 受注予定日 */}
      <div>
        <label className="block text-xs font-medium text-zinc-700 mb-1">受注予定日</label>
        <input
          name="expectedCloseDate"
          type="date"
          className="w-full text-sm border border-zinc-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
      </div>

      {/* メモ */}
      <div>
        <label className="block text-xs font-medium text-zinc-700 mb-1">メモ</label>
        <textarea
          name="notes"
          rows={3}
          placeholder="商談の経緯・次のアクションなど"
          className="w-full text-sm border border-zinc-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
        />
      </div>

      <div className="flex justify-end">
        <button
          type="submit"
          disabled={pending}
          className="px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors"
        >
          {pending ? "保存中..." : "商談を作成"}
        </button>
      </div>
    </form>
  );
}
