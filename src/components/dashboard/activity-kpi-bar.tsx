import Link from "next/link";
import { Megaphone, MessagesSquare, Trophy, ChevronRight } from "lucide-react";
import type { ActivityKpi } from "@/lib/kpis/activity";

/**
 * 各ダッシュボードのトップに出す「今月の活動」KPIバー。
 * 声かけ → 商談 → 受注 のファネルを件数で表示。個人名は出さない。
 * 非ADMIN には「本部と共有中」バッジを出し、本部が見ている前提を可視化する。
 */
export function ActivityKpiBar({ kpi }: { kpi: ActivityKpi | null }) {
  if (!kpi) return null;

  const items = [
    { icon: Megaphone, label: "声かけ", value: kpi.outreach, color: "text-blue-600" },
    { icon: MessagesSquare, label: "商談", value: kpi.deals, color: "text-indigo-600" },
    { icon: Trophy, label: "受注", value: kpi.won, color: "text-emerald-600" },
  ];

  return (
    <div className="flex items-center justify-between gap-4 rounded-xl border border-zinc-200 bg-white px-4 py-2.5 flex-wrap">
      <div className="flex items-center gap-2 flex-shrink-0">
        <span className="text-[11px] font-semibold text-zinc-500">今月の活動</span>
        {kpi.isAdmin ? (
          <Link
            href="/dashboard/admin/partner-status"
            className="inline-flex items-center gap-0.5 text-[10px] font-medium text-zinc-500 bg-zinc-100 hover:bg-zinc-200 px-2 py-0.5 rounded-full transition-colors"
            title="パートナー稼働管理へ"
          >
            全社集計
            <ChevronRight className="w-2.5 h-2.5" />
          </Link>
        ) : (
          <span
            className="inline-flex items-center gap-1 text-[10px] font-medium text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-full"
            title="この数字は本部と共有されています"
          >
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
            本部と共有中
          </span>
        )}
      </div>

      <div className="flex items-center gap-1 sm:gap-2">
        {items.map((it, i) => (
          <div key={it.label} className="flex items-center gap-1 sm:gap-2">
            <div className="flex items-center gap-1.5 px-2 py-1">
              <it.icon className={`w-3.5 h-3.5 ${it.color}`} />
              <span className="text-[11px] text-zinc-500">{it.label}</span>
              <span className={`text-base font-bold ${it.color}`}>{it.value}</span>
            </div>
            {i < items.length - 1 && (
              <ChevronRight className="w-3 h-3 text-zinc-300" />
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
