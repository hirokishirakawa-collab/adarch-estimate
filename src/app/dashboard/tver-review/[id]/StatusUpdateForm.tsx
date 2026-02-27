"use client";

import { useActionState } from "react";
import { Loader2 } from "lucide-react";
import { updateAdvertiserReviewStatus } from "@/lib/actions/advertiser-review";
import { ADVERTISER_REVIEW_STATUS_OPTIONS } from "@/lib/constants/advertiser-review";

const inputCls =
  "w-full px-3 py-2 text-sm border border-zinc-200 rounded-lg " +
  "focus:outline-none focus:ring-2 focus:ring-blue-300 focus:border-blue-400 " +
  "bg-white text-zinc-900";

export function StatusUpdateForm({
  reviewId,
  currentStatus,
  currentReviewNote,
}: {
  reviewId: string;
  currentStatus: string;
  currentReviewNote: string | null;
}) {
  const boundAction = updateAdvertiserReviewStatus.bind(null, reviewId);
  const [state, formAction, isPending] = useActionState(boundAction, null);

  return (
    <form action={formAction} className="space-y-4">
      {state?.error && (
        <div className="px-4 py-3 rounded-lg bg-red-50 border border-red-200 text-sm text-red-700">
          {state.error}
        </div>
      )}

      <div>
        <label className="block text-xs font-semibold text-zinc-700 mb-1.5">
          考査ステータス
        </label>
        <select name="status" defaultValue={currentStatus} className={inputCls}>
          {ADVERTISER_REVIEW_STATUS_OPTIONS.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
      </div>

      <div>
        <label className="block text-xs font-semibold text-zinc-700 mb-1.5">
          審査コメント
          <span className="ml-1.5 text-zinc-400 font-normal text-[11px]">任意</span>
        </label>
        <textarea
          name="reviewNote"
          rows={5}
          defaultValue={currentReviewNote ?? ""}
          placeholder="承認・否決の理由や補足事項を記入してください（申請者にメールで通知されます）"
          className={`${inputCls} resize-y`}
        />
      </div>

      <button
        type="submit"
        disabled={isPending}
        className="inline-flex items-center gap-1.5 px-5 py-2 bg-blue-700 text-white
                   text-sm font-semibold rounded-lg hover:bg-blue-800 disabled:opacity-60
                   transition-colors"
      >
        {isPending && <Loader2 className="w-4 h-4 animate-spin" />}
        審査結果を保存する
      </button>
    </form>
  );
}
