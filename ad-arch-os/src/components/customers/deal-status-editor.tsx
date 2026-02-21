"use client";

import { useState, useTransition } from "react";
import { Check, Loader2, ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";
import { DEAL_STATUS_OPTIONS } from "@/lib/constants/crm";
import { updateDealStatus } from "@/lib/actions/customer";

interface Props {
  dealId: string;
  customerId: string;
  currentStatus: string;
}

export function DealStatusEditor({ dealId, customerId, currentStatus }: Props) {
  const [status, setStatus] = useState(currentStatus);
  const [saved, setSaved] = useState(false);
  const [isPending, startTransition] = useTransition();

  const current = DEAL_STATUS_OPTIONS.find((o) => o.value === status);

  function handleChange(newStatus: string) {
    setStatus(newStatus);
    setSaved(false);
    startTransition(async () => {
      await updateDealStatus(dealId, customerId, newStatus);
      setSaved(true);
      setTimeout(() => setSaved(false), 2500);
    });
  }

  return (
    <div className="flex items-center gap-2">
      {/* ステータス選択 */}
      <div className="relative inline-flex items-center">
        <select
          value={status}
          onChange={(e) => handleChange(e.target.value)}
          disabled={isPending}
          className={cn(
            "appearance-none pl-2.5 pr-7 py-1 rounded-md text-[11px] font-semibold border cursor-pointer",
            "focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-1",
            "disabled:opacity-60 disabled:cursor-not-allowed transition-colors",
            current?.className ?? "bg-zinc-100 text-zinc-600 border-zinc-200"
          )}
        >
          {DEAL_STATUS_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
        <ChevronDown className="absolute right-1.5 top-1/2 -translate-y-1/2 w-3 h-3 pointer-events-none opacity-60" />
      </div>

      {/* ローディング / 保存済み */}
      {isPending && (
        <Loader2 className="w-3.5 h-3.5 animate-spin text-zinc-400" />
      )}
      {saved && !isPending && (
        <span className="flex items-center gap-0.5 text-[11px] text-emerald-600 font-medium">
          <Check className="w-3 h-3" />
          保存済み
        </span>
      )}
    </div>
  );
}
