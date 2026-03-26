"use client";

import { useActionState, useState } from "react";
import Link from "next/link";
import { ArrowLeft, Loader2, Send } from "lucide-react";
import { createSalesApproach } from "@/lib/actions/sales-approach";
import {
  RESULT_OPTIONS,
  METHOD_OPTIONS,
  INDUSTRY_OPTIONS,
} from "@/lib/constants/sales-approach";

const inputCls =
  "w-full px-3 py-2 text-sm border border-zinc-200 rounded-lg " +
  "focus:outline-none focus:ring-2 focus:ring-blue-300 focus:border-blue-400 " +
  "bg-white text-zinc-900";

interface Props {
  customers: { id: string; name: string; industry: string | null }[];
}

export function ApproachForm({ customers }: Props) {
  const [state, formAction, isPending] = useActionState(createSalesApproach, null);
  const [result, setResult] = useState("");
  const [selectedCustomerId, setSelectedCustomerId] = useState("");

  const selectedCustomer = customers.find((c) => c.id === selectedCustomerId);

  return (
    <div className="px-6 py-6 max-w-2xl mx-auto w-full">
      <Link
        href="/dashboard/sales-approaches"
        className="inline-flex items-center gap-1.5 text-xs text-zinc-500 hover:text-zinc-800 transition-colors mb-4"
      >
        <ArrowLeft className="w-3.5 h-3.5" />一覧に戻る
      </Link>

      <div className="flex items-center gap-3 mb-6">
        <div className="w-9 h-9 bg-teal-50 rounded-xl flex items-center justify-center">
          <Send className="text-teal-700" style={{ width: "1.125rem", height: "1.125rem" }} />
        </div>
        <div>
          <h2 className="text-lg font-bold text-zinc-900">アプローチを投稿</h2>
          <p className="text-xs text-zinc-500 mt-0.5">
            成功も失敗もグループの資産になります
          </p>
        </div>
      </div>

      <form action={formAction} className="bg-white rounded-xl border border-zinc-200 p-6 space-y-5">
        {state?.error && (
          <div className="px-4 py-3 rounded-lg bg-red-50 border border-red-200 text-sm text-red-700">
            {state.error}
          </div>
        )}

        {/* 顧客紐づけ */}
        <div>
          <label className="block text-xs font-semibold text-zinc-700 mb-1.5">
            顧客（登録済みの場合）
            <span className="ml-1.5 text-zinc-400 font-normal text-[11px]">任意</span>
          </label>
          <select
            name="customerId"
            value={selectedCustomerId}
            onChange={(e) => setSelectedCustomerId(e.target.value)}
            className={inputCls}
          >
            <option value="">紐づけなし（自由入力）</option>
            {customers.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}{c.industry ? ` — ${c.industry}` : ""}
              </option>
            ))}
          </select>
        </div>

        <div className="grid grid-cols-2 gap-4">
          {/* 業種 */}
          <div>
            <label className="block text-xs font-semibold text-zinc-700 mb-1.5">
              業種<span className="text-red-500 ml-0.5">*</span>
            </label>
            <select name="industry" required className={inputCls}
              value={selectedCustomer?.industry ?? undefined}
              key={selectedCustomerId}
            >
              <option value="">選択してください</option>
              {INDUSTRY_OPTIONS.map((ind) => (
                <option key={ind} value={ind}>{ind}</option>
              ))}
            </select>
          </div>

          {/* 送信方法 */}
          <div>
            <label className="block text-xs font-semibold text-zinc-700 mb-1.5">
              送信方法<span className="text-red-500 ml-0.5">*</span>
            </label>
            <select name="method" required className={inputCls}>
              <option value="">選択してください</option>
              {METHOD_OPTIONS.map((m) => (
                <option key={m.value} value={m.value}>{m.label}</option>
              ))}
            </select>
          </div>
        </div>

        {/* 送り先の特徴 */}
        <div>
          <label className="block text-xs font-semibold text-zinc-700 mb-1.5">
            送り先の特徴
            <span className="ml-1.5 text-zinc-400 font-normal text-[11px]">任意</span>
          </label>
          <input
            type="text"
            name="targetDesc"
            placeholder="例: 地方のtoC美容院、従業員50名の製造業"
            maxLength={200}
            className={inputCls}
          />
        </div>

        {/* 送信文面 */}
        <div>
          <label className="block text-xs font-semibold text-zinc-700 mb-1.5">
            送信文面<span className="text-red-500 ml-0.5">*</span>
          </label>
          <textarea
            name="messageBody"
            rows={8}
            required
            placeholder="実際に送った文面を貼り付けてください"
            className={`${inputCls} resize-y`}
          />
        </div>

        {/* 結果 */}
        <div>
          <label className="block text-xs font-semibold text-zinc-700 mb-2">
            結果<span className="text-red-500 ml-0.5">*</span>
          </label>
          <div className="grid grid-cols-2 gap-2">
            {RESULT_OPTIONS.map((opt) => (
              <label
                key={opt.value}
                className={`flex items-center gap-2.5 px-3 py-2.5 border rounded-lg cursor-pointer transition-colors
                  ${result === opt.value
                    ? `${opt.className} font-semibold`
                    : "border-zinc-200 text-zinc-600 hover:border-zinc-300"
                  }`}
              >
                <input
                  type="radio"
                  name="result"
                  value={opt.value}
                  required
                  checked={result === opt.value}
                  onChange={() => setResult(opt.value)}
                  className="sr-only"
                />
                <span className="text-sm">{opt.label}</span>
              </label>
            ))}
          </div>
        </div>

        {/* 学び・振り返り */}
        <div>
          <label className="block text-xs font-semibold text-zinc-700 mb-1.5">
            学び・振り返り
            <span className="ml-1.5 text-zinc-400 font-normal text-[11px]">任意</span>
          </label>
          <textarea
            name="learnings"
            rows={3}
            placeholder="なぜ成功/失敗したと思うか、次に活かせる気づきなど"
            className={`${inputCls} resize-y`}
          />
        </div>

        <button
          type="submit"
          disabled={isPending}
          className="inline-flex items-center gap-1.5 px-6 py-2.5 bg-teal-700 text-white
                     text-sm font-semibold rounded-lg hover:bg-teal-800 disabled:opacity-60
                     transition-colors"
        >
          {isPending && <Loader2 className="w-4 h-4 animate-spin" />}
          投稿する
        </button>
      </form>
    </div>
  );
}
