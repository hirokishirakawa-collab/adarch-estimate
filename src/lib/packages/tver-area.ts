// ==============================================================
// 地域リーチ固定パッケージ（TVer）— エリア別の目安
//   「この市だと、月額いくらで住民の何%に届くか」を出す。計算は lib/tver/plan.ts（資料と同じ数字）
//   ・月額の段（10万/15万/20万/30万）＋ 網羅プラン（3人に1人×月5回・資料の標準）
//   ・住民比 = 到達人数 ÷ 市の総人口。視聴者比 = 到達人数 ÷ 市内TVer視聴者（推計）
//   ・数字は目安。保証しない（規定どおり「目安」と添えて言う）
// ==============================================================

import { MUNICIPALITIES } from "@/data/tver-municipalities";
import { PREFECTURES } from "@/lib/constants/crm";
import { coverageAt, planForCodes, type AreaPlan } from "@/lib/tver/plan";

export const TVER_AREA_CALCULATOR = "tver-area";
export const MONTHLY_TIERS = [100_000, 150_000, 200_000, 300_000];

export type AreaMuni = { code: string; name: string; population: number };

export function prefectureOptions(): string[] {
  return PREFECTURES.filter((p) => p !== "海外");
}

/** 県内の市区町村（人口のあるもの。人口順） */
export function municipalitiesOf(prefName: string): AreaMuni[] {
  return MUNICIPALITIES.filter((m) => m.prefName === prefName && m.population > 0)
    .map((m) => ({ code: m.code, name: m.name, population: m.population }))
    .sort((a, b) => b.population - a.population);
}

export type AreaTier = { monthly: number; reach: number; pctResidents: number; pctViewers: number; isFull: boolean };
export interface AreaEstimate {
  plan: AreaPlan;
  tiers: AreaTier[];
}

export function estimateArea(codes: string[]): AreaEstimate | null {
  const plan = planForCodes(codes, 15);
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

/** URLの pref / city から表示対象を決める（無ければ既定県の最大都市） */
export function resolveArea(input: { pref?: string | null; city?: string | null; fallbackPref?: string | null }) {
  const prefs = prefectureOptions();
  const pref = input.pref && prefs.includes(input.pref) ? input.pref : input.fallbackPref && prefs.includes(input.fallbackPref) ? input.fallbackPref : "東京都";
  const munis = municipalitiesOf(pref);
  const city = input.city && munis.some((m) => m.code === input.city) ? input.city : munis[0]?.code ?? null;
  return { pref, prefs, munis, city };
}
