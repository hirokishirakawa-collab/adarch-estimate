// ---------------------------------------------------------------
// Webサイト分析ユーティリティ（共有モジュール）
// ---------------------------------------------------------------

import type { WebsiteAnalysis, BusinessType } from "@/lib/constants/leads";

// ----------------------------------------------------------------
// キャッシュ（インメモリ / 24時間TTL）
// ----------------------------------------------------------------

const cache = new Map<
  string,
  { result: { analysis: WebsiteAnalysis; html: string | null }; expiresAt: number }
>();
const CACHE_TTL = 24 * 60 * 60 * 1000; // 24 hours

function getCached(key: string): { analysis: WebsiteAnalysis; html: string | null } | null {
  const entry = cache.get(key);
  if (!entry) return null;
  if (Date.now() > entry.expiresAt) {
    cache.delete(key);
    return null;
  }
  return entry.result;
}

function setCache(key: string, result: { analysis: WebsiteAnalysis; html: string | null }): void {
  cache.set(key, { result, expiresAt: Date.now() + CACHE_TTL });
}

// ----------------------------------------------------------------
// チェーン店・フランチャイズ判定
// ----------------------------------------------------------------

/** 名前から支店パターンを検出するための正規表現 */
export const BRANCH_PATTERNS = [
  /(.+?)[　\s]+(.*?店)$/,
  /(.+?)[　\s]+(.*?支店)$/,
  /(.+?)[　\s]+(.*?営業所)$/,
  /(.+?)[　\s]+(.*?出張所)$/,
  /(.+?)(.*?[都道府県市区町村]店)$/,
  /(.+?)[\s　]*[（(](.+?)[）)]$/,
];

/** Webサイトからチェーン判定するキーワード */
export const CHAIN_SITE_KEYWORDS = [
  "店舗一覧",
  "店舗検索",
  "store-locator",
  "store-list",
  "shop-list",
  "全国の店舗",
  "お近くの店舗",
  "エリアから探す",
];

/** Webサイトからフランチャイズ判定するキーワード */
export const FRANCHISE_SITE_KEYWORDS = [
  "フランチャイズ",
  "franchise",
  "fc加盟",
  "fc募集",
  "加盟店募集",
  "オーナー募集",
  "独立開業",
];

/** 企業名から支店表記を除去してベース名を抽出する */
export function extractBaseName(name: string): string {
  for (const pattern of BRANCH_PATTERNS) {
    const m = name.match(pattern);
    if (m) return m[1].trim();
  }
  return name.trim();
}

/** 企業名・HTML・同一バッチの企業名一覧から、チェーン/FC/独立を判定する */
export function detectBusinessType(
  name: string,
  allNames: string[],
  html: string | null,
): { type: BusinessType; reason: string } {
  const baseName = extractBaseName(name);
  const lower = html?.toLowerCase() ?? "";

  // 1) 同一バッチ内に同名ベースの企業が複数 → チェーンの可能性大
  const siblings = allNames.filter((n) => {
    const other = extractBaseName(n);
    return other === baseName && n !== name;
  });

  // 2) サイト内のFC/チェーンキーワード
  const hasFranchiseKeyword = FRANCHISE_SITE_KEYWORDS.some((kw) => lower.includes(kw));
  const hasChainKeyword = CHAIN_SITE_KEYWORDS.some((kw) => lower.includes(kw));

  // 3) 名前に支店パターンがあるか
  const hasBranchPattern = BRANCH_PATTERNS.some((p) => p.test(name));

  // 判定ロジック
  if (hasFranchiseKeyword) {
    return {
      type: "franchise",
      reason: "サイトにフランチャイズ関連の記載あり",
    };
  }

  if (siblings.length >= 2 || (siblings.length >= 1 && hasChainKeyword)) {
    return {
      type: "chain",
      reason: `同名店舗が${siblings.length + 1}件検出（${baseName}）`,
    };
  }

  if (hasChainKeyword && hasBranchPattern) {
    return {
      type: "chain",
      reason: "店舗一覧ページあり・支店名パターン検出",
    };
  }

  if (hasChainKeyword) {
    return {
      type: "chain",
      reason: "サイトに店舗一覧・店舗検索あり",
    };
  }

  if (hasBranchPattern && siblings.length >= 1) {
    return {
      type: "branch",
      reason: `支店名パターン検出（本体: ${baseName}）`,
    };
  }

  if (hasBranchPattern) {
    return {
      type: "branch",
      reason: `支店・店舗名パターン検出（本体: ${baseName}）`,
    };
  }

  return {
    type: "independent",
    reason: "チェーン・FC の特徴なし（独立企業の可能性が高い）",
  };
}

