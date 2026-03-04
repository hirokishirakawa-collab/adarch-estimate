"use client";

import { useActionState } from "react";
import { updateGroupCompany } from "@/lib/actions/group-support";
import { PHASE_OPTIONS } from "@/lib/constants/group-support";

interface Props {
  id: string;
  currentMemo: string;
  currentPhase: string;
}

export function GroupCompanyEditForm({
  id,
  currentMemo,
  currentPhase,
}: Props) {
  const [state, formAction, isPending] = useActionState(
    updateGroupCompany,
    null
  );

  return (
    <div className="rounded-lg border border-zinc-200 bg-white p-4 space-y-3">
      <h2 className="text-sm font-semibold text-zinc-900">メモ・フェーズ</h2>
      <form action={formAction} className="space-y-3">
        <input type="hidden" name="id" value={id} />

        <div>
          <label className="block text-[10px] text-zinc-500 mb-1">
            フェーズ
          </label>
          <select
            name="phase"
            defaultValue={currentPhase}
            className="w-full rounded-md border border-zinc-200 bg-white px-2.5 py-1.5 text-xs text-zinc-700 focus:border-blue-500 focus:outline-none"
          >
            {PHASE_OPTIONS.map((p) => (
              <option key={p.value} value={p.value}>
                {p.label}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-[10px] text-zinc-500 mb-1">
            本部メモ
          </label>
          <textarea
            name="memo"
            defaultValue={currentMemo}
            rows={4}
            className="w-full rounded-md border border-zinc-200 bg-white px-2.5 py-1.5 text-xs text-zinc-700 placeholder:text-zinc-400 focus:border-blue-500 focus:outline-none resize-none"
            placeholder="社内メモを記入..."
          />
        </div>

        {state?.error && (
          <p className="text-xs text-red-500">{state.error}</p>
        )}

        <button
          type="submit"
          disabled={isPending}
          className="px-3 py-1.5 rounded-md bg-blue-600 text-white text-xs font-medium hover:bg-blue-500 disabled:opacity-50 transition-colors"
        >
          {isPending ? "保存中..." : "保存"}
        </button>
      </form>
    </div>
  );
}
