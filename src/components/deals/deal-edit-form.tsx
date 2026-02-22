"use client";

import { useActionState } from "react";
import { Loader2 } from "lucide-react";
import { DEAL_STATUS_OPTIONS } from "@/lib/constants/deals";

interface Props {
  action: (prev: { error?: string } | null, formData: FormData) => Promise<{ error?: string }>;
  defaultValues: {
    title: string;
    status: string;
    amount: string | null;
    probability: string | null;
    expectedCloseDate: string | null;
    notes: string | null;
  };
}

export function DealEditForm({ action, defaultValues }: Props) {
  const [state, formAction, isPending] = useActionState(action, null);

  return (
    <form action={formAction} className="space-y-5">
      {/* 商談タイトル */}
      <div>
        <label className="block text-xs font-semibold text-zinc-700 mb-1.5">
          商談タイトル <span className="text-red-500">*</span>
        </label>
        <input
          type="text"
          name="title"
          defaultValue={defaultValues.title}
          required
          maxLength={200}
          placeholder="例: 株式会社〇〇 動画広告制作"
          className="w-full px-3 py-2.5 text-sm border border-zinc-200 rounded-lg
                     focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
        />
      </div>

      {/* ステータス */}
      <div>
        <label className="block text-xs font-semibold text-zinc-700 mb-1.5">ステータス</label>
        <select
          name="status"
          defaultValue={defaultValues.status}
          className="w-full px-3 py-2.5 text-sm border border-zinc-200 rounded-lg
                     focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white"
        >
          {DEAL_STATUS_OPTIONS.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
      </div>

      {/* 金額・確度 */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label className="block text-xs font-semibold text-zinc-700 mb-1.5">見込み金額（円）</label>
          <input
            type="number"
            name="amount"
            defaultValue={defaultValues.amount ?? ""}
            min={0}
            placeholder="例: 1200000"
            className="w-full px-3 py-2.5 text-sm border border-zinc-200 rounded-lg
                       focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
        </div>
        <div>
          <label className="block text-xs font-semibold text-zinc-700 mb-1.5">受注確度（%）</label>
          <input
            type="number"
            name="probability"
            defaultValue={defaultValues.probability ?? ""}
            min={0}
            max={100}
            placeholder="0〜100"
            className="w-full px-3 py-2.5 text-sm border border-zinc-200 rounded-lg
                       focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
        </div>
      </div>

      {/* 完了予定日 */}
      <div>
        <label className="block text-xs font-semibold text-zinc-700 mb-1.5">完了予定日</label>
        <input
          type="date"
          name="expectedCloseDate"
          defaultValue={defaultValues.expectedCloseDate ?? ""}
          className="w-full px-3 py-2.5 text-sm border border-zinc-200 rounded-lg
                     focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
        />
      </div>

      {/* メモ */}
      <div>
        <label className="block text-xs font-semibold text-zinc-700 mb-1.5">メモ・経緯</label>
        <textarea
          name="notes"
          rows={10}
          defaultValue={defaultValues.notes ?? ""}
          placeholder="商談の経緯・メモを Markdown で記述できます"
          className="w-full px-3 py-2.5 text-sm border border-zinc-200 rounded-lg
                     focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent
                     placeholder:text-zinc-400 resize-y leading-relaxed font-mono"
        />
        <p className="mt-1 text-[11px] text-zinc-400">Markdown が使えます</p>
      </div>

      {state?.error && (
        <p className="text-sm text-red-600 font-medium">{state.error}</p>
      )}

      <div className="flex gap-3 pt-2">
        <button
          type="submit"
          disabled={isPending}
          className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5
                     bg-blue-600 text-white text-sm font-medium rounded-lg
                     hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          {isPending && <Loader2 className="w-4 h-4 animate-spin" />}
          保存する
        </button>
      </div>
    </form>
  );
}
