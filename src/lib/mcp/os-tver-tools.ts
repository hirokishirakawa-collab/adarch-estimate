// ==============================================================
// MCP: TVer配信実績（scope = os:read）
//   tver_results    : 自拠点（本部は全社）の「公開済み」配信実績。お客様への報告にそのまま使う数字（売価・表示回数・完全視聴・内訳）
//   tver_benchmarks : グループ全社の実績を「人口帯（市町村の規模）×月額帯（投下金額）→ 結果（30日あたり表示回数・到達人数・住民比・
//                     完全視聴率・CTR）」で横断。提案前・見積前に引く。他拠点の案件は広告主名を伏せ、金額は帯だけ＝比率と規模を型として借りる
//   決まり: 卸値は一切返さない（DBの列を select しない）。金額は 本部 か その実績の拠点 だけ。拠点向けの公開状態（PUBLISHED）以外は返さない
// ==============================================================

import { db } from "@/lib/db";
import type { McpViewer } from "./os-read-tools";
import { breakdown } from "@/lib/tver/delivery-csv";
import { allocateBreakdown, effectiveSell } from "@/lib/tver/amount";
import { budgetSellForPeriod } from "@/lib/tver/period";
import { FREQ, SELL_MULTIPLIER, UNIT_PRICE, type AdSeconds } from "@/lib/tver/plan";
import { BUDGET_BANDS, POPULATION_BANDS, budgetBand, populationBand } from "@/lib/tver/report-area";
import { municipalitiesOf, prefectureOptions } from "@/lib/packages/tver-area";

const day = (d: Date | null | undefined) => (d ? d.toISOString().slice(0, 10) : null);
const yen = (n: number) => `¥${Math.round(n).toLocaleString("ja-JP")}`;
const pct = (a: number, b: number, digits = 1) => (b > 0 ? Math.round((a / b) * 100 * 10 ** digits) / 10 ** digits : 0);
const isHq = (v: McpViewer) => v.role === "ADMIN";
const prefBase = (s: string) => (s.startsWith("北海道") ? "北海道" : s.trim().replace(/[都府県]$/, ""));
const DAY = 86_400_000;
const OTHER = "（他拠点のため非表示）";

const rowSel = { date: true, campaignName: true, adGroupName: true, prefecture: true, device: true, gender: true, age: true, impressions: true, q100: true, clicks: true, sellAmount: true } as const;
const agSel = { adGroupName: true, areaLabel: true, areaPopulation: true } as const;

function share<T extends { impressions: number }>(rows: T[], by: (r: T) => string, top = 6) {
  const b = breakdown(rows as unknown as { impressions: number; q100: number; clicks: number; sellAmount: number }[], by as unknown as (r: { impressions: number; q100: number; clicks: number; sellAmount: number }) => string);
  const total = b.reduce((a, x) => a + x.impressions, 0);
  return b.slice(0, top).map((x) => ({ key: x.key, impressions: x.impressions, share: `${pct(x.impressions, total)}%`, completionRate: `${pct(x.completes, x.impressions)}%` }));
}

// ---- 自拠点の実績 -------------------------------------------------------------

export interface TverResultsInput {
  reportId?: string;
  advertiser?: string;
  limit?: number;
}

