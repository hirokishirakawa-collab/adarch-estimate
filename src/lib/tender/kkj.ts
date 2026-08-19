// ==============================================================
// 官公需情報ポータルサイト 検索API クライアント（中小企業庁・認証不要・無料）
//
// 仕様: https://www.kkj.go.jp/doc/ja/api_guide.pdf
//   GET https://www.kkj.go.jp/api/
//   Query / Project_Name / Organization_Name / LG_Code のいずれか1つが必須
//
// 【重要・仕様書に書かれていないハマりどころ】
//   LG_Code は 2桁ゼロ埋め。"1" では0件、"01"（北海道）で正しく返る。
//
// 【全文検索ではなく件名検索を使う理由】
//   Query は公告文の全文にヒットするため、「広報」が本文に1回出るだけの
//   設備点検業務まで大量に混ざる。Project_Name（件名）で引くと母集団が
//   1/20 程度に締まり、そのうえで AI 判定に回せる。
// ==============================================================

import * as cheerio from "cheerio";

const BASE_HTTPS = "https://www.kkj.go.jp/api/";
/**
 * HTTPS が使えない環境向けのフォールバック。APIガイドが案内している URL はこちら。
 *
 * www.kkj.go.jp のサーバ証明書のルートは「SECOM TLS RSA Root CA 2024」で、
 * Node.js が同梱している CA ストアにまだ入っていない（macOS・curl では通るが
 * Node の fetch は UNABLE_TO_GET_ISSUER_CERT_LOCALLY で落ちる）。
 * 公開情報の取得のみで認証情報を送らないため、証明書エラーのときだけ http に落とす。
 */
const BASE_HTTP = "http://www.kkj.go.jp/api/";

/** 1回のリクエストで返せる上限（API仕様上の最大値） */
const MAX_COUNT = 1000;
/** 都道府県ごとに分割取得するときの間隔 */
const REQUEST_INTERVAL_MS = 300;

/**
 * 件名で拾う語。広告・映像・印刷・イベントに絞る。
 * OR の前後には半角スペースが必要（API仕様）。
 * 語を増やすほどノイズも増えるので、増やすときは AI 判定の精度とセットで見ること。
 */
export const TITLE_KEYWORDS = [
  "動画",
  "映像",
  "広報",
  "広告",
  "宣伝",
  "プロモーション",
  "PR",
  "印刷",
  "パンフレット",
  "チラシ",
  "ポスター",
  "リーフレット",
  "冊子",
  "デザイン",
  "ロゴ",
  "写真",
  "撮影",
  "CM",
  "情報発信",
  "シティプロモーション",
  "イベント",
  "式典",
  "フェア",
  "ホームページ",
  "ウェブサイト",
  "Webサイト",
  "SNS",
] as const;

export const TITLE_QUERY = TITLE_KEYWORDS.join(" OR ");

/** 都道府県コード 01〜47（JIS X0401・2桁ゼロ埋め） */
const LG_CODES = Array.from({ length: 47 }, (_, i) => String(i + 1).padStart(2, "0"));

