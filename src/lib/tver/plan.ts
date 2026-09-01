// TVer「商圏網羅プラン」計算層（サーバー/クライアント共用・純粋関数）
//
// 正本: ~/Desktop/05_媒体・提案資料/TVer販売説明資料_2026-08/_source/tver_data.py（2026-08-10 代表確定）
//   県内TVer視聴者 = 全国MUB 4,470万（TVer INC. 2026年1月）× 県の15〜64歳人口比（総務省 人口推計 2024/10/1）
//   市内視聴者     = 県内視聴者 × 市の人口シェア（総務省 住民基本台帳 2025/1/1 = tver-municipalities.ts）
//   「網羅」       = 商圏のTVer視聴者の3人に1人へ、3ヶ月で約5回（月約2回）。標準3ヶ月
//                    ※ 2026-09-01 代表決定で「ひと月平均約5回」から訂正（¥37/人×3ヶ月の価格と ¥6.6/再生 を両立させる正直な表現）
//   販売単価       = 卸値×3（15秒 ¥6.6/再生）。到達1人あたり単価は安藤工事様の実測を母集団規模で補間
//
// ※ 既存の TVerSimulator（人口×普及率30%）とは視聴者の推計式が異なる。
//   チラシ・企画書は本ファイル（資料と同じ数字が出る側）を使う。

import { MUNICIPALITIES, type Municipality } from "@/data/tver-municipalities";

export const MUB_TOTAL = 44_700_000;
const P1564_TOTAL = 73_728; // 千人

/** 都道府県: [総人口(千人), 15〜64歳人口(千人)] — 総務省 人口推計 2024/10/1 */
const PREF: Record<string, [number, number]> = {
  北海道: [5043, 2868], 青森県: [1165, 634], 岩手県: [1145, 624], 宮城県: [2248, 1340],
  秋田県: [897, 463], 山形県: [1011, 546], 福島県: [1743, 972], 茨城県: [2806, 1637],
  栃木県: [1885, 1106], 群馬県: [1890, 1098], 埼玉県: [7332, 4500], 千葉県: [6251, 3804],
  東京都: [14178, 9469], 神奈川県: [9225, 5817], 新潟県: [2099, 1162], 富山県: [997, 561],
  石川県: [1098, 636], 福井県: [739, 417], 山梨県: [791, 453], 長野県: [1987, 1111],
  岐阜県: [1916, 1096], 静岡県: [3527, 2035], 愛知県: [7460, 4626], 三重県: [1711, 990],
  滋賀県: [1402, 841], 京都府: [2520, 1502], 大阪府: [8757, 5371], 兵庫県: [5337, 3112],
  奈良県: [1285, 720], 和歌山県: [880, 481], 鳥取県: [531, 289], 島根県: [642, 341],
  岡山県: [1831, 1045], 広島県: [2714, 1569], 山口県: [1281, 688], 徳島県: [685, 369],
  香川県: [917, 512], 愛媛県: [1276, 697], 高知県: [656, 348], 福岡県: [5092, 3004],
  佐賀県: [788, 436], 長崎県: [1252, 669], 熊本県: [1697, 931], 大分県: [1085, 588],
  宮崎県: [1033, 553], 鹿児島県: [1532, 817], 沖縄県: [1466, 880],
};

export const COVER = 1 / 3; // 網羅 = 3人に1人
export const MONTHS = 3; // 標準期間
export const FREQ = 4.78; // 実測平均フリークエンシー（安藤工事様 2026/6-7）
const MULT = 3; // 卸値×3

/** 秒数別 再生単価（円/再生）。15秒 ¥6.6 が基準 */
export const UNIT_PRICE: Record<15 | 30 | 60, number> = { 15: 2.2 * MULT, 30: 4.4 * MULT, 60: 8.8 * MULT };
export type AdSeconds = 15 | 30 | 60;

/** 県内TVer月間利用者数（推計） */
export function prefViewers(prefName: string): number {
  const p = PREF[prefName];
  if (!p) return 0;
  return (MUB_TOTAL * p[1]) / P1564_TOTAL;
}

/** 県の総人口（人） */
export function prefPopulation(prefName: string): number {
  const p = PREF[prefName];
  return p ? p[0] * 1000 : 0;
}

/** 到達1人あたりの卸値ベース原価（15秒）: 福岡（母集団182万）¥9.2 ／ 地方（60万以下）¥12.35 を補間 */
function costPerReachBase(viewers: number): number {
  if (viewers >= 1_800_000) return 9.2;
  if (viewers <= 600_000) return 12.35;
  return 12.35 + ((9.2 - 12.35) * (viewers - 600_000)) / (1_800_000 - 600_000);
}

