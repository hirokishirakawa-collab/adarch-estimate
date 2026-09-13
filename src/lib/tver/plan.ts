// TVer「商圏網羅プラン」計算層（サーバー/クライアント共用・純粋関数）
//
// 正本: ~/Desktop/05_媒体・提案資料/TVer販売説明資料_2026-08/_source/tver_data.py（2026-08-10 代表確定）
//   県内TVer視聴者 = 全国MUB 4,470万（TVer INC. 2026年1月）× 県の15〜64歳人口比（総務省 人口推計 2024/10/1）
//   市内視聴者     = 県内視聴者 × 市の人口シェア（総務省 住民基本台帳 2025/1/1 = tver-municipalities.ts）
//   「網羅」       = 商圏のTVer視聴者の3人に1人へ、3ヶ月で約5回（月約2回）。標準3ヶ月
//                    ※ 2026-09-01 代表決定で「ひと月平均約5回」から訂正（¥37/人×3ヶ月の価格と ¥6.6/再生 を両立させる正直な表現）
//   販売単価       = 卸値×3（15秒 ¥6.6/再生）。到達1人あたり単価は安藤工事様の実測を母集団規模で補間
//
// ※ 2026-09-13: 料金ルール（①市町村プラン／②大規模展開・下限・手数料・目安）もこのファイルに集約（末尾）。
//   シミュレーター・申込ページ・申込リンク・LP・MCP・チラシは全部ここを読む（旧 lib/media/tver-sim.ts は廃止）。
//   下の「網羅（3人に1人・costPerReach）」はチラシ移行（第3弾）までの互換。新規で使わない。

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

/** 秒数別 再生単価（円/再生）。15秒 ¥6.6／30秒 ¥7.8／60秒 ¥11.1 */
/** 卸値（TVerフロア価格表 2026-03・円/再生）。配信実績CSVの CPM（円/1000表示）÷1000 と一致する */
export const WHOLESALE_UNIT: Record<15 | 30 | 60, number> = { 15: 2.2, 30: 2.6, 60: 3.7 };
/** 卸値→売値の係数。配信実績の取込（src/lib/tver/delivery-csv.ts）もこの1か所を使う */
export const SELL_MULTIPLIER = MULT;
const r2 = (x: number) => Math.round(x * 100) / 100; // 2.2*3=6.6000000000000005 を 6.6 に
export const UNIT_PRICE: Record<15 | 30 | 60, number> = { 15: r2(WHOLESALE_UNIT[15] * MULT), 30: r2(WHOLESALE_UNIT[30] * MULT), 60: r2(WHOLESALE_UNIT[60] * MULT) }; // 卸値=TVerフロア価格表(2026-03): 15秒¥2.2/30秒¥2.6/60秒¥3.7 → 売値 ¥6.6/¥7.8/¥11.1（2026-09-03 代表確認: シミュレーターと同じ「各秒数の原価×3」）
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

// ==============================================================
// 料金ルール（2026-09-13 代表決定）— TVerの料金・手数料・目安はすべてここを通す
//   売値 = 卸値×3。月額はTVer:代表者:本部で3等分＝TVerに入るのは月額の1/3だけ
//     → 再生数・届く人数は「目安」（¥6.6/再生を約束しない・「保証」の表現は使わない）
//     → 目安の再生数は常に「月額 ÷ 基準単価（15秒¥6.6）」。値引きしても基準単価で割る（値引きぶん目安も下がる）
//   ① 市町村プラン（既製の型）: 初回登録費なし・管理費なし・1エリア・15秒・途中変更なし・終了後に結果報告のみ・値引きなし
//        月額 = 人口 ÷ N × 実測F × ¥6.6（千円切上）。下限だけ人口で2段（5万人未満 ¥30,000・6ヶ月以上／5万人以上 ¥50,000・3ヶ月以上）
//   ② 大規模展開（オーダー）: 月額30万以上／2エリア以上／週次報告の希望 のどれか。15/30/60秒
//        設計・考査費 ¥150,000（初回）＋運用管理費 = max(媒体費×20%, ¥50,000)／月。手数料は値引き不可
//        値引きは再生単価だけ・下限は卸値×2（15秒 ¥4.4）
//   ※ 3等分・卸値・値引きの下限は、お客様向け表示・Wiki・AI用材料・MCPに出さない
// ==============================================================

