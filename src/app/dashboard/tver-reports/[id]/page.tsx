// TVer配信実績 — 拠点の詳細。公開済みならグループ全社どの拠点の案件も開ける（2026-09-12 代表決定＝拠点間は完全公開）
//   卸値・裏計算・警告・金額調整の事実は本部だけ＝ここでは select していない（存在しない）
import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { breakdown } from "@/lib/tver/delivery-csv";
import { allocateBreakdown, effectiveSell } from "@/lib/tver/amount";
import { billingMonths, budgetSellForPeriod, periodDays } from "@/lib/tver/period";
import { SELL_MULTIPLIER, UNIT_PRICE, type AdSeconds } from "@/lib/tver/plan";
import { BreakdownTables } from "@/components/tver/delivery-breakdown";
import { RankBars, RateRing, StatTile, TrendBars } from "@/components/tver/charts";
import { FREQ } from "@/lib/tver/plan";

export const dynamic = "force-dynamic";
const fmtD = (d: Date) => new Intl.DateTimeFormat("ja-JP", { timeZone: "Asia/Tokyo", dateStyle: "medium" }).format(d);
const yen = (n: number) => `¥${n.toLocaleString("ja-JP")}`;

export default async function TverReportDetail({ params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user?.email) redirect("/");
  const me = await db.user.findUnique({ where: { email: session.user.email }, select: { role: true, groupCompanyId: true } });
  if (!me) redirect("/");
  const isAdmin = me.role === "ADMIN";
  const { id } = await params;

  const r = await db.tverDeliveryReport.findFirst({
    where: { id, status: "PUBLISHED" },
    select: {
      id: true, advertiserName: true, industry: true, areaLabel: true, areaPopulation: true, periodStart: true, periodEnd: true, adSeconds: true, partnerNote: true, confirmedAt: true,
      impressions: true, completes: true, clicks: true, sellAmount: true, sellAmountAdjusted: true, monthlyBudget: true, budgetMode: true, sharedNote: true,
      campaignNames: true,
      groupCompanyId: true, groupCompany: { select: { name: true } },
      rows: { select: { date: true, campaignName: true, adGroupName: true, prefecture: true, device: true, gender: true, age: true, impressions: true, q100: true, clicks: true, sellAmount: true } },
      adGroups: { select: { adGroupName: true, areaLabel: true, areaPopulation: true } },
    },
  });
  if (!r) notFound();

  const sec = r.adSeconds as AdSeconds | null;
  // 本部が金額を調整していれば、総額も内訳もその金額に合わせる（内訳の合計＝総額）
  const amount = effectiveSell(r);
  const days = periodDays(r.periodStart, r.periodEnd);
  const reach = Math.round(r.impressions / FREQ);
  const budget = budgetSellForPeriod(r.monthlyBudget, r.budgetMode, r.periodStart, r.periodEnd, SELL_MULTIPLIER); // 拠点に出す予算＝媒体実費×係数
  const byCampaign = allocateBreakdown(breakdown(r.rows, (x) => x.campaignName), r);
  const byPref = allocateBreakdown(breakdown(r.rows, (x) => x.prefecture), r);
  const byDevice = allocateBreakdown(breakdown(r.rows, (x) => x.device), r);
  const dayKey = (d: Date) => new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Tokyo", year: "numeric", month: "2-digit", day: "2-digit" }).format(d);
  const shortD = (d: Date) => new Intl.DateTimeFormat("ja-JP", { timeZone: "Asia/Tokyo", month: "numeric", day: "numeric" }).format(d);
  const dateLabel = new Map(r.rows.map((x) => [dayKey(x.date), shortD(x.date)]));
  const byDate = allocateBreakdown(breakdown(r.rows, (x) => dayKey(x.date)), r)
    .sort((a, b) => a.key.localeCompare(b.key))
    .map((b) => ({ ...b, key: dateLabel.get(b.key) ?? b.key }));
  const byAge = allocateBreakdown(breakdown(r.rows, (x) => `${x.gender} ${x.age}`), r);
  const agArea = new Map(r.adGroups.map((a) => [a.adGroupName, a]));
  const byAdGroup = allocateBreakdown(breakdown(r.rows, (x) => x.adGroupName), r);

  return (
    <div className="px-6 py-6 max-w-screen-xl mx-auto w-full">
      <Link href="/dashboard/tver-reports" className="inline-flex items-center gap-1 text-sm text-zinc-500 hover:text-zinc-800 mb-4"><ChevronLeft className="w-4 h-4" />一覧へ</Link>
      <div className="mb-6 flex items-start gap-4">
        <div className="flex-1">
        <h1 className="text-lg font-semibold text-zinc-900">{r.advertiserName}　{fmtD(r.periodStart)}〜{fmtD(r.periodEnd)}</h1>
        <p className="text-sm text-zinc-500">{r.areaLabel ? `${r.areaLabel}${r.areaPopulation ? `（人口 ${r.areaPopulation.toLocaleString("ja-JP")}人）` : ""}・` : ""}{r.industry ? `${r.industry}・` : ""}{sec ? `${sec}秒・再生単価 ¥${UNIT_PRICE[sec]}（税抜）` : ""}{r.groupCompany ? `・${r.groupCompany.name}` : ""}{r.confirmedAt ? `・本部確認 ${fmtD(r.confirmedAt)}` : ""}</p>
        {r.sharedNote && <p className="mt-2 text-sm text-zinc-700">{r.sharedNote}</p>}
        {r.partnerNote && (isAdmin || r.groupCompanyId === me.groupCompanyId) && <p className="mt-2 text-sm text-zinc-800 bg-orange-50 border border-orange-200 rounded-lg px-4 py-2 whitespace-pre-wrap">{r.partnerNote}</p>}
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <a href={`/api/tver-reports/${r.id}/pdf`} className="px-3 py-1.5 rounded-lg bg-zinc-900 text-white text-sm hover:bg-zinc-800">報告書PDF</a>
          <a href={`/api/tver-reports/${r.id}/csv`} className="px-3 py-1.5 rounded-lg border border-zinc-300 text-sm text-zinc-700 hover:bg-zinc-50">CSV</a>
        </div>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-3">
        <StatTile k="CMが届いた回数" v={r.impressions.toLocaleString("ja-JP")} sub={`1日あたり ${Math.round(r.impressions / days).toLocaleString("ja-JP")}回・${days}日間`} />
        <StatTile k="推定到達人数" v={`${reach.toLocaleString("ja-JP")}人`} sub={r.areaPopulation ? `商圏の住民の ${Math.round((reach / r.areaPopulation) * 1000) / 10}%` : "表示回数 ÷ 平均接触回数"} />
        <StatTile k="金額（税抜）" v={yen(amount)} sub={budget != null ? (amount === budget ? "予算どおり" : `予算 ${yen(budget)}`) : `売CPM ${r.impressions ? yen(Math.round((amount / r.impressions) * 1000)) : "—"}`} accent />
        <StatTile k="クリック" v={r.clicks.toLocaleString("ja-JP")} sub={r.impressions ? `CTR ${Math.round((r.clicks / r.impressions) * 10000) / 100}%` : ""} />
      </div>

      <div className="grid lg:grid-cols-3 gap-3 mb-6">
        <RateRing completes={r.completes} impressions={r.impressions} />
        <div className="lg:col-span-2">
          <TrendBars title="日ごとの配信量" rows={byDate} />
        </div>
      </div>

      <div className="grid lg:grid-cols-2 gap-6 mb-6">
        <RankBars title="どの機器で見られたか" rows={byDevice} total={r.impressions} limit={6} />
        <RankBars title="どの層に届いたか（性別・年齢）" rows={byAge} total={r.impressions} limit={10} />
      </div>
      {byPref.length > 1 && (
        <div className="mb-6">
          <RankBars title="どの地域に届いたか" rows={byPref} total={r.impressions} limit={12} />
        </div>
      )}

      <div className="space-y-6">
        <section className="bg-white border border-zinc-200 rounded-xl p-5">
          <h2 className="text-sm font-semibold text-zinc-900 mb-3">キャンペーン別</h2>
          <table className="w-full text-sm">
            <thead className="text-xs text-zinc-500"><tr><th className="text-left py-1">キャンペーン</th><th className="text-right py-1">表示回数</th><th className="text-right py-1">100%再生</th><th className="text-right py-1">クリック</th><th className="text-right py-1">金額（税抜）</th></tr></thead>
            <tbody>
              {byCampaign.map((b) => (
                <tr key={b.key} className="border-t border-zinc-100">
                  <td className="py-1.5 pr-2">{b.key}</td>
                  <td className="py-1.5 text-right tabular-nums">{b.impressions.toLocaleString("ja-JP")}</td>
                  <td className="py-1.5 text-right tabular-nums">{b.completes.toLocaleString("ja-JP")}</td>
                  <td className="py-1.5 text-right tabular-nums">{b.clicks.toLocaleString("ja-JP")}</td>
                  <td className="py-1.5 text-right tabular-nums font-medium">{yen(b.sellAmount)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
        <section className="bg-white border border-zinc-200 rounded-xl p-5">
          <h2 className="text-sm font-semibold text-zinc-900 mb-3">商圏別（広告グループ）</h2>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="text-xs text-zinc-500"><tr><th className="text-left py-1">商圏</th><th className="text-left py-1">広告グループ</th><th className="text-right py-1">表示回数</th><th className="text-right py-1">100%再生</th><th className="text-right py-1">クリック</th><th className="text-right py-1">金額（税抜）</th></tr></thead>
              <tbody>
                {byAdGroup.map((b) => {
                  const a = agArea.get(b.key);
                  return (
                    <tr key={b.key} className="border-t border-zinc-100">
                      <td className="py-1.5 pr-2 whitespace-nowrap">{a?.areaLabel ?? "—"}{a?.areaPopulation ? <span className="text-xs text-zinc-400">（{a.areaPopulation.toLocaleString("ja-JP")}人）</span> : null}</td>
                      <td className="py-1.5 pr-2 text-zinc-500 text-xs">{b.key}</td>
                      <td className="py-1.5 text-right tabular-nums">{b.impressions.toLocaleString("ja-JP")}</td>
                      <td className="py-1.5 text-right tabular-nums">{b.completes.toLocaleString("ja-JP")}</td>
                      <td className="py-1.5 text-right tabular-nums">{b.clicks.toLocaleString("ja-JP")}</td>
                      <td className="py-1.5 text-right tabular-nums font-medium">{yen(b.sellAmount)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </section>
        <details className="bg-white border border-zinc-200 rounded-xl p-5">
          <summary className="text-sm font-semibold text-zinc-900 cursor-pointer">数字で見る（都道府県別・デバイス別・性別年齢別・日別）</summary>
          <div className="mt-4 space-y-6">
            <BreakdownTables byPref={byPref} byDevice={byDevice} byDate={byDate} byAge={byAge} />
          </div>
        </details>
      </div>
    </div>
  );
}

function Stat({ k, v, sub, strong }: { k: string; v: string; sub?: string; strong?: boolean }) {
  return (
    <div className={`rounded-lg border px-3 py-2 ${strong ? "border-orange-200 bg-orange-50" : "border-zinc-200 bg-white"}`}>
      <div className="text-xs text-zinc-500">{k}</div>
      <div className={`tabular-nums ${strong ? "text-lg font-bold" : "text-base font-medium"} text-zinc-900`}>{v}</div>
      {sub && <div className="text-xs text-zinc-400">{sub}</div>}
    </div>
  );
}
