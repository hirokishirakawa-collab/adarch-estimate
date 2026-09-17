// ==============================================================
// TVer 配信申請 — 配信エリアのまとまり（県／市（全区）／市区町村）と、エリアごとの媒体費
//   画面（クライアント）とサーバー（保存・AI連携）の両方で使うので、DBに触らない。
//   エリアが2つ以上のときは、まとまりごとに媒体費を入れ、合計を広告予算と一致させる（2026-09-18 代表決定）。
// ==============================================================

import { MUNICIPALITIES } from "@/data/tver-municipalities";
import { getAreaLabel, municipalityOf, prefLabelOf } from "@/lib/constants/tver-campaign";

const LIVE_MUNIS = MUNICIPALITIES.filter((m) => m.population > 0);

export interface AreaUnit {
  /** まとまりの識別子（コードを並べ替えてつないだもの） */
  key: string;
  label: string;
  codes: string[];
  population: number;
}

export interface AreaBudget {
  codes: string[];
  amountJpy: number;
}

export const areaUnitKey = (codes: string[]) => [...codes].sort().join(",");

/** 選んだエリアの人口（住民基本台帳 2025-01-01） */
export function areaPopulation(codes: string[]): number {
  let n = 0;
  for (const c of codes) {
    const m = municipalityOf(c);
    if (m) n += m.population;
    else {
      const pref = prefLabelOf(c);
      if (pref) n += LIVE_MUNIS.filter((x) => x.prefName === pref).reduce((a, x) => a + x.population, 0);
    }
  }
  return n;
}

/** 県はそのまま、政令市の区がそろっていれば「○○市（全区）」にまとめる */
export function areaUnits(codes: string[]): AreaUnit[] {
  const out: AreaUnit[] = [];
  const chosen = new Set(codes);
  const done = new Set<string>();
  for (const c of codes) {
    if (done.has(c)) continue;
    const m = municipalityOf(c);
    if (!m) {
      done.add(c);
      out.push({ key: areaUnitKey([c]), label: getAreaLabel(c), codes: [c], population: areaPopulation([c]) });
      continue;
    }
    const w = /^(.+市).+区$/.exec(m.name);
    if (w) {
      const all = LIVE_MUNIS.filter((x) => x.prefName === m.prefName && x.name.startsWith(w[1]) && /区$/.test(x.name));
      if (all.every((x) => chosen.has(x.code))) {
        all.forEach((x) => done.add(x.code));
        const unitCodes = all.map((x) => x.code);
        out.push({
          key: areaUnitKey(unitCodes),
          label: `${m.prefName} ${w[1]}（全区）`,
          codes: unitCodes,
          population: all.reduce((a, x) => a + x.population, 0),
        });
        continue;
      }
    }
    done.add(c);
    out.push({ key: areaUnitKey([c]), label: `${m.prefName} ${m.name}`, codes: [c], population: m.population });
  }
  return out;
}

/**
 * エリアごとの媒体費を確かめて、保存する形（ラベルつき・エリアの並び順）に整える。
 *   エリアが1つ → 内訳は持たない（null）
 *   エリアが2つ以上 → 全エリアに1円以上・合計＝広告予算
 */
export function checkAreaBudgets(
  codes: string[],
  budget: number,
  raw: unknown
): { ok: true; areaBudgets: (AreaBudget & { label: string })[] | null } | { ok: false; error: string } {
  const units = areaUnits(codes);
  if (units.length < 2) return { ok: true, areaBudgets: null };

  const given = new Map<string, number>();
  if (Array.isArray(raw)) {
    for (const r of raw) {
      const codesOf = (r as AreaBudget)?.codes;
      const amount = Number((r as AreaBudget)?.amountJpy);
      if (Array.isArray(codesOf)) given.set(areaUnitKey(codesOf.map(String)), amount);
    }
  }

  const missing = units.filter((u) => {
    const a = given.get(u.key);
    return a == null || !Number.isInteger(a) || a <= 0;
  });
  if (missing.length > 0) {
    return { ok: false, error: `エリアごとの媒体費を入力してください（未入力: ${missing.map((u) => u.label).join("、")}）` };
  }

  const areaBudgets = units.map((u) => ({ label: u.label, codes: u.codes, amountJpy: given.get(u.key)! }));
  const total = areaBudgets.reduce((a, b) => a + b.amountJpy, 0);
  const target = Math.round(budget);
  if (total !== target) {
    return {
      ok: false,
      error: `エリアごとの媒体費の合計（¥${total.toLocaleString("ja-JP")}）が広告予算（¥${target.toLocaleString("ja-JP")}）と一致しません`,
    };
  }
  return { ok: true, areaBudgets };
}
