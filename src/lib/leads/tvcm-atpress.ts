// ---------------------------------------------------------------
// @Press（アットプレス）クロール・本文抽出ヘルパー
// 検索URL: https://www.atpress.ne.jp/news/search?keyword={X}
// 記事URL: https://www.atpress.ne.jp/news/{ID}
// ---------------------------------------------------------------

const UA =
  "Mozilla/5.0 (compatible; AdArchBot/1.0; +https://adarch.co.jp) Chrome/124";

export interface AtPressListItem {
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
 * @Press のキーワード検索ページからリリースURL一覧を取得する。
 * 検索結果は <a href="/news/{ID}"> + 配下に <img alt="タイトル"> の構造。
 */
export async function fetchAtPressByKeyword(
  keyword: string,
  maxItems: number,
): Promise<AtPressListItem[]> {
  const url = `https://www.atpress.ne.jp/news/search?keyword=${encodeURIComponent(keyword)}`;
  const html = await fetchHtml(url);
  if (!html) return [];

  const items: AtPressListItem[] = [];
  const seen = new Set<string>();

  // <a ... href="/news/{ID}" ... > ... <img alt="..." ... > ... </a>
  // 記事リンクと img alt を 1 ペアで抽出する。
  const linkBlockRe =
    /<a[^>]*href="\/news\/(\d+)"[^>]*>([\s\S]*?)<\/a>/g;
  const altRe = /<img[^>]*alt="([^"]+)"/;

  let m: RegExpExecArray | null;
  while ((m = linkBlockRe.exec(html)) !== null && items.length < maxItems) {
    const id = m[1];
    if (seen.has(id)) continue;
    const inner = m[2];
    const altMatch = inner.match(altRe);
    const title = decodeHtmlEntities(altMatch?.[1]?.trim() ?? "");
    if (!title || title.length < 5) continue; // タイトルが空 or 短すぎる block は除外

    seen.add(id);
    items.push({
      url: `https://www.atpress.ne.jp/news/${id}`,
      title: title.slice(0, 200),
      keyword,
    });
  }
  return items;
}

/** 記事詳細ページから本文テキストとメタ情報を抽出 */
export interface AtPressArticle {
  url: string;
  bodyText: string;
  ogTitle: string | null;
  ogDescription: string | null;
  videoEmbeds: string[];
}

export async function fetchAtPressArticle(
  url: string,
): Promise<AtPressArticle | null> {
  const html = await fetchHtml(url);
  if (!html) return null;

  const ogTitle = matchAttr(html, /<meta[^>]+property="og:title"[^>]+content="([^"]+)"/);
  const ogDescription = matchAttr(
    html,
    /<meta[^>]+property="og:description"[^>]+content="([^"]+)"/,
  );

  const videoEmbeds = extractVideoUrls(html);
  const bodyText = stripHtml(html).slice(0, 9000);

  return { url, bodyText, ogTitle, ogDescription, videoEmbeds };
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
