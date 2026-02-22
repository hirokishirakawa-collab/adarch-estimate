import Link from "next/link";
import { cn } from "@/lib/utils";
import { ESTIMATION_STATUS_OPTIONS } from "@/lib/constants/estimates";
import { ChevronRight, User, Building2 } from "lucide-react";
import { BRANCH_MAP } from "@/lib/data/customers";

export type EstimationRow = {
  id: string;
  title: string;
  status: string;
  estimateDate: Date;
  staffName: string | null;
  branchId: string;
  customer: { id: string; name: string } | null;
  items: { amount: { toNumber(): number } }[];
};

interface Props {
  estimations: EstimationRow[];
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

export function EstimateTable({ estimations }: Props) {
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
            <th className="text-left px-4 py-3 text-xs font-semibold text-zinc-500 min-w-[200px]">タイトル</th>
            <th className="text-left px-4 py-3 text-xs font-semibold text-zinc-500 w-24">ステータス</th>
            <th className="text-left px-4 py-3 text-xs font-semibold text-zinc-500 w-32">顧客</th>
            <th className="text-right px-4 py-3 text-xs font-semibold text-zinc-500 w-32">合計（税抜）</th>
            <th className="text-left px-4 py-3 text-xs font-semibold text-zinc-500 w-28">見積日</th>
            <th className="text-left px-4 py-3 text-xs font-semibold text-zinc-500 w-24">担当者</th>
            <th className="text-left px-4 py-3 text-xs font-semibold text-zinc-500 w-24">拠点</th>
            <th className="w-10" />
          </tr>
        </thead>
        <tbody className="divide-y divide-zinc-100">
          {estimations.map((est) => {
            const subtotal = est.items.reduce((s, it) => s + it.amount.toNumber(), 0);
            const branch = BRANCH_MAP[est.branchId as keyof typeof BRANCH_MAP];
            const dateStr = new Intl.DateTimeFormat("ja-JP", {
              year: "numeric", month: "short", day: "numeric",
            }).format(new Date(est.estimateDate));

            return (
              <tr key={est.id} className="hover:bg-zinc-50 transition-colors">
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
