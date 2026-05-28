// ---------------------------------------------------------------
// 企業サイトからメールアドレスを自動抽出するユーティリティ
// Places API はメールを返さないため、公式サイト(フッター/問い合わせ/会社概要)を
// 取得して mailto リンク・本文中のメールを抽出する。
// フォームのみでメール非公開のサイトでは見つからない（その場合は null）。
// ---------------------------------------------------------------

const EMAIL_RE = /[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}/g;

// 抽出結果から除外すべき偽メール・アセット類
const JUNK_PATTERNS: RegExp[] = [
  /\.(png|jpe?g|gif|webp|svg|avif|css|js|ico)$/i,
  /@(2x|3x)\b/i,
  /^(your|sample|test|email|name|user|info|example)@example\./i,
  /\bexample\.(com|org|net)$/i,
  /(no-?reply|donotreply)/i,
  /(sentry\.io|wixpress\.com|\.wix\.com|googleusercontent|cloudflare|jsdelivr|gravatar|w3\.org|schema\.org)/i,
];

function isJunk(email: string): boolean {
  return JUNK_PATTERNS.some((re) => re.test(email));
}

function getDomain(url: string): string | null {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return null;
  }
}

async function fetchPage(url: string, timeoutMs = 7000): Promise<string | null> {
  const controller = new AbortController();
  const t = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, {
      signal: controller.signal,
      headers: {
        "User-Agent": "Mozilla/5.0 (compatible; AdArchBot/1.0; +https://adarch.co.jp)",
        Accept: "text/html",
      },
      redirect: "follow",
    });
    if (!res.ok) return null;
    const ct = res.headers.get("content-type") ?? "";
    if (!ct.includes("text/html") && !ct.includes("text/plain")) return null;
    return await res.text();
  } catch {
    return null;
  } finally {
    clearTimeout(t);
  }
}

function extractEmails(html: string): string[] {
  const found = new Set<string>();
  // mailto リンク（最も信頼度が高い）
  const mailtoRe = /mailto:([^"'?\s>]+)/gi;
  let m: RegExpExecArray | null;
  while ((m = mailtoRe.exec(html)) !== null) {
    const e = decodeURIComponent(m[1]).trim().toLowerCase();
    if (e.includes("@")) found.add(e);
  }
  // 本文中のメール表記
  for (const e of html.match(EMAIL_RE) ?? []) {
    found.add(e.trim().toLowerCase());
  }
  return [...found].filter((e) => !isJunk(e));
}

function findContactLinks(html: string, baseUrl: string): string[] {
  const links = new Set<string>();
  const keywords = ["contact", "inquiry", "問い合わせ", "お問い合わせ", "会社概要", "company", "about", "info"];
  const anchorRe = /href\s*=\s*["']([^"']+)["']([^>]*)>([^<]*)/gi;
  let m: RegExpExecArray | null;
  while ((m = anchorRe.exec(html)) !== null) {
    const href = m[1];
    const hay = `${href} ${(m[3] ?? "")}`.toLowerCase();
    if (keywords.some((k) => hay.includes(k))) {
      try {
        links.add(new URL(href, baseUrl).toString());
      } catch {
        /* skip invalid href */
      }
    }
  }
  return [...links];
}

/**
 * 企業サイトからメールアドレスを抽出する。
 * 1) トップページを取得して抽出
 * 2) 無ければ問い合わせ/会社概要リンク + 定番パスを数ページ試す
 * 3) 自社ドメインのメールを優先して返す
 */
export async function findEmailFromWebsite(
  website: string
): Promise<{ email: string | null; candidates: string[] }> {
  const domain = getDomain(website);
  const home = await fetchPage(website);

  let candidates = home ? extractEmails(home) : [];

  if (candidates.length === 0 && home) {
    const base = (() => {
      try {
        const u = new URL(website);
        return `${u.protocol}//${u.host}`;
      } catch {
        return null;
      }
    })();
    const commonPaths = base
      ? ["/contact", "/contact/", "/contactus", "/company", "/company/", "/about", "/info"].map((p) => base + p)
      : [];
    const toFetch = [...new Set([...findContactLinks(home, website), ...commonPaths])].slice(0, 4);
    for (const u of toFetch) {
      const html = await fetchPage(u);
      if (html) {
        const found = extractEmails(html);
        if (found.length) {
          candidates = found;
          break;
        }
      }
    }
  }

  // 自社ドメイン一致を優先してランク付け
  const ranked = [...new Set(candidates)].sort((a, b) => {
    const ad = a.split("@")[1] ?? "";
    const bd = b.split("@")[1] ?? "";
    const am = domain && ad.includes(domain) ? 1 : 0;
    const bm = domain && bd.includes(domain) ? 1 : 0;
    return bm - am;
  });

  return { email: ranked[0] ?? null, candidates: ranked };
}
