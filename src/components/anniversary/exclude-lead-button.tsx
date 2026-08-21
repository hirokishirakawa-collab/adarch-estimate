"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { rejectLeadFromList } from "@/lib/actions/lead";
import { LEAD_REJECT_REASONS, type LeadRejectReasonValue } from "@/lib/constants/leads";

/**
 * 周年ファインダーの行から、その会社を営業対象の外に置くボタン。
 *
 * 競合（動画制作会社・広告代理店）が並んでしまい、間違って
 * 「周年おめでとうございます」と声をかける事故を防ぐためのもの。
 * 押すと却下扱いになり、リード管理・営業フローからも消える。
 */
export function ExcludeLeadButton({ leadId, leadName }: { leadId: string; leadName: string }) {
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState<LeadRejectReasonValue>("SAME_INDUSTRY");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const router = useRouter();

  function submit() {
    setError(null);
    startTransition(async () => {
      const res = await rejectLeadFromList(leadId, reason);
      if (!res.success) {
        setError(res.error ?? "除外に失敗しました");
        return;
      }
      setOpen(false);
      router.refresh();
    });
  }

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="rounded-lg border border-zinc-200 px-3 py-1.5 text-xs text-zinc-500 hover:bg-rose-50 hover:text-rose-700 hover:border-rose-200"
      >
        営業対象から外す
      </button>
    );
  }

  return (
    <div className="w-full rounded-lg border border-rose-200 bg-rose-50/60 p-3">
      <p className="text-xs text-zinc-700">
        <span className="font-semibold">{leadName}</span> を営業対象から外します。
        <br />
        <span className="text-zinc-500">
          周年ファインダーだけでなく、リード管理・営業フローからも見えなくなります（削除ではないので代表が戻せます）。
        </span>
      </p>
      <div className="mt-2 flex flex-wrap items-center gap-2">
        <select
          value={reason}
          onChange={(e) => setReason(e.target.value as LeadRejectReasonValue)}
          className="rounded-lg border border-zinc-200 bg-white px-2 py-1.5 text-xs text-zinc-900"
        >
          {LEAD_REJECT_REASONS.map((r) => (
            <option key={r.value} value={r.value}>
              {r.icon} {r.label}
            </option>
          ))}
        </select>
        <button
          type="button"
          onClick={submit}
          disabled={pending}
          className="rounded-lg bg-rose-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-rose-700 disabled:opacity-50"
        >
          {pending ? "外しています..." : "外す"}
        </button>
        <button
          type="button"
          onClick={() => { setOpen(false); setError(null); }}
          disabled={pending}
          className="rounded-lg border border-zinc-200 bg-white px-3 py-1.5 text-xs text-zinc-600 hover:bg-zinc-50"
        >
          やめる
        </button>
      </div>
      {error && <p className="mt-2 text-xs text-rose-700">{error}</p>}
    </div>
  );
}
