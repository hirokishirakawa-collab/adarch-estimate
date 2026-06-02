import { redirect } from "next/navigation";
import Link from "next/link";
import { auth } from "@/lib/auth";
import { Activity, Coins } from "lucide-react";
import { db } from "@/lib/db";
import type { UserRole } from "@/types/roles";

// 機能別の概算単価（円/回）。実測でなく目安。
const FEATURE_COST: Record<string, number> = {
  "creator-leads/search": 45,
  "franchise-leads/search": 12,
  "franchise-leads/score": 8,
  "franchise-leads/draft": 5,
  "franchise-leads/advise": 7,
  "leads/search": 12,
  "leads/score": 8,
  "leads/advise": 7,
  "leads/recruit/score": 8,
  "leads/cinema/score": 8,
  "leads/btob/score": 8,
  "proposals/generate": 15,
  "strategy-advisor": 10,
  "studio/generate": 10,
  "studio/caption": 5,
  "studio/report": 8,
  "scrape-works": 10,
  "video-achievement-advisor": 8,
  "cutsheet": 8,
  "portfolio/ai-search": 8,
  "business-cards/ocr": 4,
  "chatbot": 3,
};
const DEFAULT_COST = 7;
const costOf = (feature: string) => FEATURE_COST[feature] ?? DEFAULT_COST;

const PERIODS = [
  { days: 1, label: "今日" },
  { days: 7, label: "7日間" },
  { days: 30, label: "30日間" },
];

function fmtYen(n: number): string {
  return "¥" + Math.round(n).toLocaleString("ja-JP");
}

function sinceDate(days: number): Date {
  return new Date(Date.now() - days * 86_400_000);
}

