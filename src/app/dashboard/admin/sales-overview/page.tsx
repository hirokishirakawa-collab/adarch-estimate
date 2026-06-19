import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { Shield, TrendingUp } from "lucide-react";
import type { UserRole } from "@/types/roles";
import type { LeadStatus } from "@/generated/prisma/client";
import { FavoriteButton } from "@/components/layout/favorite-button";

// 本部専用: 代表別の営業数字ダッシュボード。
// 各代表の「探客中 → アプローチ済み → 受注」を横並びで一覧する。
// 個人の数字は本人と本部のみ可視（本ページはADMINガード）。

const APPROACHED: LeadStatus[] = ["CALLED", "APPOINTMENT", "DEAL_CONVERTED"];

export default async function AdminSalesOverviewPage() {
  const session = await auth();
  const role = (session?.user?.role ?? "USER") as UserRole;
  if (role !== "ADMIN") redirect("/dashboard");

  // 集計はN+1を避けてgroupByで一括取得し、ユーザーへ突き合わせる
  const [users, untouchedGroups, approachedGroups, wonGroups] = await Promise.all([
    db.user.findMany({
      where: { isActive: true },
      select: { id: true, name: true, email: true, branchId: true },
      orderBy: { name: "asc" },
    }),
    db.lead.groupBy({
      by: ["assigneeId"],
      where: { assigneeId: { not: null }, status: "UNTOUCHED" },
      _count: { _all: true },
    }),
    db.lead.groupBy({
      by: ["assigneeId"],
      where: { assigneeId: { not: null }, status: { in: APPROACHED } },
      _count: { _all: true },
    }),
    db.deal.groupBy({
      by: ["assignedToId"],
      where: { assignedToId: { not: null }, status: "CLOSED_WON" },
      _count: { _all: true },
    }),
  ]);

  const countBy = (
    groups: { assigneeId: string | null; _count: { _all: number } }[]
  ): Map<string, number> => {
    const m = new Map<string, number>();
    for (const g of groups) if (g.assigneeId) m.set(g.assigneeId, g._count._all);
    return m;
  };
  const untouchedMap = countBy(untouchedGroups);
  const approachedMap = countBy(approachedGroups);
  const wonMap = new Map<string, number>();
  for (const g of wonGroups) if (g.assignedToId) wonMap.set(g.assignedToId, g._count._all);

  const rows = users
    .map((u) => ({
      id: u.id,
      name: u.name ?? u.email ?? "（名称未設定）",
      prospecting: untouchedMap.get(u.id) ?? 0,
      approached: approachedMap.get(u.id) ?? 0,
      won: wonMap.get(u.id) ?? 0,
    }))
    // 動いている代表が上に来るよう、受注→アプローチ→探客の順で降順
    .sort((a, b) => b.won - a.won || b.approached - a.approached || b.prospecting - a.prospecting);

  const totals = rows.reduce(
    (acc, r) => ({
      prospecting: acc.prospecting + r.prospecting,
      approached: acc.approached + r.approached,
      won: acc.won + r.won,
    }),
    { prospecting: 0, approached: 0, won: 0 }
  );
  const activeReps = rows.filter((r) => r.approached > 0 || r.won > 0).length;

  return (
    <div className="px-6 py-6 space-y-5 max-w-screen-2xl mx-auto w-full">
      {/* ヘッダー */}
      <div className="flex items-start gap-3">
        <div className="w-9 h-9 bg-amber-50 rounded-xl flex items-center justify-center shrink-0">
          <Shield className="text-amber-600" style={{ width: "1.125rem", height: "1.125rem" }} />
        </div>
        <div>
          <div className="flex items-center gap-1.5">
            <h2 className="text-lg font-bold text-zinc-900">代表別 営業ダッシュボード</h2>
            <FavoriteButton path="/dashboard/admin/sales-overview" label="代表別 営業ダッシュボード" />
          </div>
          <p className="text-xs text-zinc-500 mt-0.5">
            各代表の「探客 → アプローチ → 受注」を横並びで把握（本部専用）
          </p>
        </div>
      </div>

      {/* サマリー */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <SummaryCard label="稼働中の代表" value={activeReps} sub={`/ 全${rows.length}名`} tone="text-zinc-900" />
        <SummaryCard label="探客中（合計）" value={totals.prospecting} tone="text-sky-700" />
        <SummaryCard label="アプローチ済み（合計）" value={totals.approached} tone="text-amber-700" />
        <SummaryCard label="受注（合計）" value={totals.won} tone="text-emerald-700" />
      </div>

      {/* 代表別テーブル */}
      <div className="bg-white rounded-xl border border-zinc-200 overflow-hidden">
        <div className="px-4 py-3 border-b border-zinc-100 flex items-center gap-2">
          <TrendingUp className="w-4 h-4 text-zinc-400" />
          <h3 className="text-sm font-bold text-zinc-900">代表別の数字</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-zinc-50 text-left text-zinc-500">
              <tr>
                <th className="px-4 py-2.5 font-medium w-8">#</th>
                <th className="px-4 py-2.5 font-medium">代表</th>
                <th className="px-4 py-2.5 font-medium text-right">探客中</th>
                <th className="px-4 py-2.5 font-medium text-right">アプローチ済み</th>
                <th className="px-4 py-2.5 font-medium text-right">受注</th>
                <th className="px-4 py-2.5 font-medium text-right">転換率</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100">
              {rows.map((r, i) => {
                const rate = r.approached > 0 ? Math.round((r.won / r.approached) * 1000) / 10 : null;
                return (
                  <tr key={r.id} className="hover:bg-zinc-50/60">
                    <td className="px-4 py-2.5 text-zinc-400 tabular-nums">{i + 1}</td>
                    <td className="px-4 py-2.5 font-medium text-zinc-900">{r.name}</td>
                    <td className="px-4 py-2.5 text-right tabular-nums text-sky-700">{r.prospecting}</td>
                    <td className="px-4 py-2.5 text-right tabular-nums text-amber-700">{r.approached}</td>
                    <td className="px-4 py-2.5 text-right tabular-nums font-bold text-emerald-700">{r.won}</td>
                    <td className="px-4 py-2.5 text-right tabular-nums text-zinc-500">
                      {rate !== null ? `${rate}%` : "—"}
                    </td>
                  </tr>
                );
              })}
              {rows.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-4 py-8 text-center text-zinc-400 text-xs">
                    対象の代表がいません
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function SummaryCard({
  label,
  value,
  sub,
  tone,
}: {
  label: string;
  value: number;
  sub?: string;
  tone: string;
}) {
  return (
    <div className="bg-white rounded-lg border border-zinc-200 px-4 py-3">
      <p className="text-[11px] text-zinc-500">{label}</p>
      <p className={`text-xl font-bold mt-0.5 ${tone}`}>
        {value.toLocaleString()}
        {sub && <span className="text-xs font-normal text-zinc-400 ml-1">{sub}</span>}
      </p>
    </div>
  );
}
