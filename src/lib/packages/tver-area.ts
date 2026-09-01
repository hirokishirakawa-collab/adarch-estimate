// ==============================================================
// 地域リーチ固定パッケージ（TVer）— エリア別の目安
//   「この市だと、月額いくらで住民の何%に届くか」を出す。計算は lib/tver/plan.ts（資料と同じ数字）
//   ・月額の段（10万/15万/20万/30万）＋ 網羅プラン（3人に1人×月5回・資料の標準）
//   ・住民比 = 到達人数 ÷ 市の総人口。視聴者比 = 到達人数 ÷ 市内TVer視聴者（推計）
//   ・政令市は区に分かれているので「○○市（全区）」の合算行を先頭に足す（既定はこれ）
//   ・数字は目安。保証しない（規定どおり「目安」と添えて言う）
// ==============================================================

import { MUNICIPALITIES } from "@/data/tver-municipalities";
import { PREFECTURES } from "@/lib/constants/crm";
import { coverageAt, planForCodes, type AreaPlan } from "@/lib/tver/plan";

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

export type AreaTier = { monthly: number; reach: number; pctResidents: number; pctViewers: number; isFull: boolean };
export interface AreaEstimate {
  plan: AreaPlan;
  tiers: AreaTier[];
}

export function estimateArea(prefName: string, code: string): AreaEstimate | null {
  const plan = planForCodes(expandCodes(prefName, code), 15);
  if (!plan) return null;
  const tier = (monthly: number, isFull: boolean): AreaTier => {
    const c = coverageAt(plan, monthly);
    return { monthly, reach: c.reach, pctResidents: Math.min(100, (c.reach / plan.population) * 100), pctViewers: c.pct, isFull };
  };
  const tiers = MONTHLY_TIERS.map((m) => tier(m, false));
  // 網羅プラン（資料の標準）。既に同額の段があれば置き換え
  const full = tier(plan.monthly, true);
  const merged = [...tiers.filter((t) => t.monthly !== full.monthly), full].sort((a, b) => a.monthly - b.monthly);
  return { plan, tiers: merged };
}

/** URLの pref / city から表示対象を決める（無ければ既定県の最大の市） */
export function resolveArea(input: { pref?: string | null; city?: string | null; fallbackPref?: string | null }) {
  const prefs = prefectureOptions();
  const pref = input.pref && prefs.includes(input.pref) ? input.pref : input.fallbackPref && prefs.includes(input.fallbackPref) ? input.fallbackPref : "東京都";
  const munis = municipalitiesOf(pref);
  const city = input.city && munis.some((m) => m.code === input.city) ? input.city : munis[0]?.code ?? null;
  return { pref, prefs, munis, city };
}
