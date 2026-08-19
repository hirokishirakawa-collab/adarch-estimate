"use client";

import { useActionState, useEffect, useRef } from "react";
import { replyToWeeklySubmission } from "@/lib/actions/group-support";

interface Props {
  groupCompanyId: string;
  weekId: string;
  ownerName: string;
}

export function WeeklyReplyForm({ groupCompanyId, weekId, ownerName }: Props) {
  const [state, formAction, isPending] = useActionState(
    replyToWeeklySubmission,
    null
  );
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (state?.success) formRef.current?.reset();
  }, [state?.success]);

  return (
    <form ref={formRef} action={formAction} className="space-y-2">
      <input type="hidden" name="groupCompanyId" value={groupCompanyId} />
      <input type="hidden" name="weekId" value={weekId} />

      <label className="block text-[10px] text-zinc-500">
        {ownerName}さんへ返信
      </label>
      <textarea
        name="content"
        rows={3}
        required
        className="w-full rounded-md border border-zinc-200 bg-white px-2.5 py-1.5 text-xs text-zinc-700 placeholder:text-zinc-400 focus:border-blue-500 focus:outline-none resize-none"
        placeholder="この週の共有への返信を書く..."
      />

      {state?.error && <p className="text-xs text-red-500">{state.error}</p>}
      {state?.success && (
        <p className="text-xs text-emerald-600">返信を送りました</p>
      )}

      <div className="flex items-center gap-2">
        <button
          type="submit"
          disabled={isPending}
          className="px-3 py-1.5 rounded-md bg-blue-600 text-white text-xs font-medium hover:bg-blue-500 disabled:opacity-50 transition-colors"
        >
          {isPending ? "送信中..." : "返信する"}
        </button>
        <span className="text-[10px] text-zinc-400">
          スペースには「返信が届きました」だけが流れます
        </span>
      </div>
    </form>
  );
}
