"use client";

import { useActionState } from "react";
import { applyToProject } from "@/lib/actions/project-matching";

export function ApplicationForm({
  projectRequestId,
}: {
  projectRequestId: string;
}) {
  const [state, action, isPending] = useActionState(applyToProject, null);

  return (
    <form action={action} className="space-y-3">
      <input type="hidden" name="projectRequestId" value={projectRequestId} />

      {state?.error && (
        <div className="rounded-md bg-red-50 border border-red-200 px-3 py-2 text-xs text-red-700">
          {state.error}
        </div>
      )}

      {!state?.error && state !== null && (
        <div className="rounded-md bg-emerald-50 border border-emerald-200 px-3 py-2 text-xs text-emerald-700">
          応募しました
        </div>
      )}

      <div>
        <label className="block text-xs font-medium text-zinc-700 mb-1">
          メッセージ <span className="text-red-500">*</span>
        </label>
        <textarea
          name="message"
          required
          rows={3}
          placeholder="対応できる内容や実績など"
          className="w-full rounded-md border border-zinc-300 px-3 py-2 text-sm text-zinc-900 placeholder:text-zinc-400 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none resize-none"
        />
      </div>

      <div className="flex justify-end">
        <button
          type="submit"
          disabled={isPending}
          className="inline-flex items-center px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          {isPending ? "応募中..." : "応募する"}
        </button>
      </div>
    </form>
  );
}
