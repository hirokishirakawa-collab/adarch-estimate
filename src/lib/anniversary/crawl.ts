// ==============================================================
// 手持ちリードの自社サイトを巡回して、設立・創業年を埋める
//
// 実測（2026-08-21・25社）: トップページだけでは1社しか取れず、
// 会社概要ページまで辿ると到達24社中10社（42%）まで上がった。
// 取れなかったのはほぼ歯科医院で、会社（工務店・不動産）に絞れば約7割。
//
// 1回の実行で全部は回さない。foundedCheckedAt を印にして、次回は続きから。
// ==============================================================

import { lookup } from "node:dns/promises";
import { db } from "@/lib/db";
import { extractFounding, htmlToText, type FoundingInfo } from "./extract";

const UA = "Mozilla/5.0 (compatible; AdArchBot/1.0; +https://adarch.co.jp)";

/** 会社概要ページへのリンクを見分ける語 */
const ABOUT_WORDS =
  /会社概要|会社案内|企業情報|会社情報|企業概要|法人概要|私たちについて|当社について|沿革|about|company|corporate|profile|outline|overview|history/i;

/** リンクが拾えなかったときに直接叩く定番パス */
const FALLBACK_PATHS = ["/company", "/company/", "/about", "/about/", "/profile", "/outline", "/corporate"];

/**
 * 社内・クラウド内部のアドレスを弾く。
 *
 * 巡回先のURLは、リードの websiteUrl（OSの利用者が入力できる）と
 * PR TIMES の本文（誰でも書ける外部の文章）から来る。
 * つまり「どこを叩かせるか」を外から仕込める状態なので、
 * 名前解決した先が内部アドレスなら取りに行かない。
 */
function isInternalAddress(ip: string): boolean {
  const v4 = ip.replace(/^::ffff:/i, "");
  const p = v4.split(".").map(Number);
  if (p.length === 4 && p.every((n) => Number.isInteger(n) && n >= 0 && n <= 255)) {
    const [a, b] = p;
    if (a === 0 || a === 127) return true;            // 0.0.0.0/8, ループバック
    if (a === 10) return true;                        // 10/8
    if (a === 172 && b >= 16 && b <= 31) return true; // 172.16/12
    if (a === 192 && b === 168) return true;          // 192.168/16
    if (a === 169 && b === 254) return true;          // リンクローカル（クラウドのメタデータ）
    if (a === 100 && b >= 64 && b <= 127) return true; // CGNAT
    if (a === 192 && b === 0) return true;            // 192.0.0/24
    if (a === 198 && (b === 18 || b === 19)) return true; // ベンチマーク用
    return false;
  }
  const v6 = ip.toLowerCase();
  if (v6 === "::" || v6 === "::1") return true;
  if (/^f[cd]/.test(v6)) return true;                 // fc00::/7 ユニークローカル
  if (/^fe[89ab]/.test(v6)) return true;              // fe80::/10 リンクローカル
  return false;
}

/** http(s) で、名前解決した先が外部アドレスのURLだけ通す。ダメなら null。 */
async function toSafeUrl(raw: string): Promise<URL | null> {
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    return null;
  }
  if (url.protocol !== "http:" && url.protocol !== "https:") return null;
  const host = url.hostname.toLowerCase().replace(/\.$/, "");
  if (!host || host === "localhost" || host.endsWith(".localhost") || host.endsWith(".internal")) return null;
  try {
    const addrs = await lookup(host, { all: true });
    if (addrs.length === 0) return null;
    if (addrs.some((a) => isInternalAddress(a.address))) return null;
  } catch {
    return null;
  }
  return url;
}

/**
 * HTMLを取りに行く。リダイレクトは自分で辿り、行き先も毎回検査する
 * （最初のURLだけ見ても、リダイレクトで内部へ飛ばせてしまうため）。
 */
async function fetchHtml(url: string, timeoutMs = 9000, hops = 3): Promise<string | null> {
  let current = url;
  for (let i = 0; i <= hops; i++) {
    const safe = await toSafeUrl(current);
    if (!safe) return null;
    try {
      const res = await fetch(safe, {
        headers: { "User-Agent": UA, Accept: "text/html,application/xhtml+xml", "Accept-Language": "ja,en;q=0.8" },
        redirect: "manual",
        signal: AbortSignal.timeout(timeoutMs),
      });
      if (res.status >= 300 && res.status < 400) {
        const loc = res.headers.get("location");
        if (!loc) return null;
        current = new URL(loc, safe).toString();
        continue;
      }
      if (!res.ok) return null;
      const type = res.headers.get("content-type") ?? "";
      if (type && !type.includes("html")) return null;
      const html = await res.text();
      // 巨大ページで時間とメモリを食わないよう頭だけ見る（会社概要は上の方にある）
      return html.slice(0, 600_000);
    } catch {
      return null;
    }
  }
  return null;
}