// ----------------------------------------------------------------
// Webサイトを取得して分析する
// ----------------------------------------------------------------

/** HTMLからWebサイトの詳細分析を行う（内部共通ロジック） */
function analyzeHtml(html: string): {
  hasVideo: boolean;
  hasYouTube: boolean;
  hasSns: string[];
  siteAge: WebsiteAnalysis["siteAge"];
  hasRecruitPage: boolean;
} {
  const lower = html.toLowerCase();

  // 動画関連
  const hasYouTube =
    lower.includes("youtube.com/embed") ||
    lower.includes("youtube.com/watch") ||
    lower.includes("youtu.be/");
  const hasVideo =
    hasYouTube ||
    lower.includes("<video") ||
    lower.includes("vimeo.com") ||
    lower.includes("tiktok.com/embed");

  // SNS
  const snsPatterns: [string, RegExp][] = [
    ["Instagram", /instagram\.com\/[a-zA-Z0-9_.]+/],
    ["Twitter/X", /(?:twitter\.com|x\.com)\/[a-zA-Z0-9_]+/],
    ["Facebook", /facebook\.com\/[a-zA-Z0-9_.]+/],
    ["TikTok", /tiktok\.com\/@[a-zA-Z0-9_.]+/],
    ["LINE", /line\.me\//],
  ];
  const hasSns = snsPatterns
    .filter(([, re]) => re.test(lower))
    .map(([snsName]) => snsName);

  // サイトの新しさ
  const hasViewport =
    lower.includes('name="viewport"') || lower.includes("name='viewport'");
  const hasModernFramework =
    lower.includes("next") ||
    lower.includes("nuxt") ||
    lower.includes("react") ||
    lower.includes("vue") ||
    lower.includes("__next");
  const siteAge: WebsiteAnalysis["siteAge"] =
    hasModernFramework ? "modern" : hasViewport ? "modern" : "outdated";

  // 採用ページ
  const hasRecruitPage =
    lower.includes("recruit") ||
    lower.includes("career") ||
    lower.includes("採用") ||
    lower.includes("求人");

  return { hasVideo, hasYouTube, hasSns, siteAge, hasRecruitPage };
}

/** サマリー文字列を生成する */
function buildSummary(parsed: ReturnType<typeof analyzeHtml>): string {
  const parts: string[] = [];
  if (parsed.hasVideo)
    parts.push(parsed.hasYouTube ? "YouTube動画あり" : "動画コンテンツあり");
  else parts.push("動画未活用");
  if (parsed.hasSns.length > 0) parts.push(`SNS: ${parsed.hasSns.join(",")}`);
  else parts.push("SNSリンクなし");
  if (parsed.siteAge === "outdated") parts.push("サイト古め");
  if (parsed.hasRecruitPage) parts.push("採用ページあり");
  return parts.join(" / ");
}

/** URLからHTMLを取得する */
async function fetchHtml(url: string): Promise<string> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 8000);

  const res = await fetch(url, {
    signal: controller.signal,
    headers: {
      "User-Agent":
        "Mozilla/5.0 (compatible; AdArchBot/1.0; +https://adarch.co.jp)",
      Accept: "text/html",
    },
    redirect: "follow",
  });
  clearTimeout(timeout);

  if (!res.ok) {
    throw new Error(`HTTP ${res.status}`);
  }

  return res.text();
}

