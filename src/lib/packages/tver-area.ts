// ==============================================================
// 地域リーチ固定パッケージ（TVer）— エリア別の目安
//   「この市だと、月額いくらで住民の何%に届くか」を出す。母集団（市内TVer視聴者）は lib/tver/plan.ts（資料と同じ推計）
//   ・月の再生数 = 月額 ÷ 再生単価（15秒 ¥6.6＝卸値×3・2026-08-10 代表決定）
//   ・月に届く人数 = 月の再生数 ÷ 実測フリークエンシー 4.78（安藤工事様 2026/6-7・1ヶ月）
//     ※ 資料の「到達1人あたり単価 ¥37」で月額を割る方式は 2026-09-01 に代表指摘で撤回。
//        資料側の網羅プラン（3人に1人×月5回を ¥37/人×3ヶ月で売る）は再生単価と整合しない＝代表判断待ち
//   ・「商圏まるごと」= 市内TVer視聴者の3人に1人へ月平均4.78回 を ¥6.6 で買った月額（正直な計算）
//   ・住民比 = 到達人数 ÷ 市の総人口。視聴者比 = 到達人数 ÷ 市内TVer視聴者（推計）
//   ・政令市は区に分かれているので「○○市（全区）」の合算行を先頭に足す（既定はこれ）
//   ・数字は目安。保証しない（規定どおり「目安」と添えて言う）
// ==============================================================

import { MUNICIPALITIES } from "@/data/tver-municipalities";
import { PREFECTURES } from "@/lib/constants/crm";
import { COVER, FREQ, UNIT_PRICE, planForCodes, type AreaPlan } from "@/lib/tver/plan";

export const TVER_AREA_CALCULATOR = "tver-area";
export const MONTHLY_TIERS = [100_000, 150_000, 200_000, 300_000];
const GROUP_PREFIX = "group:";

export type AreaMuni = { code: string; name: string; population: number };

export function prefectureOptions(): string[] {
  return PREFECTURES.filter((p) => p !== "海外");
}

/** 県内の市区町村（人口のあるもの）。政令市は「○○市（全区）」の合算を先頭に。人口順 */
export function municipalitiesOf(prefName: string): AreaMuni[] {
  const rows = MUNICIPALITIES.filter((m) => m.prefName === prefName && m.population > 0);
  const wards = new Map<string, number>();
  for (const m of rows) {
    const w = /^(.+市).+区$/.exec(m.name);
    if (w) wards.set(w[1], (wards.get(w[1]) ?? 0) + m.population);
  }
  const groups: AreaMuni[] = [...wards.entries()].map(([city, population]) => ({ code: GROUP_PREFIX + city, name: `${city}（全区）`, population }));
  const singles: AreaMuni[] = rows.map((m) => ({ code: m.code, name: m.name, population: m.population }));
  return [...groups, ...singles].sort((a, b) => b.population - a.population);
}

/** 選択コード → 計算に渡す市区町村コードの配列（「○○市（全区）」は区に展開） */
function expandCodes(prefName: string, code: string): string[] {
  if (!code.startsWith(GROUP_PREFIX)) return [code];
  const city = code.slice(GROUP_PREFIX.length);
  return MUNICIPALITIES.filter((m) => m.prefName === prefName && m.population > 0 && m.name.startsWith(city) && /区$/.test(m.name)).map((m) => m.code);
}

export type AreaTier = { monthly: number; impressions: number; reach: number; pctResidents: number; pctViewers: number; isFull: boolean };
export interface AreaEstimate {
  plan: AreaPlan;
  tiers: AreaTier[];
  /** 表の前提（画面の注記に使う） */
  unitPrice: number; // 円/再生（15秒）
  freq: number; // 月の平均フリークエンシー（実測）
}

const round1man = (v: number) => Math.round(v / 10_000) * 10_000;

export function estimateArea(prefName: string, code: string): AreaEstimate | null {
  const plan = planForCodes(expandCodes(prefName, code), 15);
  if (!plan) return null;
  const unit = UNIT_PRICE[15];
  const tier = (monthly: number, isFull: boolean): AreaTier => {
    const impressions = monthly / unit;
    const reach = Math.min(impressions / FREQ, plan.viewers);
    return {
      monthly,
      impressions,
      reach,
      pctResidents: Math.min(100, (reach / plan.population) * 100),
      pctViewers: Math.min(100, (reach / plan.viewers) * 100),
      isFull,
    };
  };
  const tiers = MONTHLY_TIERS.map((m) => tier(m, false));
  // 商圏まるごと＝視聴者の3人に1人 × 月4.78回 × ¥6.6（1万円単位）
  const fullMonthly = Math.max(10_000, round1man(plan.viewers * COVER * FREQ * unit));
  const full = tier(fullMonthly, true);
  const merged = [...tiers.filter((t) => t.monthly !== full.monthly), full].sort((a, b) => a.monthly - b.monthly);
  return { plan, tiers: merged, unitPrice: unit, freq: FREQ };
}

/** URLの pref / city から表示対象を決める（無ければ既定県の最大の市） */
export function resolveArea(input: { pref?: string | null; city?: string | null; fallbackPref?: string | null }) {
  const prefs = prefectureOptions();
  const pref = input.pref && prefs.includes(input.pref) ? input.pref : input.fallbackPref && prefs.includes(input.fallbackPref) ? input.fallbackPref : "東京都";
  const munis = municipalitiesOf(pref);
  const city = input.city && munis.some((m) => m.code === input.city) ? input.city : munis[0]?.code ?? null;
  return { pref, prefs, munis, city };
}
