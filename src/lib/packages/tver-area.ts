// ==============================================================
// 地域リーチ固定パッケージ（TVer）— エリア別の目安
//   「この市だと、月額いくらで住民の何%に届くか」を出す。母集団（市内TVer視聴者）は lib/tver/plan.ts（資料と同じ推計）
//   2026-09-13 代表決定: 料金は lib/tver/plan.ts の料金ルール（①市町村プランの3プラン・人口2段の下限・②の境目）
//   ・行 = ①市町村プランの3プラン（同額は1枚にまとめる・月額30万以上は②大規模展開の印）＝申込ページと同じ額
//   ・月の再生数 = 月額 ÷ 基準単価（15秒 ¥6.6）、月に届く人数 = 再生数 ÷ 実測F 4.78
//   ・外に出す「月額の目安」は「最低料金〜（おすすめ：スタンダード額）」。旧網羅「3人に1人」は出さない
//   ・住民比 = 到達人数 ÷ 市の総人口。視聴者比 = 到達人数 ÷ 市内TVer視聴者（推計）
//   ・政令市は区に分かれているので「○○市（全区）」の合算行を先頭に足す（既定はこれ）
//   ・数字は目安（TVER_ESTIMATE_NOTE を添える）
// ==============================================================

import { MUNICIPALITIES } from "@/data/tver-municipalities";
import { PREFECTURES } from "@/lib/constants/crm";
import { CITY_PLAN_RATES, FREQ, UNIT_PRICE, cityPlansFor, estimateDelivery, planForCodes, type AreaPlan, type CityPlanKey } from "@/lib/tver/plan";

export const TVER_AREA_CALCULATOR = "tver-area";
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

/** 1つの選択（市区町村 or 「○○市（全区）」）の商圏プラン。小口申込（/order/tver）の目安計算にも使う */
export function areaPlanFor(prefName: string, code: string): AreaPlan | null {
  return planForCodes(expandCodes(prefName, code), 15);
}

export type AreaTier = {
  key: CityPlanKey;
  name: string;
  perResidents: number;
  monthly: number;
  impressions: number;
  reach: number;
  pctResidents: number;
  pctViewers: number;
  /** 人口2段の下限に張り付いた */
  floored: boolean;
  /** 月額30万以上＝②大規模展開 */
  custom: boolean;
  /** 同額にまとめたプラン名（例: ライト） */
  mergedWith: string[];
  /** おすすめ（申込ページの既定プラン） */
  recommended: boolean;
};
export interface AreaEstimate {
  plan: AreaPlan;
  /** ①の3プラン（同額はまとめ済み・安い順。②の行も custom で残す） */
  tiers: AreaTier[];
  /** 「最低料金〜」の額。null＝どのプランも月額30万以上（大規模展開の個別見積） */
  minMonthly: number | null;
  /** おすすめのプラン（スタンダード→ライト→フルで申込できるもの） */
  recommended: AreaTier | null;
  /** このエリアの最低料金（人口2段）と最短期間 */
  floor: number;
  minMonths: 3 | 6;
  small: boolean;
  unitPrice: number; // 円/再生（15秒）
  freq: number; // 月の平均フリークエンシー（実測）
}

export function estimateArea(prefName: string, code: string): AreaEstimate | null {
  const plan = planForCodes(expandCodes(prefName, code), 15);
  if (!plan) return null;
  const cp = cityPlansFor(plan.population);
  const tiers: AreaTier[] = CITY_PLAN_RATES.filter((r) => !cp.rows[r.key].mergedInto)
    .map((r) => {
      const row = cp.rows[r.key];
      const d = estimateDelivery(row.fee, { viewers: plan.viewers, population: plan.population });
      return {
        key: r.key,
        name: r.name,
        perResidents: r.perResidents,
        monthly: row.fee,
        impressions: d.impressions,
        reach: d.reach,
        pctResidents: d.pctResidents ?? 0,
        pctViewers: d.pctViewers ?? 0,
        floored: row.floored,
        custom: row.custom,
        mergedWith: CITY_PLAN_RATES.filter((x) => cp.rows[x.key].mergedInto === r.key).map((x) => x.name),
        recommended: r.key === cp.defaultPlan,
      };
    })
    .sort((a, b) => a.monthly - b.monthly);
  return {
    plan,
    tiers,
    minMonthly: cp.minFee,
    recommended: tiers.find((t) => t.recommended) ?? null,
    floor: cp.floor,
    minMonths: cp.minMonths,
    small: cp.small,
    unitPrice: UNIT_PRICE[15],
    freq: FREQ,
  };
}

/** 「月額 ¥66,000〜（おすすめ：スタンダード ¥264,000）」の1行（LP・MCP・AI用材料で共通） */
export function monthlyGuideText(e: AreaEstimate): string {
  const yen = (n: number) => `¥${Math.round(n).toLocaleString("ja-JP")}`;
  if (e.minMonthly == null) return "月額30万円以上（大規模展開・個別にお見積り）";
  const rec = e.recommended;
  return `月額 ${yen(e.minMonthly)}〜${rec && rec.monthly !== e.minMonthly ? `（おすすめ：${rec.name} ${yen(rec.monthly)}）` : rec ? `（おすすめ：${rec.name}）` : ""}`;
}

/** URLの pref / city から表示対象を決める（無ければ既定県の最大の市） */
export function resolveArea(input: { pref?: string | null; city?: string | null; fallbackPref?: string | null }) {
  const prefs = prefectureOptions();
  const pref = input.pref && prefs.includes(input.pref) ? input.pref : input.fallbackPref && prefs.includes(input.fallbackPref) ? input.fallbackPref : "東京都";
  const munis = municipalitiesOf(pref);
  const city = input.city && munis.some((m) => m.code === input.city) ? input.city : munis[0]?.code ?? null;
  return { pref, prefs, munis, city };
}
