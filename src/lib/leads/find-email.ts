// ---------------------------------------------------------------
// 企業サイトからメールアドレスを自動抽出するユーティリティ
// Places API はメールを返さないため、公式サイト(フッター/問い合わせ/会社概要)を
// 取得して mailto リンク・本文中のメールを抽出する。
// フォームのみでメール非公開のサイトでは見つからない（その場合は null）。
//
// SSRF対策: 外部URLを取得するため、DNS解決して private/loopback/link-local 等の
// 内部アドレスに解決されるホストは拒否する。リダイレクトは手動追跡し毎ホップ再検証する。
// ---------------------------------------------------------------

import { lookup } from "node:dns/promises";
import net from "node:net";

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

/** IPアドレスが private/loopback/link-local 等の内部レンジか判定する */
function ipIsPrivate(ip: string): boolean {
  let addr = ip;
  const mapped = ip.match(/^::ffff:(\d+\.\d+\.\d+\.\d+)$/i); // IPv4-mapped IPv6
  if (mapped) addr = mapped[1];

  if (net.isIPv4(addr)) {
    const o = addr.split(".").map(Number);
    if (o[0] === 0) return true; // 0.0.0.0/8
    if (o[0] === 10) return true; // 10/8
    if (o[0] === 127) return true; // loopback
    if (o[0] === 169 && o[1] === 254) return true; // link-local (169.254.169.254 メタデータ含む)
    if (o[0] === 172 && o[1] >= 16 && o[1] <= 31) return true; // 172.16/12
    if (o[0] === 192 && o[1] === 168) return true; // 192.168/16
    if (o[0] === 100 && o[1] >= 64 && o[1] <= 127) return true; // CGNAT 100.64/10
    if (o[0] === 192 && o[1] === 0 && o[2] === 0) return true; // 192.0.0/24
    if (o[0] >= 224) return true; // multicast/reserved
    return false;
  }
  if (net.isIPv6(addr)) {
    const lc = addr.toLowerCase();
    if (lc === "::1" || lc === "::") return true; // loopback / unspecified
    if (/^fe[89ab]/.test(lc)) return true; // fe80::/10 link-local
    if (/^f[cd]/.test(lc)) return true; // fc00::/7 ULA
    return false;
  }
  return true; // 判定不能は安全側で拒否
}

/** ホスト名がpublicに解決されることを確認（内部アドレスは拒否） */
async function assertPublicHost(hostname: string): Promise<void> {
  if (net.isIP(hostname)) {
    if (ipIsPrivate(hostname)) throw new Error("blocked: private IP");
    return;
  }
  const results = await lookup(hostname, { all: true });
  if (results.length === 0) throw new Error("blocked: DNS empty");
  for (const r of results) {
    if (ipIsPrivate(r.address)) throw new Error("blocked: resolves to private");
  }
}

async function fetchPage(rawUrl: string, timeoutMs = 7000): Promise<string | null> {
  let target = rawUrl;
  for (let hop = 0; hop < 4; hop++) {
    let parsed: URL;
    try {
      parsed = new URL(target);
    } catch {
      return null;
    }
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") return null;
    // userinfo(user:pass@) はホスト誤認の元になるため除去
    parsed.username = "";
    parsed.password = "";
    try {
      await assertPublicHost(parsed.hostname);
    } catch {
      return null;
    }

    const controller = new AbortController();
    const t = setTimeout(() => controller.abort(), timeoutMs);
    let res: Response;
    try {
      res = await fetch(parsed.toString(), {
        signal: controller.signal,
        headers: {
          "User-Agent": "Mozilla/5.0 (compatible; AdArchBot/1.0; +https://adarch.co.jp)",
          Accept: "text/html",
        },
        redirect: "manual", // リダイレクトは手動追跡し毎回再検証
      });
    } catch {
      clearTimeout(t);
      return null;
    }
    clearTimeout(t);

    if (res.status >= 300 && res.status < 400) {
      const loc = res.headers.get("location");
      if (!loc) return null;
      try {
        target = new URL(loc, parsed).toString();
      } catch {
        return null;
      }
      continue; // 次ホップで再検証
    }

    if (!res.ok) return null;
    const ct = res.headers.get("content-type") ?? "";
    if (!ct.includes("text/html") && !ct.includes("text/plain")) return null;
    return await res.text();
  }
  return null; // リダイレクト過多
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
