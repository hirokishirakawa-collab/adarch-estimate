"use client";

import Link from "next/link";
import { cn } from "@/lib/utils";
import { ESTIMATION_STATUS_OPTIONS } from "@/lib/constants/estimates";
import { ChevronRight, User, Building2, ChevronUp, ChevronDown } from "lucide-react";
import { BRANCH_MAP } from "@/lib/data/customers";

export type EstimationRow = {
  id: string;
  title: string;
  status: string;
  estimateDate: Date;
  staffName: string | null;
  branchId: string;
  projectId: string | null;
  customer: { id: string; name: string } | null;
  items: { amount: number }[];
};

export type SortKey = "title" | "status" | "amount" | "estimateDate";
export type SortDir = "asc" | "desc";

interface Props {
  estimations: EstimationRow[];
  isAdmin: boolean;
  selectedIds: Set<string>;
  onToggle: (id: string) => void;
  onToggleAll: () => void;
  allSelected: boolean;
  someSelected: boolean;
  sortKey: SortKey;
  sortDir: SortDir;
  onSort: (key: SortKey) => void;
}

function StatusBadge({ status }: { status: string }) {
  const opt = ESTIMATION_STATUS_OPTIONS.find((o) => o.value === status);
  if (!opt) return null;
  return (
    <span className={cn("inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold border", opt.className)}>
      {opt.icon} {opt.label}
    </span>
  );
}

function SortHeader({
  label,
  sortKey,
  activeKey,
  dir,
  onSort,
  className,
  align = "left",
}: {
  label: string;
  sortKey: SortKey;
  activeKey: SortKey;
  dir: SortDir;
  onSort: (key: SortKey) => void;
  className?: string;
  align?: "left" | "right";
}) {
  const active = activeKey === sortKey;
  return (
    <th className={cn("px-4 py-3 text-xs font-semibold text-zinc-500", align === "right" ? "text-right" : "text-left", className)}>
      <button
        type="button"
        onClick={() => onSort(sortKey)}
        className={cn("inline-flex items-center gap-1 hover:text-zinc-800 transition-colors", align === "right" && "flex-row-reverse")}
      >
        {label}
        {active && (dir === "asc" ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />)}
      </button>
    </th>
  );
}

export function EstimateTable({
  estimations,
  isAdmin,
  selectedIds,
  onToggle,
  onToggleAll,
  allSelected,
  someSelected,
  sortKey,
  sortDir,
  onSort,
}: Props) {
  if (estimations.length === 0) {
    return (
      <div className="py-16 text-center">
        <p className="text-2xl mb-3">📄</p>
        <p className="text-sm text-zinc-500">見積書がありません</p>
        <p className="text-xs text-zinc-400 mt-1">「＋新規見積書」から作成してください</p>
      </div>
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-zinc-100 bg-zinc-50">
            {isAdmin && (
              <th className="w-10 px-4 py-3">
                <input
                  type="checkbox"
                  aria-label="すべて選択"
                  checked={allSelected}
                  ref={(el) => { if (el) el.indeterminate = someSelected; }}
                  onChange={onToggleAll}
                  className="w-3.5 h-3.5 rounded border-zinc-300 text-blue-600 focus:ring-blue-500/30 cursor-pointer"
                />
              </th>
            )}
            <SortHeader label="タイトル" sortKey="title" activeKey={sortKey} dir={sortDir} onSort={onSort} className="min-w-[200px]" />
            <SortHeader label="ステータス" sortKey="status" activeKey={sortKey} dir={sortDir} onSort={onSort} className="w-24" />
            <th className="text-left px-4 py-3 text-xs font-semibold text-zinc-500 w-32">顧客</th>
            <SortHeader label="合計（税抜）" sortKey="amount" activeKey={sortKey} dir={sortDir} onSort={onSort} className="w-32" align="right" />
            <SortHeader label="見積日" sortKey="estimateDate" activeKey={sortKey} dir={sortDir} onSort={onSort} className="w-28" />
            <th className="text-left px-4 py-3 text-xs font-semibold text-zinc-500 w-24">担当者</th>
            <th className="text-left px-4 py-3 text-xs font-semibold text-zinc-500 w-24">拠点</th>
            <th className="w-10" />
          </tr>
        </thead>
        <tbody className="divide-y divide-zinc-100">
          {estimations.map((est) => {
            const subtotal = est.items.reduce((s, it) => s + it.amount, 0);
            const branch = BRANCH_MAP[est.branchId as keyof typeof BRANCH_MAP];
            const dateStr = new Intl.DateTimeFormat("ja-JP", {
              year: "numeric", month: "short", day: "numeric",
            }).format(new Date(est.estimateDate));
            const isSelected = selectedIds.has(est.id);

            return (
              <tr key={est.id} className={cn("hover:bg-zinc-50 transition-colors", isSelected && "bg-blue-50/50")}>
                {isAdmin && (
                  <td className="px-4 py-3">
                    <input
                      type="checkbox"
                      aria-label={`${est.title} を選択`}
                      checked={isSelected}
                      onChange={() => onToggle(est.id)}
                      className="w-3.5 h-3.5 rounded border-zinc-300 text-blue-600 focus:ring-blue-500/30 cursor-pointer"
                    />
                  </td>
                )}
                <td className="px-4 py-3">
                  <p className="font-medium text-zinc-900 leading-snug">{est.title}</p>
                </td>
                <td className="px-4 py-3">
                  <StatusBadge status={est.status} />
                </td>
                <td className="px-4 py-3">
                  {est.customer ? (
                    <Link
                      href={`/dashboard/customers/${est.customer.id}`}
                      className="text-xs text-blue-600 hover:underline"
                    >
                      {est.customer.name}
                    </Link>
                  ) : (
                    <span className="text-xs text-zinc-400">—</span>
                  )}
                </td>
                <td className="px-4 py-3 text-right">
                  <span className="text-sm font-semibold text-zinc-800 tabular-nums">
                    ¥{subtotal.toLocaleString()}
                  </span>
                </td>
                <td className="px-4 py-3 text-xs text-zinc-600">{dateStr}</td>
                <td className="px-4 py-3">
                  {est.staffName ? (
                    <span className="flex items-center gap-1 text-xs text-zinc-600">
                      <User className="w-3 h-3 text-zinc-400" />
                      {est.staffName}
                    </span>
                  ) : (
                    <span className="text-xs text-zinc-400">—</span>
                  )}
                </td>
                <td className="px-4 py-3">
                  {branch ? (
                    <span className={cn("inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold border", branch.badgeClass)}>
                      <Building2 className="w-2.5 h-2.5" />
                      {branch.name}
                    </span>
                  ) : (
                    <span className="text-xs text-zinc-400">{est.branchId}</span>
                  )}
                </td>
                <td className="px-4 py-3">
                  <Link
                    href={`/dashboard/estimates/${est.id}`}
                    className="flex items-center justify-center w-7 h-7 rounded-lg hover:bg-zinc-100 text-zinc-400 hover:text-zinc-700 transition-colors"
                  >
                    <ChevronRight className="w-4 h-4" />
                  </Link>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
