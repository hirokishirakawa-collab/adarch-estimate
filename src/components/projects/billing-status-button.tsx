"use client";

import { useTransition } from "react";
import { updateBillingStatus } from "@/lib/actions/project";
import type { BillingStatus } from "@/generated/prisma/client";

const BILLING_OPTIONS: { value: BillingStatus; label: string; icon: string; className: string }[] = [
  { value: "UNBILLED", label: "未請求",   icon: "💰", className: "bg-amber-50 text-amber-600 border-amber-200" },
  { value: "BILLED",   label: "請求済み", icon: "📄", className: "bg-zinc-100 text-zinc-600 border-zinc-200" },
  { value: "PAID",     label: "入金済み", icon: "✅", className: "bg-emerald-100 text-emerald-700 border-emerald-200" },
];

interface Props {
  projectId: string;
  billingStatus: BillingStatus;
  isAdmin?: boolean;
}

function BillingBadge({ status }: { status: BillingStatus }) {
  const opt = BILLING_OPTIONS.find((o) => o.value === status) ?? BILLING_OPTIONS[0];
  return (
    <span className={`inline-flex items-center px-2.5 py-1 text-xs font-semibold rounded-full border ${opt.className}`}>
      {opt.icon} {opt.label}
    </span>
  );
}

export { BillingBadge };

export function BillingStatusButton({ projectId, billingStatus, isAdmin = false }: Props) {
  const [pending, startTransition] = useTransition();

  // ADMIN: ドロップダウンで自由に変更可能
  if (isAdmin) {
    return (
      <div className="flex items-center gap-2">
        <BillingBadge status={billingStatus} />
        <select
          value={billingStatus}
          disabled={pending}
          onChange={(e) => {
            const next = e.target.value as BillingStatus;
            if (next !== billingStatus) {
              startTransition(() => updateBillingStatus(projectId, next));
            }
          }}
          className="text-xs border border-zinc-200 rounded-lg px-2 py-1 bg-white text-zinc-700 focus:outline-none focus:ring-2 focus:ring-blue-500/30 disabled:opacity-50"
        >
          {BILLING_OPTIONS.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.icon} {opt.label}
            </option>
          ))}
        </select>
      </div>
    );
  }

  // 一般ユーザー: バッジ表示のみ（変更不可）
  return <BillingBadge status={billingStatus} />;
}
