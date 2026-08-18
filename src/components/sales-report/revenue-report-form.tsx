"use client";

import { useActionState } from "react";
import { Loader2 } from "lucide-react";
import { RevenueItemEditor, type ItemDefault } from "./revenue-item-editor";

interface Props {
  action: (prev: { error?: string } | null, formData: FormData) => Promise<{ error?: string }>;
  defaultValues?: {
    targetMonth?: string; // "YYYY-MM"
    staffName?: string | null;
    memo?: string | null;
    currentProjects?: number | null;
    nextMonthProjects?: number | null;
    supportRequest?: string | null;
    items?: ItemDefault[];
  };
}

export function RevenueReportForm({ action, defaultValues }: Props) {
  const [state, formAction, isPending] = useActionState(action, null);

  return (
    <form action={formAction} className="space-y-5">
      {state?.error && (
        <div className="px-4 py-3 rounded-lg bg-red-50 border border-red-200 text-sm text-red-700">
          {state.error}
        </div>
      )}

      {/* 報告月 */}
      <div>
        <label className="block text-xs font-semibold text-zinc-700 mb-1.5">
          報告月<span className="text-red-500 ml-0.5">*</span>
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

      {/* 今の状況 */}
      <div>
        <label className="block text-xs font-semibold text-zinc-700 mb-1.5">
          今の状況<span className="text-red-500 ml-0.5">*</span>
        </label>
        <select
          name="staffName"
          defaultValue={defaultValues?.staffName ?? ""}
          required
          className="w-full px-3 py-2 text-sm border border-zinc-200 rounded-lg
                     focus:outline-none focus:ring-2 focus:ring-blue-300 focus:border-blue-400
                     bg-white text-zinc-900"
        >
          <option value="">選択してください</option>
          <option value="順調に稼働中">順調に稼働中</option>
          <option value="案件を探している">案件を探している</option>
          <option value="別業務で多忙">別業務で多忙</option>
          <option value="体制を見直し中">体制を見直し中</option>
          <option value="その他">その他</option>
        </select>
      </div>

      {/* 今月の案件数 */}
      <div>
        <label className="block text-xs font-semibold text-zinc-700 mb-1.5">
          今月の案件数
        </label>
        <input
          type="number"
          name="currentProjects"
          min={0}
          step={1}
          defaultValue={defaultValues?.currentProjects ?? ""}
          placeholder="0"
          className="w-full px-3 py-2 text-sm border border-zinc-200 rounded-lg
                     focus:outline-none focus:ring-2 focus:ring-blue-300 focus:border-blue-400
                     bg-white text-zinc-900"
        />
        <p className="mt-1 text-[11px] text-zinc-400">進行中・完了含めた案件の合計数</p>
      </div>

      {/* 来月の見込み案件数 */}
      <div>
        <label className="block text-xs font-semibold text-zinc-700 mb-1.5">
          来月の見込み案件数
        </label>
        <input
          type="number"
          name="nextMonthProjects"
          min={0}
          step={1}
          defaultValue={defaultValues?.nextMonthProjects ?? ""}
          placeholder="0"
          className="w-full px-3 py-2 text-sm border border-zinc-200 rounded-lg
                     focus:outline-none focus:ring-2 focus:ring-blue-300 focus:border-blue-400
                     bg-white text-zinc-900"
        />
        <p className="mt-1 text-[11px] text-zinc-400">確定・見込み含めた件数</p>
      </div>

      {/* 売上明細（案件ごと・請求元で分ける） */}
      <div>
        <label className="block text-xs font-semibold text-zinc-700 mb-1.5">
          今月の売上明細
        </label>
        <p className="mb-3 text-[11px] text-zinc-400 leading-relaxed">
          案件ごとに1行で入力してください。請求元（自分で請求／本部から請求）を行ごとに選べます。
          税込は税抜から自動計算されます。売上が0円の月は行を空のまま保存してください。
        </p>
        <RevenueItemEditor defaultItems={defaultValues?.items} />
      </div>

      {/* 本部に相談したいこと */}
      <div>
        <label className="block text-xs font-semibold text-zinc-700 mb-1.5">
          本部に相談したいこと
        </label>
        <select
          name="supportRequest"
          defaultValue={defaultValues?.supportRequest ?? ""}
          className="w-full px-3 py-2 text-sm border border-zinc-200 rounded-lg
                     focus:outline-none focus:ring-2 focus:ring-blue-300 focus:border-blue-400
                     bg-white text-zinc-900"
        >
          <option value="">特になし</option>
          <option value="案件紹介希望">案件紹介してほしい</option>
          <option value="営業支援希望">営業を手伝ってほしい</option>
          <option value="制作支援希望">制作を手伝ってほしい</option>
          <option value="契約相談">契約について相談したい</option>
          <option value="その他相談">その他（補足コメントに記入）</option>
        </select>
      </div>

      {/* 補足コメント */}
      <div>
        <label className="block text-xs font-semibold text-zinc-700 mb-1.5">
          補足コメント
        </label>
        <textarea
          name="memo"
          rows={3}
          defaultValue={defaultValues?.memo ?? ""}
          placeholder="案件の状況、困っていること、本部への相談など自由に記入してください"
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
