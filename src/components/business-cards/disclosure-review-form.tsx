"use client";

import { useActionState } from "react";
import { reviewDisclosure } from "@/lib/actions/disclosure";

export function DisclosureReviewForm({
  requestId,
}: {
  requestId: string;
}) {
  const [state, formAction, isPending] = useActionState(reviewDisclosure, null);

  return (
    <form action={formAction} className="space-y-3">
      <input type="hidden" name="requestId" value={requestId} />

      <div>
        <label className="block text-[10px] font-medium text-zinc-500 mb-1">
          審査コメント（任意）
        </label>
        <textarea
          name="reviewNote"
          rows={2}
          placeholder="コメント..."
          className="w-full px-2 py-1.5 text-xs border border-zinc-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20 resize-none"
        />
      </div>

      {state?.error && (
        <p className="text-xs text-red-500">{state.error}</p>
      )}

      <div className="flex gap-2">
        <button
          type="submit"
          name="action"
          value="APPROVED"
          disabled={isPending}
          className="flex-1 px-3 py-1.5 text-xs font-medium text-white bg-emerald-600 rounded-lg hover:bg-emerald-700 transition-colors disabled:opacity-50"
        >
          承認
        </button>
        <button
          type="submit"
          name="action"
          value="REJECTED"
          disabled={isPending}
          className="flex-1 px-3 py-1.5 text-xs font-medium text-white bg-red-600 rounded-lg hover:bg-red-700 transition-colors disabled:opacity-50"
        >
          却下
        </button>
      </div>
    </form>
  );
}