/**
 * Webサイトを取得して分析する（チェーン/FC/支店判定付き）
 *
 * @param url       - WebサイトURL（空文字の場合はサイトなし扱い）
 * @param name      - 企業名
 * @param allNames  - 同一バッチ内の全企業名（チェーン判定用）
 */
export async function analyzeWebsite(
  url: string,
  name: string,
  allNames: string[],
): Promise<{ analysis: WebsiteAnalysis; html: string | null }> {
  // キャッシュチェック（URLが空の場合はキャッシュしない）
  if (url) {
    const cached = getCached(url);
    if (cached) {
      // キャッシュされた結果でもチェーン判定はバッチごとに変わるため再計算
      const bt = detectBusinessType(name, allNames, cached.html);
      return {
        analysis: {
          ...cached.analysis,
          businessType: bt.type,
          businessTypeReason: bt.reason,
        },
        html: cached.html,
      };
    }
  }

  const empty: WebsiteAnalysis = {
    hasWebsite: false,
    hasVideo: false,
    hasYouTube: false,
    hasSns: [],
    siteAge: "unknown",
    hasRecruitPage: false,
    businessType: "unknown",
    businessTypeReason: "",
    summary: "Webサイトなし",
  };

  if (!url) {
    const bt = detectBusinessType(name, allNames, null);
    return {
      analysis: { ...empty, businessType: bt.type, businessTypeReason: bt.reason },
      html: null,
    };
  }

  try {
    const html = await fetchHtml(url);
    const parsed = analyzeHtml(html);
    const bt = detectBusinessType(name, allNames, html);
    const summary = buildSummary(parsed);

    const result = {
      analysis: {
        hasWebsite: true,
        hasVideo: parsed.hasVideo,
        hasYouTube: parsed.hasYouTube,
        hasSns: parsed.hasSns,
        siteAge: parsed.siteAge,
        hasRecruitPage: parsed.hasRecruitPage,
        businessType: bt.type,
        businessTypeReason: bt.reason,
        summary,
      } as WebsiteAnalysis,
      html,
    };

    setCache(url, result);
    return result;
  } catch {
    const bt = detectBusinessType(name, allNames, null);
    return {
      analysis: {
        ...empty,
        hasWebsite: true,
        businessType: bt.type,
        businessTypeReason: bt.reason,
        summary: "サイト取得タイムアウト",
      },
      html: null,
    };
  }
}

/**
 * Webサイトを取得して分析する（シンプル版 — チェーン判定なし）
 *
 * チェーン/FC/支店の判定が不要なルート向け。
 * businessType は常に "unknown" を返す。
 *
 * @param url - WebサイトURL
 */
export async function analyzeWebsiteSimple(
  url: string,
): Promise<{ analysis: WebsiteAnalysis; html: string | null }> {
  // キャッシュチェック
  if (url) {
    const cached = getCached(url);
    if (cached) {
      return {
        analysis: {
          ...cached.analysis,
          businessType: "unknown",
          businessTypeReason: "",
        },
        html: cached.html,
      };
    }
  }

  const empty: WebsiteAnalysis = {
    hasWebsite: false,
    hasVideo: false,
    hasYouTube: false,
    hasSns: [],
    siteAge: "unknown",
    hasRecruitPage: false,
    businessType: "unknown",
    businessTypeReason: "",
    summary: "Webサイトなし",
  };

  if (!url) {
    return { analysis: empty, html: null };
  }

  try {
    const html = await fetchHtml(url);
    const parsed = analyzeHtml(html);
    const summary = buildSummary(parsed);

    const result = {
      analysis: {
        hasWebsite: true,
        hasVideo: parsed.hasVideo,
        hasYouTube: parsed.hasYouTube,
        hasSns: parsed.hasSns,
        siteAge: parsed.siteAge,
        hasRecruitPage: parsed.hasRecruitPage,
        businessType: "unknown" as const,
        businessTypeReason: "",
        summary,
      } as WebsiteAnalysis,
      html,
    };

    setCache(url, result);
    return result;
  } catch {
    return {
      analysis: {
        ...empty,
        hasWebsite: true,
        summary: "サイト取得タイムアウト",
      },
      html: null,
    };
  }
}
