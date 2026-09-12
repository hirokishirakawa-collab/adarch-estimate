// TVer配信実績 — 本部の詳細（ADMINだけ）。卸値と売価を並べて確認 → 拠点を紐づけ → 確認完了＝公開
import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import { auth } from "@/lib/auth";
import type { UserRole } from "@/types/roles";
import { db } from "@/lib/db";
import { SELL_MULTIPLIER, UNIT_PRICE, type AdSeconds } from "@/lib/tver/plan";
import { breakdown, isActionWarning } from "@/lib/tver/delivery-csv";
import { orderNumberLabel } from "@/lib/tver-order/plans";
import { ReportAdminPanel } from "./admin-panel";
import { areaOptionsFor } from "@/lib/tver/report-area";
import { budgetForPeriod, periodDays } from "@/lib/tver/period";
import { effectiveSell } from "@/lib/tver/amount";
import { AdGroupAreas, type AdGroupRow } from "./adgroup-areas";
import { BreakdownTables } from "@/components/tver/delivery-breakdown";

export const dynamic = "force-dynamic";
const fmtD = (d: Date) => new Intl.DateTimeFormat("ja-JP", { timeZone: "Asia/Tokyo", dateStyle: "medium" }).format(d);
const fmtDT = (d: Date | null) => (d ? new Intl.DateTimeFormat("ja-JP", { timeZone: "Asia/Tokyo", dateStyle: "medium", timeStyle: "short" }).format(d) : "—");
const yen = (n: number) => `¥${n.toLocaleString("ja-JP")}`;