/** トップページのHTMLから会社概要ページの候補URLを拾う（最大4件） */
export function findAboutLinks(html: string, baseUrl: string, max = 4): string[] {
  const out = new Set<string>();
  const re = /<a\b([^>]*?)>([\s\S]*?)<\/a>/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(html)) !== null && out.size < max) {
    const href = m[1].match(/href=["']([^"']+)["']/i)?.[1];
    if (!href || /^(#|javascript:|mailto:|tel:)/i.test(href)) continue;
    const label = m[2].replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
    if (!ABOUT_WORDS.test(label) && !ABOUT_WORDS.test(href)) continue;
    try {
      const abs = new URL(href, baseUrl);
      // 別ドメイン（SNS・ポータル）へは行かない
      if (abs.hostname !== new URL(baseUrl).hostname) continue;
      out.add(abs.toString());
    } catch {
      /* 壊れたhrefは捨てる */
    }
  }
  return [...out];
}

export interface CrawlHit extends FoundingInfo {
  sourceUrl: string;
}

/**
 * 1社分の巡回。トップ → 会社概要リンク → 定番パス の順に見て、
 * 最初に設立・創業が取れたところで止める。
 */
export async function crawlFounding(websiteUrl: string): Promise<CrawlHit | null> {
  const top = await fetchHtml(websiteUrl);
  if (!top) return null;

  const fromTop = extractFounding(htmlToText(top));
  if (fromTop) return { ...fromTop, sourceUrl: websiteUrl };

  const visited = new Set<string>([websiteUrl]);
  const links = findAboutLinks(top, websiteUrl);

  // リンクが見つからないサイト向けの保険
  const fallbacks: string[] = [];
  if (links.length === 0) {
    for (const p of FALLBACK_PATHS) {
      try {
        fallbacks.push(new URL(p, websiteUrl).toString());
      } catch {
        /* noop */
      }
    }
  }

  for (const url of [...links, ...fallbacks]) {
    if (visited.has(url)) continue;
    visited.add(url);
    const html = await fetchHtml(url);
    if (!html) continue;
    const hit = extractFounding(htmlToText(html));
    if (hit) return { ...hit, sourceUrl: url };
  }
  return null;
}

export interface CrawlStats {
  /** 今回巡回した件数 */
  targeted: number;
  /** 設立・創業が取れた件数 */
  found: number;
  /** サイトに辿り着けなかった、または記載が無かった件数 */
  notFound: number;
}

/**
 * 未確認のリードを limit 件だけ巡回して DB に書く。
 * 1件ごとに保存する（cron が途中で切れても、そこまでの結果は残す）。
 */
export async function runFoundingCrawl(limit = 100, concurrency = 4): Promise<CrawlStats> {
  const leads = await db.lead.findMany({
    where: { foundedCheckedAt: null, websiteUrl: { not: null } },
    select: { id: true, websiteUrl: true },
    // 新しく入ったリードから埋める（古い在庫より、今動いている案件の方が使う）
    orderBy: { createdAt: "desc" },
    take: limit,
  });

  const stats: CrawlStats = { targeted: leads.length, found: 0, notFound: 0 };
  const queue = [...leads];

  async function worker() {
    for (;;) {
      const lead = queue.shift();
      if (!lead) return;
      const hit = await crawlFounding(lead.websiteUrl!);
      if (hit) {
        stats.found++;
        await db.lead.update({
          where: { id: lead.id },
          data: {
            foundedYear: hit.year,
            foundedMonth: hit.month,
            foundedRaw: hit.raw,
            foundedSource: "site",
            foundedSourceUrl: hit.sourceUrl,
            foundedCheckedAt: new Date(),
          },
        });
      } else {
        stats.notFound++;
        // 見つからなくても印は押す。押さないと毎回同じサイトを叩き続けることになる。
        await db.lead.update({
          where: { id: lead.id },
          data: { foundedCheckedAt: new Date() },
        });
      }
    }
  }

  await Promise.all(Array.from({ length: Math.min(concurrency, Math.max(queue.length, 1)) }, worker));
  return stats;
}
