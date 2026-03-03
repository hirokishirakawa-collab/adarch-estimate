"use client";

import { useActionState } from "react";
import { requestDisclosure } from "@/lib/actions/disclosure";

export function DisclosureRequestForm({
  businessCardId,
}: {
  businessCardId: string;
}) {
  const [state, formAction, isPending] = useActionState(requestDisclosure, null);

  return (
    <form action={formAction} className="space-y-4">
      <input type="hidden" name="businessCardId" value={businessCardId} />

      <div>
        <label className="block text-xs font-medium text-zinc-700 mb-1">
          開示目的 <span className="text-red-500">*</span>
        </label>
        <textarea
          name="purpose"
          required
          rows={4}
          placeholder="この名刺の秘匿情報が必要な理由を記入してください..."
          className="w-full px-3 py-2 text-xs border border-zinc-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-400 resize-none"
        />
      </div>

      {state?.error && (
        <p className="text-xs text-red-500">{state.error}</p>
      )}

      <button
        type="submit"
        disabled={isPending}
        className="w-full px-4 py-2.5 text-xs font-medium text-white bg-teal-600 rounded-lg hover:bg-teal-700 transition-colors disabled:opacity-50"
      >
        {isPending ? "送信中..." : "開示申請を送信"}
      </button>
    </form>
  );
}