export default async function AdminTverReportDetail({ params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  const role = (session?.user?.role ?? "USER") as UserRole;
  if (role !== "ADMIN") redirect("/dashboard");
  const { id } = await params;
  const [r, companies] = await Promise.all([
    db.tverDeliveryReport.findUnique({
      where: { id },
      include: {
        groupCompany: { select: { id: true, name: true, prefecture: true } },
        tverOrder: { select: { id: true, number: true, createdAt: true, advertiserName: true } },
        rows: { select: { date: true, campaignName: true, adGroupName: true, prefecture: true, device: true, gender: true, age: true, impressions: true, q100: true, clicks: true, sellAmount: true, wholesaleAmount: true, wholesaleCpm: true } },
        adGroups: true,
      },
    }),
    db.groupCompany.findMany({ where: { isActive: true }, select: { id: true, name: true, prefecture: true }, orderBy: { name: "asc" } }),
  ]);
  if (!r) notFound();
  // 紐づけ候補の申込: 広告主名が近いものを先頭に
  const orders = await db.tverOrder.findMany({
    where: { status: { notIn: ["CANCELLED", "REFUNDED", "AWAITING_PAYMENT"] } },
    select: { id: true, number: true, createdAt: true, advertiserName: true, groupCompanyId: true },
    orderBy: { createdAt: "desc" },
    take: 300,
  });
  const key = r.advertiserName.replace(/株式会社|有限会社|合同会社|\s/g, "");
  const orderOpts = orders
    .map((o) => ({ id: o.id, label: `${orderNumberLabel(o.number, o.createdAt)} ${o.advertiserName}`, hit: key.length > 1 && o.advertiserName.replace(/株式会社|有限会社|合同会社|\s/g, "").includes(key) }))
    .sort((a, b) => Number(b.hit) - Number(a.hit));

  const sec = r.adSeconds as AdSeconds | null;
  const days = periodDays(r.periodStart, r.periodEnd);
  const periodBudget = budgetForPeriod(r.monthlyBudget, days); // 媒体実費ベース
  const sellUnit = sec ? UNIT_PRICE[sec] : null;
  const byCampaign = breakdown(r.rows, (x) => x.campaignName);
  const byPref = breakdown(r.rows, (x) => x.prefecture);
  const byDevice = breakdown(r.rows, (x) => x.device);
  const byDate = breakdown(r.rows, (x) => fmtD(x.date)).sort((a, b) => a.key.localeCompare(b.key, "ja"));
  const byAge = breakdown(r.rows, (x) => `${x.gender} ${x.age}`);
  const areaOptions = areaOptionsFor(byPref.map((b) => b.key));
  // 広告グループ別（商圏つき）
  const agMap = new Map(r.adGroups.map((a) => [a.adGroupName, a]));
  const agStats = new Map<string, AdGroupRow>();
  for (const x of r.rows) {
    const a = agMap.get(x.adGroupName);
    const cur = agStats.get(x.adGroupName) ?? { adGroupName: x.adGroupName, campaignName: x.campaignName, areaLabel: a?.areaLabel ?? null, areaPopulation: a?.areaPopulation ?? null, areaSource: a?.areaSource ?? null, areaKeys: a?.areaKeys ?? [], impressions: 0, completes: 0, clicks: 0, sellAmount: 0, wholesaleAmount: 0, options: [] };
    cur.impressions += x.impressions; cur.completes += x.q100; cur.clicks += x.clicks; cur.sellAmount += x.sellAmount; cur.wholesaleAmount += x.wholesaleAmount;
    agStats.set(x.adGroupName, cur);
  }
  const agPrefs = new Map<string, Set<string>>();
  for (const x of r.rows) agPrefs.set(x.adGroupName, (agPrefs.get(x.adGroupName) ?? new Set()).add(x.prefecture));
  const adGroupRows: AdGroupRow[] = [...agStats.values()].map((g) => ({ ...g, options: areaOptionsFor([...(agPrefs.get(g.adGroupName) ?? [])]) })).sort((a, b) => b.impressions - a.impressions);
  const wholesaleByCampaign = new Map<string, number>();
  for (const x of r.rows) wholesaleByCampaign.set(x.campaignName, (wholesaleByCampaign.get(x.campaignName) ?? 0) + x.wholesaleAmount);

  return (
    <div className="px-6 py-6 max-w-screen-2xl mx-auto w-full">
      <Link href="/dashboard/admin/tver-reports" className="inline-flex items-center gap-1 text-sm text-zinc-500 hover:text-zinc-800 mb-4"><ChevronLeft className="w-4 h-4" />一覧へ</Link>
      <div className="flex items-start justify-between flex-wrap gap-3 mb-6">
        <div>
          <h1 className="text-lg font-semibold text-zinc-900">{r.advertiserName}　{fmtD(r.periodStart)}〜{fmtD(r.periodEnd)}</h1>
          <p className="text-sm text-zinc-500">TVer広告主ID {r.advertiserTverId}・{r.industry ? `${r.industry}・` : ""}{r.areaLabel ? `${r.areaLabel}・` : ""}{r.adSeconds ? `${r.adSeconds}秒` : "秒数不明"}・{r.rowCount.toLocaleString("ja-JP")}行・{r.fileName}・取込 {fmtDT(r.createdAt)}（{r.importedByEmail}）</p>
        </div>
        <span className={`px-3 py-1.5 rounded-lg text-sm font-medium ${r.status === "PUBLISHED" ? "bg-emerald-50 text-emerald-700" : "bg-orange-50 text-orange-700"}`}>{r.status === "PUBLISHED" ? `公開済み（${fmtDT(r.confirmedAt)}）` : "確認待ち（拠点には見えていません）"}</span>
      </div>

      <div className="mb-4 flex flex-wrap items-center gap-x-4 gap-y-2 text-xs text-zinc-500">
        <span className="inline-flex items-center gap-1.5"><span className="inline-block w-3 h-3 rounded-sm border-2 border-zinc-900" />本部だけが見える</span>
        <span className="inline-flex items-center gap-1.5"><span className="inline-block w-3 h-3 rounded-sm border-2 border-emerald-500" />拠点・お客様にも見える</span>
        <span className="ml-auto flex items-center gap-2">
          <a href={`/api/tver-reports/${r.id}/pdf`} className="px-3 py-1.5 rounded-lg bg-zinc-900 text-white text-sm hover:bg-zinc-800">報告書PDF</a>
          <a href={`/api/tver-reports/${r.id}/csv`} className="px-3 py-1.5 rounded-lg border border-zinc-300 text-sm text-zinc-700 hover:bg-zinc-50">CSV</a>
        </span>
      </div>

      {r.warnings.some(isActionWarning) && (
        <div className="mb-4 rounded-xl border border-rose-200 bg-rose-50 px-5 py-4 text-sm text-rose-800">
          <p className="font-semibold mb-1">取込時の警告（確認してから公開）</p>
          <ul className="list-disc pl-5 space-y-0.5">{r.warnings.filter(isActionWarning).map((w, i) => <li key={i}>{w}</li>)}</ul>
        </div>
      )}
      {r.warnings.some((w) => !isActionWarning(w)) && (
        <div className="mb-6 rounded-xl border border-amber-200 bg-amber-50 px-5 py-4 text-sm text-amber-900">
          <p className="font-semibold mb-1">注記（金額は正しく出ています）</p>
          <ul className="list-disc pl-5 space-y-0.5">{r.warnings.filter((w) => !isActionWarning(w)).map((w, i) => <li key={i}>{w.replace(/^ℹ️ /, "")}</li>)}</ul>
        </div>
      )}

      <div className="grid lg:grid-cols-5 gap-6">
        <div className="lg:col-span-3 space-y-6">
          <section className="bg-white border-2 border-zinc-900 rounded-xl p-5">
            <h2 className="text-sm font-semibold text-zinc-900 mb-3">金額の確認（卸値は本部だけ・拠点には売価だけが出ます）</h2>
            <div className="grid sm:grid-cols-4 gap-3 text-sm">
              <Stat k={`予算＝媒体実費（この期間 ${days}日）`} v={periodBudget != null ? yen(periodBudget) : "—"} sub={r.monthlyBudget ? `月額 ${yen(r.monthlyBudget)}・売価換算 ${yen(periodBudget! * SELL_MULTIPLIER)}` : "未設定"} />
              <Stat k="卸値（ご利用金額の合計）" v={yen(r.wholesaleAmount)} sub={`卸CPM ${sec ? `¥${(UNIT_PRICE[sec] / SELL_MULTIPLIER * 1000).toLocaleString("ja-JP")}` : "—"}`} muted />
              <Stat k={`売価＝卸値×${r.sellMultiplier}`} v={yen(r.sellAmount)} sub={sellUnit ? `売単価 ¥${sellUnit}/再生` : "—"} strong />
              <Stat k="裏計算＝表示回数×売単価" v={r.crossCheckAmount ? yen(r.crossCheckAmount) : "—"} sub={`ずれ ${r.crossCheckDiffPct}%`} warn={r.crossCheckDiffPct > 3} />
            </div>
            {r.sellAmountAdjusted != null && (
              <div className="mt-3 rounded-lg border border-orange-200 bg-orange-50 px-4 py-2 text-sm">
                <span className="font-medium text-zinc-900">拠点に出る金額（調整後）{yen(r.sellAmountAdjusted)}</span>
                <span className="ml-2 text-xs text-zinc-600">
                  {r.sellAmountAdjusted < r.sellAmount
                    ? `本部負担 ${yen(r.sellAmount - r.sellAmountAdjusted)}`
                    : r.sellAmountAdjusted > r.sellAmount
                      ? `未消化ぶんの上乗せ ${yen(r.sellAmountAdjusted - r.sellAmount)}`
                      : "自動計算と同額"}
                  {r.adjustNote ? `・${r.adjustNote}` : ""}
                  {r.adjustedAt ? `・${fmtD(r.adjustedAt)}` : ""}
                </span>
              </div>
            )}
            <div className="grid sm:grid-cols-4 gap-3 text-sm mt-3">
              <Stat k="表示回数" v={r.impressions.toLocaleString("ja-JP")} />
              <Stat k="100%再生" v={r.completes.toLocaleString("ja-JP")} sub={r.impressions ? `${Math.round((r.completes / r.impressions) * 1000) / 10}%` : ""} />
              <Stat k="クリック" v={r.clicks.toLocaleString("ja-JP")} sub={r.impressions ? `CTR ${Math.round((r.clicks / r.impressions) * 10000) / 100}%` : ""} />
              <Stat k="売CPM（拠点にも見える）" v={r.impressions ? yen(Math.round((effectiveSell(r) / r.impressions) * 1000)) : "—"} sub="調整後の金額 ÷ 表示回数 × 1,000" />
            </div>
          </section>

          <section className="bg-white border-2 border-zinc-900 rounded-xl p-5">
            <h2 className="text-sm font-semibold text-zinc-900 mb-3">キャンペーン別（卸値つき・本部だけ）</h2>
            <table className="w-full text-sm">
              <thead className="text-xs text-zinc-500"><tr><th className="text-left py-1">キャンペーン</th><th className="text-right py-1">表示回数</th><th className="text-right py-1">100%再生</th><th className="text-right py-1">卸値</th><th className="text-right py-1">売価</th></tr></thead>
              <tbody>
                {byCampaign.map((b) => (
                  <tr key={b.key} className="border-t border-zinc-100">
                    <td className="py-1.5 pr-2">{b.key}</td>
                    <td className="py-1.5 text-right tabular-nums">{b.impressions.toLocaleString("ja-JP")}</td>
                    <td className="py-1.5 text-right tabular-nums">{b.completes.toLocaleString("ja-JP")}</td>
                    <td className="py-1.5 text-right tabular-nums text-zinc-500">{yen(wholesaleByCampaign.get(b.key) ?? 0)}</td>
                    <td className="py-1.5 text-right tabular-nums font-medium">{yen(b.sellAmount)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>

          <AdGroupAreas reportId={r.id} groups={adGroupRows} />

          <BreakdownTables byPref={byPref} byDevice={byDevice} byDate={byDate} byAge={byAge} border="border-2 border-emerald-500" />
        </div>

        <div className="lg:col-span-2">
          <ReportAdminPanel
            id={r.id}
            status={r.status}
            groupCompanyId={r.groupCompanyId ?? ""}
            tverOrderId={r.tverOrderId ?? ""}
            industry={r.industry ?? ""}
            areaLabel={r.areaLabel ?? ""}
            areaPopulation={r.areaPopulation}
            areaOptions={areaOptions}
            areaKeys={r.areaKeys}
            wholesaleAmount={r.wholesaleAmount}
            sellAmount={r.sellAmount}
            sellMultiplier={r.sellMultiplier}
            crossCheckAmount={r.crossCheckAmount}
            crossCheckDiffPct={r.crossCheckDiffPct}
            sellAmountAdjusted={r.sellAmountAdjusted}
            adjustNote={r.adjustNote ?? ""}
            monthlyBudget={r.monthlyBudget}
            periodDays={days}
            adminNote={r.adminNote ?? ""}
            partnerNote={r.partnerNote ?? ""}
            sharedNote={r.sharedNote ?? ""}
            companies={companies}
            orders={orderOpts}
            hasWarnings={r.warnings.some(isActionWarning)}
          />
        </div>
      </div>
    </div>
  );
}

function Stat({ k, v, sub, strong, muted, warn }: { k: string; v: string; sub?: string; strong?: boolean; muted?: boolean; warn?: boolean }) {
  return (
    <div className={`rounded-lg border px-3 py-2 ${warn ? "border-rose-200 bg-rose-50" : strong ? "border-orange-200 bg-orange-50" : "border-zinc-200"}`}>
      <div className="text-xs text-zinc-500">{k}</div>
      <div className={`tabular-nums ${strong ? "text-lg font-bold text-zinc-900" : muted ? "text-base text-zinc-500" : "text-base font-medium text-zinc-900"} ${warn ? "text-rose-700" : ""}`}>{v}</div>
      {sub && <div className="text-xs text-zinc-400">{sub}</div>}
    </div>
  );
}
