"use client";

import { useActionState } from "react";
import { Loader2 } from "lucide-react";

interface Props {
  action: (prev: { error?: string } | null, formData: FormData) => Promise<{ error?: string }>;
  defaultValues?: {
    amount?: number;
    targetMonth?: string; // "YYYY-MM"
    projectName?: string | null;
    memo?: string | null;
  };
}

export function RevenueReportForm({ action, defaultValues }: Props) {
  const [state, formAction, isPending] = useActionState(action, null);

  return (
    <form action={formAction} className="space-y-5 max-w-xl">
      {state?.error && (
        <div className="px-4 py-3 rounded-lg bg-red-50 border border-red-200 text-sm text-red-700">
          {state.error}
        </div>
      )}

      {/* 金額（税抜） */}
      <div>
        <label className="block text-xs font-semibold text-zinc-700 mb-1.5">
          金額（税抜）<span className="text-red-500 ml-0.5">*</span>
        </label>
        <div className="relative">
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400 text-sm">¥</span>
          <input
            type="number"
            name="amount"
            min={0}
            step={1}
            defaultValue={defaultValues?.amount ?? ""}
            placeholder="0"
            required
            className="w-full pl-7 pr-3 py-2 text-sm border border-zinc-200 rounded-lg
                       focus:outline-none focus:ring-2 focus:ring-blue-300 focus:border-blue-400
                       bg-white text-zinc-900"
          />
        </div>
        <p className="mt-1 text-[11px] text-zinc-400">税抜の売上金額を入力してください</p>
      </div>

      {/* 計上月 */}
      <div>
        <label className="block text-xs font-semibold text-zinc-700 mb-1.5">
          計上月<span className="text-red-500 ml-0.5">*</span>
        </label>
        <input
          type="month"
          name="targetMonth"
          defaultValue={defaultValues?.targetMonth ?? new Date().toISOString().slice(0, 7)}
          required
          className="w-full px-3 py-2 text-sm border border-zinc-200 rounded-lg
                     focus:outline-none focus:ring-2 focus:ring-blue-300 focus:border-blue-400
                     bg-white text-zinc-900"
        />
      </div>

      {/* 関連プロジェクト（自由記述） */}
      <div>
        <label className="block text-xs font-semibold text-zinc-700 mb-1.5">
          関連プロジェクト
        </label>
        <input
          type="text"
          name="projectName"
          defaultValue={defaultValues?.projectName ?? ""}
          placeholder="例: ○○ビル 外壁改修工事"
          maxLength={200}
          className="w-full px-3 py-2 text-sm border border-zinc-200 rounded-lg
                     focus:outline-none focus:ring-2 focus:ring-blue-300 focus:border-blue-400
                     bg-white text-zinc-900"
        />
        <p className="mt-1 text-[11px] text-zinc-400">対象の案件がある場合は自由に記入してください</p>
      </div>

      {/* メモ */}
      <div>
        <label className="block text-xs font-semibold text-zinc-700 mb-1.5">
          メモ・備考
        </label>
        <textarea
          name="memo"
          rows={4}
          defaultValue={defaultValues?.memo ?? ""}
          placeholder="内訳や特記事項を自由に記入してください"
          className="w-full px-3 py-2 text-sm border border-zinc-200 rounded-lg
                     focus:outline-none focus:ring-2 focus:ring-blue-300 focus:border-blue-400
                     bg-white text-zinc-900 resize-y"
        />
      </div>

      {/* 送信ボタン */}
      <div className="flex items-center gap-3 pt-2">
        <button
          type="submit"
          disabled={isPending}
          className="inline-flex items-center gap-1.5 px-5 py-2 bg-blue-600 text-white
                     text-sm font-semibold rounded-lg hover:bg-blue-700 disabled:opacity-60
                     transition-colors"
        >
          {isPending && <Loader2 className="w-4 h-4 animate-spin" />}
          保存する
        </button>
        <a
          href="/dashboard/sales-report"
          className="px-4 py-2 text-sm text-zinc-500 hover:text-zinc-800 transition-colors"
        >
          キャンセル
        </a>
      </div>
    </form>
  );
}
