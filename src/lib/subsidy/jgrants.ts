// ==============================================================
// jGrants 公開API クライアント（デジタル庁・認証不要）
//
// 仕様: https://developers.digital.go.jp/documents/jgrants/api/
//   一覧 GET /v1/public/subsidies   … keyword(2文字以上) / sort / order / acceptance が必須
//   詳細 GET /v2/public/subsidies/id/{id}
//
// 一覧APIには「全件取得」が無く keyword 必須なので、
// 広めのキーワードを何本か投げて id で重複排除し、募集中の母集団を作る。
// ==============================================================

const BASE = "https://api.jgrants-portal.go.jp/exp";

/** レート制限があるため、リクエストの間隔を空ける（実測で150ms程度が安全圏） */
const REQUEST_INTERVAL_MS = 250;

/**
 * 母集団を作るための広めのキーワード。
 * 「広告」だけで引くと取りこぼす（本文に広告と書かれていない販路開拓系が主戦場のため）。
 */
export const SEARCH_KEYWORDS = [
  "補助",
  "助成",
  "支援",
  "事業",
  "販路開拓",
  "販路拡大",
  "広報",
  "広告",
  "宣伝",
  "PR",
  "マーケティング",
  "展示会",
  "ブランディング",
  "デジタル",
  "観光",
  "創業",
] as const;

export interface JgrantsSummary {
  id: string;
  name: string;
  title: string;
  target_area_search: string | null;
  subsidy_max_limit: number | null;
  acceptance_start_datetime: string | null;
  acceptance_end_datetime: string | null;
  target_number_of_employees: string | null;
  institution_name: string | null;
}

export interface JgrantsDetail extends JgrantsSummary {
  subsidy_catch_phrase: string | null;
  detail: string | null;
  use_purpose: string | null;
  industry: string | null;
  subsidy_rate: string | null;
  front_subsidy_detail_page_url: string | null;
  workflow?: {
    target_area_search: string | null;
    acceptance_start_datetime: string | null;
    acceptance_end_datetime: string | null;
  }[];
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function getJson(url: string): Promise<unknown> {
  const res = await fetch(url, {
    headers: { accept: "application/json" },
    cache: "no-store",
  });
  if (!res.ok) {
    throw new Error(`[jgrants] ${res.status} ${res.statusText} — ${url}`);
  }
  return res.json();
}

/** 募集中の補助金一覧を1キーワード分取得する */
export async function fetchSubsidyList(keyword: string): Promise<JgrantsSummary[]> {
  const params = new URLSearchParams({
    keyword,
    sort: "acceptance_end_datetime",
    order: "ASC",
    acceptance: "1", // 募集期間内のものだけ
  });
  const data = (await getJson(`${BASE}/v1/public/subsidies?${params}`)) as {
    result?: JgrantsSummary[];
  };
  return data.result ?? [];
}

/** 補助金の詳細を取得する */
export async function fetchSubsidyDetail(id: string): Promise<JgrantsDetail | null> {
  const data = (await getJson(`${BASE}/v2/public/subsidies/id/${id}`)) as {
    result?: JgrantsDetail[];
  };
  return data.result?.[0] ?? null;
}

/**
 * 全キーワードを順に投げて、募集中の制度を id で重複排除して返す。
 * 1本のキーワードが失敗しても他は続行する（片肺でも母集団は作れるため）。
 */
export async function fetchAllOpenSubsidies(): Promise<{
  summaries: JgrantsSummary[];
  failedKeywords: string[];
}> {
  const byId = new Map<string, JgrantsSummary>();
  const failedKeywords: string[] = [];

  for (const keyword of SEARCH_KEYWORDS) {
    try {
      const list = await fetchSubsidyList(keyword);
      for (const item of list) byId.set(item.id, item);
    } catch (e) {
      console.error(`[jgrants] keyword="${keyword}" 取得失敗`, e);
      failedKeywords.push(keyword);
    }
    await sleep(REQUEST_INTERVAL_MS);
  }

  return { summaries: [...byId.values()], failedKeywords };
}

/** 詳細をまとめて取得する（順次・レート制限に配慮） */
export async function fetchDetails(ids: string[]): Promise<Map<string, JgrantsDetail>> {
  const out = new Map<string, JgrantsDetail>();
  for (const id of ids) {
    try {
      const detail = await fetchSubsidyDetail(id);
      if (detail) out.set(id, detail);
    } catch (e) {
      console.error(`[jgrants] detail id=${id} 取得失敗`, e);
    }
    await sleep(REQUEST_INTERVAL_MS);
  }
  return out;
}

// ----------------------------------------------------------------
// 整形ユーティリティ
// ----------------------------------------------------------------

/** jGrants の detail は装飾つきHTML。タグを落として読める本文にする */
export function stripHtml(html: string | null | undefined): string {
  if (!html) return "";
  return html
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/(p|div|tr|li|h[1-6])>/gi, "\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/[ \t　]+/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

/** "東京都 / 大阪府" → ["東京都", "大阪府"] */
export function splitSlashList(value: string | null | undefined): string[] {
  if (!value) return [];
  return value
    .split("/")
    .map((s) => s.trim())
    .filter(Boolean);
}

export function parseDate(value: string | null | undefined): Date | null {
  if (!value) return null;
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? null : d;
}
