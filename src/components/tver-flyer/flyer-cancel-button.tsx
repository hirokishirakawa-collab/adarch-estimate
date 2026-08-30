"use client";

import { useState, useTransition } from "react";
import { Loader2 } from "lucide-react";
import { cancelTverFlyerRequest } from "@/lib/actions/tver-flyer";

export function FlyerCancelButton({ requestId }: { requestId: string }) {
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  return (
    <div className="flex items-center gap-3">
      <button
        type="button" disabled={pending}
        onClick={() => start(async () => { const r = await cancelTverFlyerRequest(requestId); if (r.error) setError(r.error); })}
        className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold rounded-lg border border-zinc-200 text-zinc-600 hover:bg-zinc-50 disabled:opacity-60"
      >
        {pending && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
        依頼を取り下げる
      </button>
      {error && <span className="text-xs text-red-600">{error}</span>}
    </div>
  );
}
