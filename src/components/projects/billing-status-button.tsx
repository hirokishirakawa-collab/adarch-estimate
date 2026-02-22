"use client";

import { useTransition } from "react";
import { updateBillingStatus } from "@/lib/actions/project";
import type { BillingStatus } from "@/generated/prisma/client";

interface Props {
  projectId: string;
  billingStatus: BillingStatus;
}

export function BillingStatusButton({ projectId, billingStatus }: Props) {
  const [pending, startTransition] = useTransition();

  if (billingStatus === "PAID") {
    return (
      <span className="inline-flex items-center px-2.5 py-1 text-xs font-semibold rounded-full bg-emerald-100 text-emerald-700 border border-emerald-200">
        ✅ 入金済み
      </span>
    );
  }

  if (billingStatus === "BILLED") {
    return (
      <div className="flex items-center gap-2">
        <span className="inline-flex items-center px-2.5 py-1 text-xs font-semibold rounded-full bg-zinc-100 text-zinc-600 border border-zinc-200">
          📄 請求済み
        </span>
        <button
          onClick={() => startTransition(() => updateBillingStatus(projectId, "PAID"))}
          disabled={pending}
          className="px-3 py-1 text-xs font-medium bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 disabled:opacity-50 transition-colors"
        >
          {pending ? "更新中..." : "入金済みにする"}
        </button>
      </div>
    );
  }

  // UNBILLED
  return (
    <div className="flex items-center gap-2">
      <span className="inline-flex items-center px-2.5 py-1 text-xs font-semibold rounded-full bg-amber-50 text-amber-600 border border-amber-200">
        💰 未請求
      </span>
      <button
        onClick={() => startTransition(() => updateBillingStatus(projectId, "BILLED"))}
        disabled={pending}
        className="px-3 py-1 text-xs font-medium bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors"
      >
        {pending ? "更新中..." : "請求書を発行"}
      </button>
    </div>
  );
}