export interface KkjTender {
  key: string;
  projectName: string;
  organizationName: string | null;
  prefectureName: string | null;
  cityName: string | null;
  lgCode: string | null;
  cityCode: string | null;
  category: string | null;
  procedureType: string | null;
  certification: string | null;
  location: string | null;
  documentUrl: string | null;
  fileType: string | null;
  description: string | null;
  attachmentUrls: string[];
  cftIssueDate: Date | null;
  submissionDate: Date | null;
  openingDate: Date | null;
  periodEndTime: Date | null;
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export function parseDate(value: string | null | undefined): Date | null {
  if (!value) return null;
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? null : d;
}

/** 公告文は改行・全角空白が荒れているので、読める形に均す */
function normalizeText(s: string): string {
  return s
    .replace(/\r\n?/g, "\n")
    .replace(/[ \t　]+/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

/** 検索結果XMLを1件ずつに割る */
function parseXml(xml: string): { hits: number; items: KkjTender[] } {
  const $ = cheerio.load(xml, { xmlMode: true });
  const hits = Number($("SearchHits").first().text() || 0);

  const items: KkjTender[] = [];
  $("SearchResult").each((_, el) => {
    const node = $(el);
    const text = (tag: string) => {
      const v = node.find(tag).first().text().trim();
      return v.length > 0 ? v : null;
    };
    const key = text("Key");
    const projectName = text("ProjectName");
    // Key と件名が無いものは扱えない（upsert のキーと表示の両方が作れない）
    if (!key || !projectName) return;

    items.push({
      key,
      projectName: normalizeText(projectName),
      organizationName: text("OrganizationName"),
      prefectureName: text("PrefectureName"),
      cityName: text("CityName"),
      lgCode: text("LgCode"),
      cityCode: text("CityCode"),
      category: text("Category"),
      procedureType: text("ProcedureType"),
      certification: text("Certification"),
      location: text("Location"),
      documentUrl: text("ExternalDocumentURI"),
      fileType: text("FileType"),
      description: (() => {
        const d = text("ProjectDescription");
        return d ? normalizeText(d) : null;
      })(),
      attachmentUrls: node
        .find("Attachments Uri")
        .map((__, a) => $(a).text().trim())
        .get()
        .filter(Boolean),
      cftIssueDate: parseDate(text("CftIssueDate")),
      submissionDate: parseDate(text("TenderSubmissionDeadline")),
      openingDate: parseDate(text("OpeningTendersEvent")),
      periodEndTime: parseDate(text("PeriodEndTime")),
    });
  });

  return { hits, items };
}

/** 証明書の検証で落ちたかどうか（それ以外の失敗は握りつぶさない） */
function isCertError(e: unknown): boolean {
  const cause = (e as { cause?: { code?: string } })?.cause;
  const code = cause?.code ?? "";
  return code.includes("CERT") || code.includes("ISSUER") || code === "SELF_SIGNED_CERT_IN_CHAIN";
}

async function get(base: string, params: Record<string, string>): Promise<string> {
  const url = `${base}?${new URLSearchParams(params)}`;
  const res = await fetch(url, { cache: "no-store" });
  if (!res.ok) {
    throw new Error(`[kkj] ${res.status} ${res.statusText} — ${url}`);
  }
  return res.text();
}

async function search(params: Record<string, string>): Promise<{ hits: number; items: KkjTender[] }> {
  try {
    return parseXml(await get(BASE_HTTPS, params));
  } catch (e) {
    if (!isCertError(e)) throw e;
    console.warn("[kkj] HTTPS の証明書検証に失敗したため http で取得する");
    return parseXml(await get(BASE_HTTP, params));
  }
}

/** YYYY-MM-DD（API の期間指定形式） */
function toApiDate(d: Date): string {
  return d.toISOString().slice(0, 10);
}

/**
 * 直近 sinceDays 日に公告された、件名が広告系の案件を取得する。
 *
 * まず全国まとめて1回引き、上限1000件で取りこぼす場合だけ
 * 都道府県ごとの47回に切り替える（初回の遡り取り込み用）。
 */
export async function fetchRecentTenders(sinceDays: number): Promise<{
  items: KkjTender[];
  hits: number;
  splitByPrefecture: boolean;
  failedPrefectures: string[];
}> {
  const since = new Date(Date.now() - sinceDays * 86_400_000);
  const base = {
    Project_Name: TITLE_QUERY,
    CFT_Issue_Date: `${toApiDate(since)}/`,
    Count: String(MAX_COUNT),
  };

  const first = await search(base);
  if (first.hits <= first.items.length) {
    return {
      items: first.items,
      hits: first.hits,
      splitByPrefecture: false,
      failedPrefectures: [],
    };
  }

  // 1000件を超えた ＝ 取りこぼしている。都道府県ごとに割って引き直す。
  const byKey = new Map<string, KkjTender>();
  const failedPrefectures: string[] = [];
  for (const code of LG_CODES) {
    try {
      const r = await search({ ...base, LG_Code: code });
      for (const item of r.items) byKey.set(item.key, item);
    } catch (e) {
      console.error(`[kkj] LG_Code=${code} 取得失敗`, e);
      failedPrefectures.push(code);
    }
    await sleep(REQUEST_INTERVAL_MS);
  }
  // 都道府県コードが入らない案件（国の機関など）は分割時に落ちるので、1回目の結果を足す
  for (const item of first.items) if (!byKey.has(item.key)) byKey.set(item.key, item);

  return {
    items: [...byKey.values()],
    hits: first.hits,
    splitByPrefecture: true,
    failedPrefectures,
  };
}