export default async function ApiUsagePage({ searchParams }: { searchParams: Promise<{ days?: string }> }) {
  const session = await auth();
  const role = (session?.user?.role ?? "USER") as UserRole;
  if (role !== "ADMIN") redirect("/dashboard");

  const sp = await searchParams;
  const days = [1, 7, 30].includes(Number(sp.days)) ? Number(sp.days) : 7;
  const since = sinceDate(days);

  const [grouped, recent] = await Promise.all([
    db.apiUsageLog.groupBy({
      by: ["email", "feature"],
      where: { createdAt: { gte: since } },
      _count: { _all: true },
    }),
    db.apiUsageLog.findMany({
      where: { createdAt: { gte: since } },
      orderBy: { createdAt: "desc" },
      take: 40,
      select: { email: true, feature: true, createdAt: true },
    }),
  ]);

  // 集計
  const byUser = new Map<string, { calls: number; cost: number }>();
  const byFeature = new Map<string, { calls: number; cost: number }>();
  let totalCalls = 0;
  let totalCost = 0;
  for (const g of grouped) {
    const calls = g._count._all;
    const cost = calls * costOf(g.feature);
    totalCalls += calls;
    totalCost += cost;
    const u = byUser.get(g.email) ?? { calls: 0, cost: 0 };
    u.calls += calls; u.cost += cost; byUser.set(g.email, u);
    const f = byFeature.get(g.feature) ?? { calls: 0, cost: 0 };
    f.calls += calls; f.cost += cost; byFeature.set(g.feature, f);
  }
  const users = [...byUser.entries()].map(([email, v]) => ({ email, ...v })).sort((a, b) => b.cost - a.cost);
  const features = [...byFeature.entries()].map(([feature, v]) => ({ feature, ...v })).sort((a, b) => b.cost - a.cost);

  return (
    <div className="px-6 py-6 max-w-screen-xl mx-auto w-full">
      <div className="flex items-center justify-between mb-6 flex-wrap gap-4">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 bg-rose-50 rounded-xl flex items-center justify-center">
            <Activity className="text-rose-600" style={{ width: "1.125rem", height: "1.125rem" }} />
          </div>
          <div>
            <h2 className="text-lg font-bold text-zinc-900">API利用状況</h2>
            <p className="text-xs text-zinc-500 mt-0.5">誰がAI/外部APIを多く消費しているか（概算コスト・ADMIN専用）</p>
          </div>
        </div>
        <div className="flex items-center gap-1 bg-zinc-100 rounded-lg p-0.5">
          {PERIODS.map((p) => (
            <Link key={p.days} href={`/dashboard/admin/api-usage?days=${p.days}`} className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${days === p.days ? "bg-white text-zinc-900 shadow-sm" : "text-zinc-500 hover:text-zinc-800"}`}>
              {p.label}
            </Link>
          ))}
        </div>
      </div>

      {/* サマリー */}
      <div className="grid grid-cols-3 gap-3 mb-6">
        <div className="bg-white border border-zinc-200 rounded-xl px-4 py-3">
          <p className="text-[11px] text-zinc-500 font-semibold">総コール数</p>
          <p className="text-2xl font-bold text-zinc-800">{totalCalls.toLocaleString("ja-JP")}<span className="text-xs font-medium text-zinc-400 ml-1">回</span></p>
        </div>
        <div className="bg-rose-50 border border-zinc-200 rounded-xl px-4 py-3">
          <p className="text-[11px] text-zinc-500 font-semibold flex items-center gap-1"><Coins className="w-3 h-3" />概算コスト合計</p>
          <p className="text-2xl font-bold text-rose-700">{fmtYen(totalCost)}</p>
        </div>
        <div className="bg-white border border-zinc-200 rounded-xl px-4 py-3">
          <p className="text-[11px] text-zinc-500 font-semibold">利用ユーザー数</p>
          <p className="text-2xl font-bold text-zinc-800">{users.length}<span className="text-xs font-medium text-zinc-400 ml-1">人</span></p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-6">
        {/* ユーザー別ランキング */}
        <div className="bg-white border border-zinc-200 rounded-xl overflow-hidden">
          <div className="px-4 py-2.5 border-b border-zinc-100 bg-zinc-50"><p className="text-xs font-semibold text-zinc-600">ユーザー別（消費が大きい順）</p></div>
          <table className="w-full text-sm">
            <thead><tr className="text-[11px] text-zinc-500 border-b border-zinc-100"><th className="px-4 py-2 text-left font-semibold">ユーザー</th><th className="px-4 py-2 text-right font-semibold">コール</th><th className="px-4 py-2 text-right font-semibold">概算コスト</th></tr></thead>
            <tbody className="divide-y divide-zinc-100">
              {users.map((u, i) => (
                <tr key={u.email} className="hover:bg-zinc-50/50">
                  <td className="px-4 py-2.5"><span className="text-[11px] text-zinc-400 mr-1.5">{i + 1}</span><span className="text-zinc-800">{u.email}</span></td>
                  <td className="px-4 py-2.5 text-right text-zinc-600">{u.calls.toLocaleString("ja-JP")}</td>
                  <td className="px-4 py-2.5 text-right font-bold text-rose-700">{fmtYen(u.cost)}</td>
                </tr>
              ))}
              {users.length === 0 && <tr><td colSpan={3} className="px-4 py-10 text-center text-sm text-zinc-400">この期間の利用ログはありません</td></tr>}
            </tbody>
          </table>
        </div>

        {/* 機能別 */}
        <div className="bg-white border border-zinc-200 rounded-xl overflow-hidden">
          <div className="px-4 py-2.5 border-b border-zinc-100 bg-zinc-50"><p className="text-xs font-semibold text-zinc-600">機能別</p></div>
          <table className="w-full text-sm">
            <thead><tr className="text-[11px] text-zinc-500 border-b border-zinc-100"><th className="px-4 py-2 text-left font-semibold">機能</th><th className="px-4 py-2 text-right font-semibold">コール</th><th className="px-4 py-2 text-right font-semibold">概算コスト</th></tr></thead>
            <tbody className="divide-y divide-zinc-100">
              {features.map((f) => (
                <tr key={f.feature} className="hover:bg-zinc-50/50">
                  <td className="px-4 py-2.5 text-zinc-800 font-mono text-xs">{f.feature}</td>
                  <td className="px-4 py-2.5 text-right text-zinc-600">{f.calls.toLocaleString("ja-JP")}</td>
                  <td className="px-4 py-2.5 text-right font-medium text-zinc-700">{fmtYen(f.cost)}</td>
                </tr>
              ))}
              {features.length === 0 && <tr><td colSpan={3} className="px-4 py-10 text-center text-sm text-zinc-400">—</td></tr>}
            </tbody>
          </table>
        </div>
      </div>

      {/* 直近ログ */}
      <div className="bg-white border border-zinc-200 rounded-xl overflow-hidden">
        <div className="px-4 py-2.5 border-b border-zinc-100 bg-zinc-50"><p className="text-xs font-semibold text-zinc-600">直近のログ</p></div>
        <div className="divide-y divide-zinc-100 max-h-96 overflow-y-auto">
          {recent.map((r, i) => (
            <div key={i} className="flex items-center justify-between px-4 py-2 text-xs">
              <span className="text-zinc-700">{r.email}</span>
              <span className="font-mono text-zinc-500">{r.feature}</span>
              <span className="text-zinc-400">{new Date(r.createdAt).toLocaleString("ja-JP", { month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit" })}</span>
            </div>
          ))}
          {recent.length === 0 && <div className="px-4 py-10 text-center text-sm text-zinc-400">—</div>}
        </div>
      </div>

      <p className="text-[10px] text-zinc-400 mt-3">※ コストは機能別の概算単価×コール数。実際の請求額とは異なります。記録は rate-limit 通過時点（＝実際にAPIを消費したリクエスト）。</p>
    </div>
  );
}
