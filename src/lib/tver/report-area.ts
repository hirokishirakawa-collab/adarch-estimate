// ==============================================================
// TVer配信実績の「商圏」＝どの規模の市町村で打ったか
//   申込（TverOrder）に紐づけば市区町村マスターから人口を引く。無ければ明細の都道府県から県全域として扱う。
//   本部は詳細画面で商圏を選び直せる（areaKey: "PREF:福岡県" または "MUNI:福岡県:<code>"）
//   ベンチマークの帯（人口帯・月額帯）もここで1か所に定義する
// ==============================================================

import { municipalitiesOf } from "@/lib/packages/tver-area";
import { prefPopulation } from "@/lib/tver/plan";

export type ReportArea = { areaLabel: string; areaPopulation: number };

/** 申込の市区町村コードから商圏を出す（政令市の「全区」コードにも対応） */
export function areaFromOrder(prefName: string, municipalityCode: string, areaLabel: string): ReportArea {
  const m = municipalitiesOf(prefName).find((x) => x.code === municipalityCode);
  return { areaLabel: `${prefName} ${m?.name ?? areaLabel}`, areaPopulation: m?.population ?? prefPopulation(prefName) };
}

/** 明細の都道府県（複数なら合算＝県全域の並列配信） */
export function areaFromPrefectures(prefs: string[]): ReportArea | null {
  const list = [...new Set(prefs.filter(Boolean))];
  if (list.length === 0) return null;
  const pop = list.reduce((a, p) => a + prefPopulation(p), 0);
  if (pop === 0) return null;
  return { areaLabel: list.length === 1 ? `${list[0]} 全域` : `${list.join("・")} 全域`, areaPopulation: pop };
}

/** 詳細画面の選び直し用キー → 商圏 */
export function areaFromKey(key: string): ReportArea | null {
  const [kind, pref, code] = key.split(":");
  if (kind === "PREF" && pref) {
    const pop = prefPopulation(pref);
    return pop ? { areaLabel: `${pref} 全域`, areaPopulation: pop } : null;
  }
  if (kind === "MUNI" && pref && code) {
    const m = municipalitiesOf(pref).find((x) => x.code === code);
    return m ? { areaLabel: `${pref} ${m.name}`, areaPopulation: m.population } : null;
  }
  return null;
}

/** 詳細画面に出す選択肢（レポートに出てくる県の市区町村＋県全域） */
export function areaOptionsFor(prefs: string[]): { key: string; label: string; population: number }[] {
  const out: { key: string; label: string; population: number }[] = [];
  for (const p of [...new Set(prefs.filter(Boolean))]) {
    const pop = prefPopulation(p);
    if (pop) out.push({ key: `PREF:${p}`, label: `${p} 全域`, population: pop });
    for (const m of municipalitiesOf(p)) out.push({ key: `MUNI:${p}:${m.code}`, label: `${p} ${m.name}`, population: m.population });
  }
  return out;
}

// ---- ベンチマークの帯 ----------------------------------------------------------

export const POPULATION_BANDS: { key: string; label: string; min: number; max: number }[] = [
  { key: "p1", label: "〜5万人", min: 0, max: 50_000 },
  { key: "p2", label: "5〜10万人", min: 50_000, max: 100_000 },
  { key: "p3", label: "10〜30万人", min: 100_000, max: 300_000 },
  { key: "p4", label: "30〜100万人", min: 300_000, max: 1_000_000 },
  { key: "p5", label: "100万人〜（政令市・県全域）", min: 1_000_000, max: Infinity },
];
export const BUDGET_BANDS: { key: string; label: string; min: number; max: number }[] = [
  { key: "b1", label: "月5万円未満", min: 0, max: 50_000 },
  { key: "b2", label: "月5〜10万円", min: 50_000, max: 100_000 },
  { key: "b3", label: "月10〜20万円", min: 100_000, max: 200_000 },
  { key: "b4", label: "月20〜50万円", min: 200_000, max: 500_000 },
  { key: "b5", label: "月50万円〜", min: 500_000, max: Infinity },
];
export const populationBand = (pop: number | null | undefined) => (pop == null ? null : POPULATION_BANDS.find((b) => pop >= b.min && pop < b.max) ?? null);
export const budgetBand = (monthly: number | null | undefined) => (monthly == null ? null : BUDGET_BANDS.find((b) => monthly >= b.min && monthly < b.max) ?? null);