/** 値引きの下限単価（卸値×2）。代表者の画面（シミュレーター②）だけで使う */
export const UNIT_PRICE_FLOOR: Record<AdSeconds, number> = { 15: r2(WHOLESALE_UNIT[15] * 2), 30: r2(WHOLESALE_UNIT[30] * 2), 60: r2(WHOLESALE_UNIT[60] * 2) };

/** 「目安」の注記（画面・PDF・申込ページ・LP等で共通の文言） */
export const TVER_ESTIMATE_NOTE =
  "再生数・届く人数は公的統計と当社の配信実績にもとづく目安です。TVerの配信状況によって上下し、お約束するものではありません。";

export const CITY_PLAN_SECONDS = 15 as const;
/** 人口の境目（これ未満は小さな市町村の下限） */
export const CITY_POP_THRESHOLD = 50_000;
/** ①の下限（人口2段） */
export function cityPlanTerms(population: number): { floor: number; minMonths: 3 | 6; small: boolean } {
  return population < CITY_POP_THRESHOLD ? { floor: 30_000, minMonths: 6, small: true } : { floor: 50_000, minMonths: 3, small: false };
}

/** ①の3つの到達率（住民の N人に1人へ月に届ける） */
export const CITY_PLAN_RATES = [
  { key: "light", name: "ライト", perResidents: 200 },
  { key: "standard", name: "スタンダード", perResidents: 50 },
  { key: "full", name: "フル", perResidents: 20 },
] as const;
export type CityPlanKey = (typeof CITY_PLAN_RATES)[number]["key"];

/** ②になる月額（これ以上は大規模展開） */
export const CUSTOM_MONTHLY_FROM = 300_000;
export const CUSTOM_DESIGN_FEE = 150_000;
export const CUSTOM_OPS_RATE = 0.2;
export const CUSTOM_OPS_MIN = 50_000;
export const CUSTOM_SECONDS: AdSeconds[] = [15, 30, 60];

const ceil1000 = (v: number) => Math.ceil(v / 1000) * 1000;

/** ①の月額（人口÷N×F×¥6.6 を千円切上 → 人口2段の下限） */
export function cityPlanMonthly(population: number, perResidents: number): { fee: number; raw: number; floored: boolean } {
  const raw = ceil1000((population / perResidents) * FREQ * UNIT_PRICE[15]);
  const { floor } = cityPlanTerms(population);
  return { fee: Math.max(floor, raw), raw, floored: raw < floor };
}

export type CityPlanRow = {
  key: CityPlanKey;
  perResidents: number;
  /** 月額（税抜）＝人口の式 → 人口2段の下限 */
  fee: number;
  raw: number;
  floored: boolean;
  /** 月額30万以上＝②大規模展開（Web申込には出さない） */
  custom: boolean;
  /** 同じ額の別プランにまとめた＝このプランは出さない（まとめ先のキー） */
  mergedInto: CityPlanKey | null;
};
export type CityPlans = {
  floor: number;
  minMonths: 3 | 6;
  small: boolean;
  rows: Record<CityPlanKey, CityPlanRow>;
  /** 出すプラン（まとめ・②を除く）を安い順 */
  visible: CityPlanRow[];
  /** 既定で勧めるプラン（スタンダード→ライト→フルの順で出せるもの）。無ければ②だけのエリア */
  defaultPlan: CityPlanKey | null;
  /** 「最低料金〜」に出す額（出せるプランの最安）。null＝どのプランも②（大規模展開の個別見積） */
  minFee: number | null;
};

/** ①の3プラン（同額は1枚にまとめる・30万以上は②）。申込ページ・LP・MCP・AI用材料が同じ額を出すための1か所 */
export function cityPlansFor(population: number): CityPlans {
  const terms = cityPlanTerms(population);
  const rows = {} as Record<CityPlanKey, CityPlanRow>;
  for (const r of CITY_PLAN_RATES) {
    const m = cityPlanMonthly(population, r.perResidents);
    rows[r.key] = { key: r.key, perResidents: r.perResidents, fee: m.fee, raw: m.raw, floored: m.floored, custom: m.fee >= CUSTOM_MONTHLY_FROM, mergedInto: null };
  }
  // 同じ額は1枚に（スタンダードがあればスタンダード、なければ上位のプランを残す）
  const keep = (a: CityPlanKey, b: CityPlanKey): CityPlanKey => (a === "standard" || b === "standard" ? "standard" : a === "full" || b === "full" ? "full" : a);
  const keys = CITY_PLAN_RATES.map((r) => r.key);
  for (let i = 0; i < keys.length; i++) {
    for (let j = i + 1; j < keys.length; j++) {
      const x = rows[keys[i]], y = rows[keys[j]];
      if (x.mergedInto || y.mergedInto || x.fee !== y.fee) continue;
      const k = keep(x.key, y.key);
      (k === x.key ? y : x).mergedInto = k;
    }
  }
  const visible = keys.map((k) => rows[k]).filter((r) => !r.mergedInto && !r.custom).sort((a, b) => a.fee - b.fee);
  const defaultPlan = (["standard", "light", "full"] as const).find((k) => !rows[k].mergedInto && !rows[k].custom) ?? null;
  return { ...terms, rows, visible, defaultPlan, minFee: visible[0]?.fee ?? null };
}