export async function tverResults(v: McpViewer, input: TverResultsInput) {
  const mine = isHq(v) ? {} : { groupCompanyId: v.groupCompanyId ?? "__none__" };
  if (!isHq(v) && !v.groupCompanyId) return { error: "このアカウントは拠点に紐づいていないため実績を返せません。本部にご連絡ください" };

  if (input.reportId) {
    const r = await db.tverDeliveryReport.findFirst({
      where: { id: input.reportId, status: "PUBLISHED", ...mine },
      select: {
        id: true, advertiserName: true, industry: true, areaLabel: true, areaPopulation: true, periodStart: true, periodEnd: true, adSeconds: true, partnerNote: true, confirmedAt: true,
        impressions: true, completes: true, clicks: true, sellAmount: true, sellAmountAdjusted: true, monthlyBudget: true, sharedNote: true, campaignNames: true,
        groupCompany: { select: { name: true } }, tverOrder: { select: { number: true, createdAt: true, prefName: true, areaLabel: true, planKey: true, months: true } },
        rows: { select: rowSel }, adGroups: { select: agSel },
      },
    });
    if (!r) return { error: "見つからないか、公開されていません" };
    const sec = r.adSeconds as AdSeconds | null;
    const days = Math.round((r.periodEnd.getTime() - r.periodStart.getTime()) / DAY) + 1;
    const byDate = breakdown(r.rows, (x) => day(x.date)!).sort((a, b) => a.key.localeCompare(b.key));
    const amount = effectiveSell(r); // 本部が調整していればその金額（拠点・お客様に出るのはこちら）
    return {
      id: r.id, advertiser: r.advertiserName, industry: r.industry, company: r.groupCompany?.name ?? "本部",
      area: r.areaLabel, areaPopulation: r.areaPopulation,
      period: { from: day(r.periodStart), to: day(r.periodEnd), days },
      budget: r.monthlyBudget ? { forThisPeriodExclTax: yen(budgetSellForPeriod(r.monthlyBudget, r.periodStart, r.periodEnd, SELL_MULTIPLIER) ?? 0), note: "お客様と決めた予算（税抜）。実績の金額がこれと同じなら予算どおりに配信できたということ" } : null,
      per30Days: { amountExclTax: yen((amount / Math.max(1, days)) * 30), impressions: Math.round((r.impressions / Math.max(1, days)) * 30), reachEstimate: Math.round((r.impressions / Math.max(1, days)) * 30 / FREQ), residentsReachPct: r.areaPopulation ? `${pct(Math.round((r.impressions / Math.max(1, days)) * 30 / FREQ), r.areaPopulation)}%` : null },
      adSeconds: sec, unitPrice: sec ? `¥${UNIT_PRICE[sec]}/再生（税抜）` : null,
      order: r.tverOrder ? { area: `${r.tverOrder.prefName} ${r.tverOrder.areaLabel}`, plan: r.tverOrder.planKey, months: r.tverOrder.months } : null,
      totals: { impressions: r.impressions, completes: r.completes, completionRate: `${pct(r.completes, r.impressions)}%`, clicks: r.clicks, ctr: `${pct(r.clicks, r.impressions, 2)}%`, amountExclTax: yen(amount), perDayImpressions: Math.round(r.impressions / Math.max(1, days)) },
      byCampaign: allocateBreakdown(breakdown(r.rows, (x) => x.campaignName), r).map((b) => ({ campaign: b.key, impressions: b.impressions, completes: b.completes, clicks: b.clicks, amountExclTax: yen(b.sellAmount) })),
      byArea: allocateBreakdown(breakdown(r.rows, (x) => x.adGroupName), r).map((b) => { const a = r.adGroups.find((g) => g.adGroupName === b.key); return { area: a?.areaLabel ?? null, population: a?.areaPopulation ?? null, adGroup: b.key, impressions: b.impressions, completionRate: `${pct(b.completes, b.impressions)}%`, clicks: b.clicks, amountExclTax: yen(b.sellAmount), reachEstimatePer30Days: Math.round((b.impressions / Math.max(1, days)) * 30 / FREQ) }; }),
      byPrefecture: share(r.rows, (x) => x.prefecture, 10),
      byDevice: share(r.rows, (x) => x.device),
      byGenderAge: share(r.rows, (x) => `${x.gender} ${x.age}`, 12),
      byDate: byDate.map((b) => ({ date: b.key, impressions: b.impressions, completes: b.completes, clicks: b.clicks })),
      noteFromHq: r.partnerNote, sharedNote: r.sharedNote, confirmedAt: day(r.confirmedAt),
      rules: "金額は税抜の媒体費（再生単価×表示回数）。お客様への報告は「表示回数・完全視聴率・県/デバイス/年齢の内訳」を中心に。数字は盛らない",
    };
  }

  const list = await db.tverDeliveryReport.findMany({
    where: { status: "PUBLISHED", ...mine, ...(input.advertiser ? { advertiserName: { contains: input.advertiser, mode: "insensitive" } } : {}) },
    orderBy: { periodEnd: "desc" },
    take: Math.min(50, Math.max(1, input.limit ?? 20)),
    select: { id: true, advertiserName: true, industry: true, periodStart: true, periodEnd: true, adSeconds: true, impressions: true, completes: true, clicks: true, sellAmount: true, sellAmountAdjusted: true, monthlyBudget: true, confirmedAt: true, groupCompany: { select: { name: true } } },
  });
  return {
    count: list.length,
    results: list.map((r) => ({
      id: r.id, advertiser: r.advertiserName, industry: r.industry, company: r.groupCompany?.name ?? "本部",
      period: `${day(r.periodStart)}〜${day(r.periodEnd)}`, adSeconds: r.adSeconds, monthlyBudgetExclTax: r.monthlyBudget ? yen(r.monthlyBudget * SELL_MULTIPLIER) : null,
      impressions: r.impressions, completionRate: `${pct(r.completes, r.impressions)}%`, ctr: `${pct(r.clicks, r.impressions, 2)}%`, amountExclTax: yen(effectiveSell(r)), confirmedAt: day(r.confirmedAt),
    })),
    hint: "詳細（県・デバイス・年齢・日別の内訳）は tver_results(reportId) で。実績はOS本部が確認したものだけが出る",
  };
}

