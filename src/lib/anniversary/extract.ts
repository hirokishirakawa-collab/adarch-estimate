// ==============================================================
// 会社概要ページ等のテキストから「設立・創業」の年（と分かれば月）を拾う
//
// 実測でわかったこと（2026-08-21）:
//   - gBizINFO の設立年月日は行政と取引のある法人にしか入っておらず、面では取れない
//   - 相手の自社サイトは、トップだけ見ても取れない。会社概要ページまで辿ると取れる
//   - 「創業1960年」のように年しか書かない会社が大半 ＝ 月日を推測で埋めない
//
// 表記の揺れが激しいので、素直な正規表現を両方向（「設立 1960年」/「1960年設立」）に
// 掛けて候補を集め、最後に優先順位で1つ選ぶ。
// ==============================================================

/** 拾えた創業情報。month は取れなかったら null（推測で埋めない）。 */
export interface FoundingInfo {
  year: number;
  month: number | null;
  /** 拾った原文。誤抽出を人が目で弾くための証跡。 */
  raw: string;
  /** 創業 / 創立 / 設立 / 開業 のどれで拾ったか。 */
  kind: string;
}

const ERAS: { name: string; base: number; maxYear: number }[] = [
  { name: "令和", base: 2018, maxYear: 99 },
  { name: "平成", base: 1988, maxYear: 31 },
  { name: "昭和", base: 1925, maxYear: 64 },
  { name: "大正", base: 1911, maxYear: 15 },
  { name: "明治", base: 1867, maxYear: 45 },
];

// 「創業」が最も古い年を指すことが多く、周年の打ち出しにもそのまま使える。
// 同じページに複数出てきたときはこの順で優先する。
const KIND_PRIORITY = ["創業", "創立", "設立", "開業"];
const KIND_RE = "創業|創立|設立|開業";

/** 全角英数を半角に落とし、空白を潰す。抽出前の前処理。 */
export function normalizeText(input: string): string {
  return input
    .replace(/[０-９]/g, (c) => String.fromCharCode(c.charCodeAt(0) - 0xfee0))
    .replace(/[Ａ-Ｚａ-ｚ]/g, (c) => String.fromCharCode(c.charCodeAt(0) - 0xfee0))
    .replace(/&nbsp;|&#160;/gi, " ")
    .replace(/\s+/g, " ");
}

/** HTMLからテキストだけ取り出す。script/style は落とす。 */
export function htmlToText(html: string): string {
  const stripped = html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ");
  return normalizeText(stripped);
}

/** 和暦（昭和35 等）を西暦に。範囲外なら null。 */
function eraToYear(era: string, numText: string): number | null {
  const found = ERAS.find((e) => e.name === era);
  if (!found) return null;
  const n = numText === "元" ? 1 : Number(numText);
  if (!Number.isFinite(n) || n < 1 || n > found.maxYear) return null;
  return found.base + n;
}

interface Candidate extends FoundingInfo {
  /** 文中に現れた位置。同点のときは前に出てくる方を採る。 */
  index: number;
}

function pushCandidate(
  out: Candidate[],
  kind: string,
  year: number | null,
  monthText: string | undefined,
  raw: string,
  index: number,
  thisYear: number
) {
  if (year === null) return;
  // 明治より前・未来の年は誤抽出とみなす（電話番号や住所の数字を拾った場合など）
  if (year < 1850 || year > thisYear) return;
  let month: number | null = null;
  if (monthText) {
    const m = Number(monthText);
    if (m >= 1 && m <= 12) month = m;
  }
  out.push({ kind, year, month, raw: raw.trim().slice(0, 60), index });
}

/**
 * テキストから設立・創業の年月を拾う。見つからなければ null。
 *
 * @param thisYear 「未来の年」を弾くための基準年。テストしやすいように引数で受ける。
 */
export function extractFounding(text: string, thisYear = new Date().getFullYear()): FoundingInfo | null {
  const t = normalizeText(text);
  const candidates: Candidate[] = [];

  // キーワードと年のあいだに入りうるもの（「設立年月日：」「創業 ／」など）だけを許す。
  // ここを緩めると「設立理事長就任 2018年」のような別物を拾ってしまう。
  const GAP = "(?:年月日|年月|日|は|が)?[\\s:：=｜|/／･・．.,、－ー―‐\\-]{0,4}";
  const MONTH = "(?:\\s?(\\d{1,2})\\s?月)?";

  // ① 「設立 1960年5月」— キーワードが先
  const fwWest = new RegExp(`(${KIND_RE})${GAP}((?:18|19|20)\\d{2})\\s?年${MONTH}`, "g");
  // ② 「設立 昭和35年5月」— キーワードが先・和暦
  const fwEra = new RegExp(`(${KIND_RE})${GAP}(令和|平成|昭和|大正|明治)\\s?(元|\\d{1,2})\\s?年${MONTH}`, "g");
  // ③ 「1960年5月創業」「1960年 会社設立」— 年が先（沿革表がこの形）
  const bwWest = new RegExp(`((?:18|19|20)\\d{2})\\s?年${MONTH}[\\s()（）にで、･・]{0,4}(?:会社|当社|弊社|法人)?[\\s]{0,2}(${KIND_RE})`, "g");
  // ④ 「昭和35年創業」— 年が先・和暦
  const bwEra = new RegExp(`(令和|平成|昭和|大正|明治)\\s?(元|\\d{1,2})\\s?年${MONTH}[\\s()（）にで、･・]{0,4}(?:会社|当社|弊社|法人)?[\\s]{0,2}(${KIND_RE})`, "g");

  let m: RegExpExecArray | null;
  while ((m = fwWest.exec(t)) !== null) {
    pushCandidate(candidates, m[1], Number(m[2]), m[3], m[0], m.index, thisYear);
  }
  while ((m = fwEra.exec(t)) !== null) {
    pushCandidate(candidates, m[1], eraToYear(m[2], m[3]), m[4], m[0], m.index, thisYear);
  }
  while ((m = bwWest.exec(t)) !== null) {
    pushCandidate(candidates, m[3], Number(m[1]), m[2], m[0], m.index, thisYear);
  }
  while ((m = bwEra.exec(t)) !== null) {
    pushCandidate(candidates, m[4], eraToYear(m[1], m[2]), m[3], m[0], m.index, thisYear);
  }

  if (candidates.length === 0) return null;

  candidates.sort((a, b) => {
    // 創業 > 創立 > 設立 > 開業
    const byKind = KIND_PRIORITY.indexOf(a.kind) - KIND_PRIORITY.indexOf(b.kind);
    if (byKind !== 0) return byKind;
    // 同じ種類なら古い方（沿革に複数の年が並ぶページ対策）
    if (a.year !== b.year) return a.year - b.year;
    // 月が取れている方を優先
    if ((a.month === null) !== (b.month === null)) return a.month === null ? 1 : -1;
    return a.index - b.index;
  });

  const { year, month, raw, kind } = candidates[0];
  return { year, month, raw, kind };
}
