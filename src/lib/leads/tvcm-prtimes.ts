// ---------------------------------------------------------------
// PR TIMES クロール・本文抽出ヘルパー
// ---------------------------------------------------------------

const UA =
  "Mozilla/5.0 (compatible; AdArchBot/1.0; +https://adarch.co.jp) Chrome/124";

export interface PrTimesListItem {
  url: string;
  title: string;
  keyword: string;
}

async function fetchHtml(url: string, timeoutMs = 15000): Promise<string | null> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const res = await fetch(url, {
      headers: {
        "User-Agent": UA,
        "Accept-Language": "ja,en;q=0.8",
        Accept: "text/html,application/xhtml+xml",
      },
      signal: ctrl.signal,
    });
    if (!res.ok) return null;
    return await res.text();
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

/**
 * PR TIMES のキーワード検索ページから記事URL一覧を取得する。
 * URLパターン: https://prtimes.jp/topics/keywords/{keyword}
 * 記事URLパターン: /main/html/rd/p/{NUMBER}.html
 */
export async function fetchPrTimesByKeyword(
  keyword: string,
  maxItems: number
): Promise<PrTimesListItem[]> {
  const url = `https://prtimes.jp/topics/keywords/${encodeURIComponent(keyword)}`;
  const html = await fetchHtml(url);
  if (!html) return [];

  const items: PrTimesListItem[] = [];
  const seen = new Set<string>();
  // 検索結果ページの記事リンク抽出
  const re = /<a[^>]+href="(\/main\/html\/rd\/p\/[\d]+\.html)"[^>]*>([\s\S]*?)<\/a>/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(html)) !== null && items.length < maxItems) {
    const path = m[1];
    if (seen.has(path)) continue;
    const innerText = m[2]
      .replace(/<[^>]+>/g, " ")
      .replace(/\s+/g, " ")
      .trim();
    if (!innerText) continue;
    seen.add(path);
    items.push({
      url: `https://prtimes.jp${path}`,
      title: innerText.slice(0, 200),
      keyword,
    });
  }
  return items;
}

/**
 * 記事詳細ページから本文テキストを抽出（タグ除去）。
 * メタ情報も含めて返す（OGP・JSON-LD）。
 */
export interface PrTimesArticle {
  url: string;
  bodyText: string;
  jsonLd: string | null;
  ogTitle: string | null;
  ogDescription: string | null;
  videoEmbeds: string[]; // YouTube / Vimeo URL の検出
}

export async function fetchPrTimesArticle(url: string): Promise<PrTimesArticle | null> {
  const html = await fetchHtml(url);
  if (!html) return null;

  // OGP
  const ogTitle = matchAttr(html, /<meta[^>]+property="og:title"[^>]+content="([^"]+)"/);
  const ogDescription = matchAttr(html, /<meta[^>]+property="og:description"[^>]+content="([^"]+)"/);

  // JSON-LD（schema.org）
  const ldMatch = html.match(/<script[^>]+type="application\/ld\+json"[^>]*>([\s\S]*?)<\/script>/);
  const jsonLd = ldMatch ? ldMatch[1].trim() : null;

  // 動画埋め込み（YouTube / Vimeo）
  const videoEmbeds = extractVideoUrls(html);

  // 本文テキスト
  const bodyText = stripHtml(html).slice(0, 9000);

  return { url, bodyText, jsonLd, ogTitle, ogDescription, videoEmbeds };
}

function matchAttr(html: string, re: RegExp): string | null {
  const m = html.match(re);
  return m ? decodeHtmlEntities(m[1]) : null;
}

function decodeHtmlEntities(s: string): string {
  return s
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'");
}

function stripHtml(html: string): string {
  return html
    .replace(/<script[\s\S]*?<\/script>/g, " ")
    .replace(/<style[\s\S]*?<\/style>/g, " ")
    .replace(/<noscript[\s\S]*?<\/noscript>/g, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function extractVideoUrls(html: string): string[] {
  const urls = new Set<string>();
  const patterns = [
    /https?:\/\/(?:www\.)?youtube\.com\/(?:watch\?v=|embed\/)[\w-]+/g,
    /https?:\/\/youtu\.be\/[\w-]+/g,
    /https?:\/\/(?:player\.)?vimeo\.com\/(?:video\/)?\d+/g,
  ];
  for (const re of patterns) {
    let m: RegExpExecArray | null;
    while ((m = re.exec(html)) !== null) {
      urls.add(m[0]);
    }
  }
  return Array.from(urls).slice(0, 5);
}