/** 到達1人あたり販売単価 */
export function costPerReach(viewers: number, seconds: AdSeconds = 15): number {
  return costPerReachBase(viewers) * MULT * (UNIT_PRICE[seconds] / UNIT_PRICE[15]);
}

const round1man = (v: number) => Math.round(v / 10_000) * 10_000;

export interface AreaPlan {
  prefName: string;
  /** 表示用エリア名（例: 唐津市 ／ 高松市・丸亀市 ／ 札幌市） */
  areaLabel: string;
  municipalities: Municipality[];
  population: number;
  viewers: number; // 商圏内TVer視聴者（推計）
  reach: number; // 到達人数（3人に1人）
  unit: number; // 到達1人あたり単価
  seconds: AdSeconds;
  total: number; // 3ヶ月総額（1万円単位）
  monthly: number; // 月額（1万円単位）
  /** 同じ¥1,000,000でのカバー率 */
  coverageAt1M: { reach: number; pct: number };
}

const byCode = new Map(MUNICIPALITIES.map((m) => [m.code, m]));

export function findMunicipality(code: string): Municipality | undefined {
  return byCode.get(code);
}

/** 選択した市区町村名を表示ラベルにまとめる（政令市の複数区は市名に畳む） */
export function buildAreaLabel(names: string[]): string {
  const out: string[] = [];
  const seen = new Set<string>();
  const wardCount = new Map<string, number>();
  for (const n of names) {
    const m = n.match(/^(.+市).+区$/);
    if (m) wardCount.set(m[1], (wardCount.get(m[1]) ?? 0) + 1);
  }
  for (const n of names) {
    const m = n.match(/^(.+市).+区$/);
    const key = m && (wardCount.get(m[1]) ?? 0) >= 2 ? m[1] : n;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(key);
  }
  return out.join("・");
}

/** 市区町村コードの配列から商圏網羅プランを計算する（複数市の合算可・同一県内が前提） */
export function planForCodes(codes: string[], seconds: AdSeconds = 15): AreaPlan | null {
  const ms = codes.map((c) => byCode.get(c)).filter((m): m is Municipality => !!m && m.population > 0);
  if (ms.length === 0) return null;
  const prefName = ms[0].prefName;
  const prefPop = prefPopulation(prefName);
  if (!prefPop) return null;
  const pv = prefViewers(prefName);

  let population = 0;
  let viewers = 0;
  for (const m of ms) {
    // 他県が混ざった場合はその県の視聴者で按分
    const p = m.prefName === prefName ? prefPop : prefPopulation(m.prefName);
    const v = m.prefName === prefName ? pv : prefViewers(m.prefName);
    population += m.population;
    viewers += (v * m.population) / p;
  }
  const unit = costPerReach(viewers, seconds);
  const reach = viewers * COVER;
  const total = round1man(reach * unit);
  const monthly = round1man(total / MONTHS);
  const r1m = 1_000_000 / unit;

  return {
    prefName,
    areaLabel: buildAreaLabel(ms.map((m) => m.name)),
    municipalities: ms,
    population,
    viewers,
    reach,
    unit,
    seconds,
    total,
    monthly,
    coverageAt1M: { reach: Math.min(r1m, viewers), pct: Math.min(100, (r1m / viewers) * 100) },
  };
}

/** 任意予算（媒体費・円）でのカバー率 */
export function coverageAt(plan: AreaPlan, budget: number): { reach: number; pct: number } {
  const r = budget / plan.unit;
  return { reach: Math.min(r, plan.viewers), pct: Math.min(100, (r / plan.viewers) * 100) };
}

/** 同じ県内で人口規模の近い市を最大 n 件（比較表用）。政令市の区・町村は除く */
export function neighborPlans(plan: AreaPlan, n = 3, seconds: AdSeconds = 15): AreaPlan[] {
  const selected = new Set(plan.municipalities.map((m) => m.code));
  const cands = MUNICIPALITIES.filter(
    (m) =>
      m.prefName === plan.prefName &&
      !selected.has(m.code) &&
      m.population > 0 &&
      /市$/.test(m.name) &&
      !/区$/.test(m.name)
  );
  const sorted = cands.sort(
    (a, b) => Math.abs(a.population - plan.population) - Math.abs(b.population - plan.population)
  );
  return sorted
    .slice(0, n)
    .map((m) => planForCodes([m.code], seconds))
    .filter((p): p is AreaPlan => !!p)
    .sort((a, b) => b.population - a.population);
}

// ── 表示ヘルパー ──
export function fmtMan(n: number): string {
  if (n >= 10_000) return `${(n / 10_000).toFixed(1)}万人`;
  return `${Math.round(n).toLocaleString("ja-JP")}人`;
}
export function fmtYen(n: number): string {
  return `¥${Math.round(n).toLocaleString("ja-JP")}`;
}