export type TverPlanKind = "city" | "custom";

/** ①②の判定（境目＝運用の手間）。reasons は②になった理由 */
export function classifyTverPlan(input: { monthly: number; areaCount: number; weeklyReport?: boolean; seconds?: number }): { kind: TverPlanKind; reasons: string[] } {
  const reasons: string[] = [];
  if (input.monthly >= CUSTOM_MONTHLY_FROM) reasons.push(`月額${CUSTOM_MONTHLY_FROM / 10_000}万円以上`);
  if (input.areaCount >= 2) reasons.push("2エリア以上");
  if (input.weeklyReport) reasons.push("週次報告を希望");
  if (input.seconds != null && input.seconds !== CITY_PLAN_SECONDS) reasons.push(`${input.seconds}秒`);
  return { kind: reasons.length ? "custom" : "city", reasons };
}

/** 手数料（税抜）。①は0。②は設計・考査費（初回）＋運用管理費（月）。値引きの入力は受けない */
export function tverFees(kind: TverPlanKind, mediaMonthly: number, isFirst: boolean): { designFee: number; opsFeeMonthly: number; opsMinApplied: boolean } {
  if (kind === "city") return { designFee: 0, opsFeeMonthly: 0, opsMinApplied: false };
  const rate = Math.round(mediaMonthly * CUSTOM_OPS_RATE);
  return { designFee: isFirst ? CUSTOM_DESIGN_FEE : 0, opsFeeMonthly: Math.max(rate, CUSTOM_OPS_MIN), opsMinApplied: rate < CUSTOM_OPS_MIN };
}

/** 値引き単価を下限に収める（②だけ）。基準単価より上は基準単価に */
export function clampUnitPrice(price: number, seconds: AdSeconds): { price: number; atFloor: boolean } {
  const floor = UNIT_PRICE_FLOOR[seconds];
  const list = UNIT_PRICE[seconds];
  if (!Number.isFinite(price) || price < floor) return { price: floor, atFloor: true };
  return { price: Math.min(r2(price), list), atFloor: false };
}

/** 月額からの目安。再生数 = 月額 ÷ 基準単価（値引き単価では割らない）、届く人数 = 再生数 ÷ 実測F（視聴者数で頭打ち） */
export function estimateDelivery(monthly: number, opts: { seconds?: AdSeconds; viewers?: number; population?: number } = {}): { impressions: number; reach: number; pctResidents: number | null; pctViewers: number | null } {
  const unit = UNIT_PRICE[opts.seconds ?? 15];
  const impressions = Math.max(0, monthly) / unit;
  const byImp = impressions / FREQ;
  const reach = opts.viewers != null ? Math.min(byImp, opts.viewers) : byImp;
  return {
    impressions,
    reach,
    pctResidents: opts.population ? Math.min(100, (reach / opts.population) * 100) : null,
    pctViewers: opts.viewers ? Math.min(100, (reach / opts.viewers) * 100) : null,
  };
}

/** 選んだ市区町村コードを「エリア数」に数える（政令市の区は1市＝1エリア） */
export function countAreas(codes: string[]): number {
  const keys = new Set<string>();
  for (const c of codes) {
    const m = byCode.get(c);
    if (!m) continue;
    const w = /^(.+市).+区$/.exec(m.name);
    keys.add(`${m.prefName}:${w ? w[1] : m.name}`);
  }
  return keys.size;
}

// ── 表示ヘルパー ──
export function fmtMan(n: number): string {
  if (n >= 10_000) return `${(n / 10_000).toFixed(1)}万人`;
  return `${Math.round(n).toLocaleString("ja-JP")}人`;
}
export function fmtYen(n: number): string {
  return `¥${Math.round(n).toLocaleString("ja-JP")}`;
}
