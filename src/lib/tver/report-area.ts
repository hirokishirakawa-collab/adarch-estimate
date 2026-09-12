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

/** 全国とみなす都道府県数（TVerの全国配信は数県が0表示になることがあるので少し余裕を持たせる） */
const NATIONWIDE_MIN = 40;

/** 都道府県が多い時の表示名（40以上＝全国／5件以上＝「◯都道府県（北海道ほか◯）」／4件までは並べる） */
function prefLabel(list: string[]): string {
  if (list.length >= NATIONWIDE_MIN) return "全国";
  if (list.length === 1) return `${list[0]} 全域`;
  if (list.length <= 4) return `${list.join("・")} 全域`;
  return `${list.length}都道府県（${list[0]}ほか${list.length - 1}）`;
}

/** 明細の都道府県（複数なら合算＝県全域の並列配信） */
export function areaFromPrefectures(prefs: string[]): ReportArea | null {
  const list = [...new Set(prefs.filter(Boolean))];
  if (list.length === 0) return null;
  const pop = list.reduce((a, p) => a + prefPopulation(p), 0);
  if (pop === 0) return null;
  return { areaLabel: prefLabel(list), areaPopulation: pop };
}

/**
 * キャンペーン名・広告グループ名・クリエイティブ名に市区町村名が入っていれば商圏にする
 *   例: 「TV-2026-0042_久留米市_15s」「安藤工事_福岡市_全区」。複数の市が出てきたら合算（並列配信）
 *   県の指定が無い市名（同名の市が複数県にある場合）は、レポートに出てくる県の中だけで探す
 */
export function areaFromNames(prefs: string[], names: string[]): ReportArea | null {
  const text = [...new Set(names.filter(Boolean))].join("\n");
  if (!text) return null;
  const hits = new Map<string, { label: string; population: number }>();
  for (const p of [...new Set(prefs.filter(Boolean))]) {
    for (const m of municipalitiesOf(p)) {
      const base = m.name.replace(/（全区）$/, "");
      if (base.length < 2) continue;
      if (text.includes(base)) hits.set(`${p}:${base}`, { label: `${p} ${m.name}`, population: m.population });
    }
  }
  if (hits.size === 0) return null;
  // 「福岡市（全区）」と「福岡市中央区」のように包含関係なら大きい方（全区）だけ残す
  const list = [...hits.values()].filter((h, _, arr) => !arr.some((o) => o !== h && o.label !== h.label && h.label.startsWith(o.label.replace(/（全区）$/, "")) && o.label.endsWith("（全区）")));
  if (list.length === 1) return { areaLabel: list[0].label, areaPopulation: list[0].population };
  return { areaLabel: list.map((h) => h.label.split(" ")[1]).join("・") + `（${list[0].label.split(" ")[0]}）`, areaPopulation: list.reduce((a, h) => a + h.population, 0) };
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

/** 複数キー → 合算した商圏（例: 「下関市・宇部市（山口県）」／県をまたぐ時は「山口県 下関市・福岡県 北九州市（全区）」） */
export function areaFromKeys(keys: string[]): ReportArea | null {
  const areas = [...new Set(keys)].map(areaFromKey).filter((a): a is ReportArea => !!a);
  if (areas.length === 0) return null;
  if (areas.length === 1) return areas[0];
  const prefs = new Set(areas.map((a) => a.areaLabel.split(" ")[0]));
  const names = areas.map((a) => a.areaLabel.split(" ").slice(1).join(" "));
  const areaPopulation = areas.reduce((s, a) => s + a.areaPopulation, 0);
  // 3件までは名前を並べる。4件以上は「山口県 16市町（宇部市ほか15）」と短くまとめる（TVerで市区町村をまとめて選んだ時）
  if (areas.length <= 3) {
    const label = prefs.size === 1 ? `${names.join("・")}（${[...prefs][0]}）` : areas.map((a) => a.areaLabel).join("・");
    return { areaLabel: label, areaPopulation };
  }
  // 県全域だけを複数選んだ場合＝都道府県の数でまとめる（47＝全国）
  if (areas.every((a) => a.areaLabel.endsWith(" 全域"))) {
    return { areaLabel: prefLabel(areas.map((a) => a.areaLabel.replace(/ 全域$/, ""))), areaPopulation };
  }
  const kinds = ["市", "区", "町", "村"].filter((k) => names.some((n) => n.endsWith(k)));
  const unit = kinds.length ? kinds.join("") : "地域";
  const head = names[0].replace(/^.+?郡/, "");
  const label = prefs.size === 1
    ? `${[...prefs][0]} ${areas.length}${unit}（${head}ほか${areas.length - 1}）`
    : `${[...prefs].join("・")} ${areas.length}${unit}（${head}ほか${areas.length - 1}）`;
  return { areaLabel: label, areaPopulation };
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

/**
 * TVer管理画面の「地域」からコピーした文字列 → 選択キー
 *   例: 「山口県 宇部市 ✕ 山口県 萩市 ✕ 山口県 防府市 ✕ …」「下関市、宇部市」「山口県」
 *   ✕/×/x（チップの削除印）・改行・タブ・読点・中黒・カンマで区切る。県名だけなら県全域。
 *   照合先は options（＝その画面で選べるものだけ）なので、存在しない市区町村は選ばれない。
 */
export function matchAreaKeysFromText(
  options: { key: string; label: string }[],
  text: string,
): { keys: string[]; matched: string[]; unmatched: string[] } {
  const norm = (s: string) => s.replace(/[\s　]/g, "").replace(/[（(]全区[）)]/g, "");
  // 市区町村マスターは郡つき（例「山口県 大島郡周防大島町」）、TVerの地域欄は郡なし（「山口県 周防大島町」）
  //   → 県名の直後の「◯◯郡」を落とした形でも照合する（「郡山市」のように郡で始まる市名は落とさない）
  const noGun = (s: string) => s.replace(/^(.{2,4}[都道府県])(.+?郡)/, "$1");
  const forms = (s: string) => [...new Set([norm(s), noGun(norm(s))])];
  const tokens = text
    .replace(/[✕×✗❌⨯]/g, "\n")
    .replace(/(?<=[^A-Za-z])[xX](?=[^A-Za-z]|$)/g, "\n")
    .split(/[\n\r\t,、,;；・/|]+/)
    .map((t) => t.trim())
    .filter(Boolean);

  const keys: string[] = [];
  const matched: string[] = [];
  const unmatched: string[] = [];
  const seen = new Set<string>();

  for (const raw of tokens) {
    const t = norm(raw);
    if (!t) continue;
    const tf = forms(raw);
    const cands = options.filter((o) => forms(o.label).some((l) => tf.some((x) => l === x || l.startsWith(x) || l.endsWith(x))));
    // 「山口県」だけ → 県全域。市区町村名つき → その市区町村（県全域は候補から外す）
    const isPrefOnly = /^.{2,4}[都道府県]$/.test(t);
    const picked = isPrefOnly
      ? cands.find((o) => o.key.startsWith("PREF:")) ?? null
      : (() => {
          const m = cands.filter((o) => o.key.startsWith("MUNI:"));
          return m.length === 1 ? m[0] : m.find((o) => forms(o.label).some((l) => tf.includes(l))) ?? null;
        })();
    if (!picked) {
      if (!unmatched.includes(raw)) unmatched.push(raw);
      continue;
    }
    if (seen.has(picked.key)) continue;
    seen.add(picked.key);
    keys.push(picked.key);
    matched.push(picked.label);
  }
  return { keys, matched, unmatched };
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