// ---- グループ横断のベンチマーク ------------------------------------------------
//   軸＝「どの規模の市町村（人口帯）で・月いくら打つと（月額帯）・どうなったか（30日あたり表示回数・到達人数・住民比・完全視聴率・CTR）」

export interface TverBenchmarksInput {
  industry?: string;
  prefecture?: string;
  city?: string;
  population?: number;
  monthlyBudget?: number;
  adSeconds?: number;
  limit?: number;
}

export async function tverBenchmarks(v: McpViewer, input: TverBenchmarksInput) {
  const industry = input.industry?.trim() || null;
  const pref = input.prefecture?.trim() ? prefBase(input.prefecture) : null;
  const sec = [15, 30, 60].includes(Number(input.adSeconds)) ? Number(input.adSeconds) : null;

  // 商圏の人口: population > (prefecture+city をマスターで引く) > 指定なし
  let population: number | null = input.population && input.population > 0 ? Math.round(input.population) : null;
  let resolvedCity: string | null = null;
  if (!population && pref && input.city?.trim()) {
    const full = prefectureOptions().find((p) => prefBase(p) === pref);
    const m = full ? municipalitiesOf(full).find((x) => x.name.startsWith(input.city!.trim())) : null;
    if (m) {
      population = m.population;
      resolvedCity = `${full} ${m.name}`;
    }
  }
  const popBand = populationBand(population);
  const budBand = budgetBand(input.monthlyBudget && input.monthlyBudget > 0 ? input.monthlyBudget : null);

  const reports = await db.tverDeliveryReport.findMany({
    where: {
      status: "PUBLISHED",
      ...(industry ? { industry: { contains: industry, mode: "insensitive" } } : {}),
      ...(sec ? { adSeconds: sec } : {}),
      ...(pref ? { rows: { some: { prefecture: { contains: pref } } } } : {}),
    },
    orderBy: { periodEnd: "desc" },
    take: 60,
    select: {
      id: true, advertiserName: true, industry: true, areaLabel: true, areaPopulation: true, periodStart: true, periodEnd: true, adSeconds: true, groupCompanyId: true,
      sellAmount: true, sellAmountAdjusted: true, monthlyBudget: true,
      groupCompany: { select: { name: true, prefecture: true } },
      tverOrder: { select: { planKey: true, months: true } },
      rows: { select: rowSel },
      adGroups: { select: agSel },
    },
  });

  const own = (gid: string | null) => isHq(v) || (!!gid && gid === v.groupCompanyId);
  // 1件＝広告グループ（TVerでエリアを設定する単位）。商圏はその広告グループのもの → 無ければレポートのもの
  const all = reports.flatMap((r) => {
    const days = Math.max(1, Math.round((r.periodEnd.getTime() - r.periodStart.getTime()) / DAY) + 1);
    const mine = own(r.groupCompanyId);
    const byAg = new Map<string, typeof r.rows>();
    for (const x of r.rows) byAg.set(x.adGroupName, [...(byAg.get(x.adGroupName) ?? []), x]);
    return [...byAg.entries()].map(([agName, rows]) => {
      const ag = r.adGroups.find((g) => g.adGroupName === agName);
      const areaLabel = ag?.areaLabel ?? r.areaLabel ?? null;
      const areaPopulation = ag?.areaPopulation ?? r.areaPopulation ?? null;
      const imp = rows.reduce((a, x) => a + x.impressions, 0);
      const comp = rows.reduce((a, x) => a + x.q100, 0);
      const clk = rows.reduce((a, x) => a + x.clicks, 0);
      // 本部が金額を調整していれば、その比でこの広告グループぶんも合わせる（ベンチマークは実際に請求した額で見る）
      const scale = r.sellAmountAdjusted != null && r.sellAmount > 0 ? r.sellAmountAdjusted / r.sellAmount : 1;
      const sell = Math.round(rows.reduce((a, x) => a + x.sellAmount, 0) * scale);
      const imp30 = Math.round((imp / days) * 30);
      const amt30 = Math.round((sell / days) * 30);
      const reach30 = Math.round(imp30 / FREQ);
      const pb = populationBand(areaPopulation);
      const bb = budgetBand(amt30);
      return {
        r, days, imp, comp, clk, imp30, amt30, reach30, mine, pb, bb, areaPopulation, rows,
        out: {
          id: mine ? r.id : undefined,
          advertiser: mine ? r.advertiserName : OTHER,
          industry: r.industry ?? "（業種未設定）",
          company: mine ? r.groupCompany?.name ?? "本部" : `${r.groupCompany?.prefecture ?? "—"}の拠点`,
          area: areaLabel ?? "（商圏未設定）",
          population: areaPopulation,
          populationBand: pb?.label ?? null,
          monthlyAmountExclTax: mine ? yen(amt30) : bb?.label ?? OTHER,
          monthlyBudgetExclTax: r.monthlyBudget ? (mine ? yen(r.monthlyBudget * SELL_MULTIPLIER) : budgetBand(r.monthlyBudget * SELL_MULTIPLIER)?.label ?? null) : null,
          budgetBand: bb?.label ?? null,
          plan: r.tverOrder ? `${r.tverOrder.planKey}・${r.tverOrder.months}ヶ月` : null,
          adSeconds: r.adSeconds,
          period: `${day(r.periodStart)}〜${day(r.periodEnd)}（${days}日）`,
          per30Days: { impressions: imp30, reachEstimate: reach30, residentsReachPct: areaPopulation ? `${pct(reach30, areaPopulation)}%` : null },
          completionRate: `${pct(comp, imp)}%`,
          ctr: `${pct(clk, imp, 2)}%`,
          byDevice: share(rows, (x) => x.device, 4),
          byGenderAge: share(rows, (x) => `${x.gender} ${x.age}`, 6),
        },
      };
    });
  })
    .filter((c) => c.imp > 0)
    // 人口帯の指定があれば、その帯（無ければ全部）。県指定はレポート単位で済んでいる
    .filter((c) => !popBand || (c.areaPopulation != null && c.areaPopulation >= popBand.min && c.areaPopulation < popBand.max));
  // 月額帯の指定があれば絞る（近い帯も残す）
  const filtered = budBand ? all.filter((c) => c.bb && Math.abs(BUDGET_BANDS.indexOf(c.bb) - BUDGET_BANDS.indexOf(budBand)) <= 1) : all;
  if (filtered.length === 0) return { count: 0, filters: { industry, prefecture: pref, city: resolvedCity, population, populationBand: popBand?.label ?? null, monthlyBudget: input.monthlyBudget ?? null }, message: "条件に合う公開済みの実績がまだありません。条件を広げるか、本部に実績の取込を依頼してください" };

  // 人口帯 × 月額帯 の表（中央値）
  const med = (xs: number[]) => (xs.length ? [...xs].sort((a, b) => a - b)[Math.floor(xs.length / 2)] : 0);
  const cells = new Map<string, typeof all>();
  for (const c of all) {
    if (!c.pb || !c.bb) continue;
    const k = `${c.pb.key}|${c.bb.key}`;
    cells.set(k, [...(cells.get(k) ?? []), c]);
  }
  const matrix = [...cells.entries()].map(([k, cs]) => {
    const [pk, bk] = k.split("|");
    const pop = POPULATION_BANDS.find((b) => b.key === pk)!;
    const bud = BUDGET_BANDS.find((b) => b.key === bk)!;
    const tImp = cs.reduce((a, c) => a + c.imp, 0);
    return {
      populationBand: pop.label, budgetBand: bud.label, cases: cs.length,
      medianImpressionsPer30Days: med(cs.map((c) => c.imp30)),
      medianReachPer30Days: med(cs.map((c) => c.reach30)),
      medianResidentsReachPct: `${med(cs.map((c) => (c.areaPopulation ? Math.round((c.reach30 / c.areaPopulation) * 1000) / 10 : 0)))}%`,
      completionRate: `${pct(cs.reduce((a, c) => a + c.comp, 0), tImp)}%`,
      ctr: `${pct(cs.reduce((a, c) => a + c.clk, 0), tImp, 2)}%`,
    };
  }).sort((a, b) => a.populationBand.localeCompare(b.populationBand, "ja") || a.budgetBand.localeCompare(b.budgetBand, "ja"));

  const allRows = filtered.flatMap((c) => c.rows);
  const tImp = allRows.reduce((a, x) => a + x.impressions, 0);
  return {
    count: filtered.length,
    filters: { industry, prefecture: pref, city: resolvedCity, population, populationBand: popBand?.label ?? null, monthlyBudget: input.monthlyBudget ?? null, budgetBand: budBand?.label ?? null, adSeconds: sec },
    matrix,
    overall: {
      completionRate: `${pct(allRows.reduce((a, x) => a + x.q100, 0), tImp)}%`,
      ctr: `${pct(allRows.reduce((a, x) => a + x.clicks, 0), tImp, 2)}%`,
      medianImpressionsPer30Days: med(filtered.map((c) => c.imp30)),
      byDevice: share(allRows, (x) => x.device, 4),
      byGenderAge: share(allRows, (x) => `${x.gender} ${x.age}`, 8),
      unitPrice: { 15: `¥${UNIT_PRICE[15]}`, 30: `¥${UNIT_PRICE[30]}`, 60: `¥${UNIT_PRICE[60]}` },
      frequency: FREQ,
    },
    cases: filtered.slice(0, Math.min(30, Math.max(1, input.limit ?? 12))).map((c) => c.out),
    rules: "1件＝広告グループ（TVerでエリアを設定する単位）。読み方＝「人口◯万人の商圏で月◯万円打つと、30日で約◯回見られ・約◯人（住民の◯%）に届き・完全視聴率◯%」。到達人数は表示回数÷平均フリークエンシー（実測）の推計。他拠点の案件は広告主名を伏せ、金額は帯だけ＝比率と規模を『型』として借りる。提案では「グループの実績では〜」と書き、固有名詞は出さない。数字には「目安・税抜」を添える",
  };
}
