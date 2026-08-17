/**
 * 「営業お断り」の検出。
 *
 * 相手のサイトに営業を断る記載がある場合、フォームからもメールからも送らない。
 * 相手の明示的な意思表示を無視して送るのは、法的な議論以前に信用の問題になる。
 *
 * このファイルがキーワードの正本。worker/src/job-runner.ts にも同じ判定があるので、
 * 増やすときは両方に入れること（ワーカーは別プロセス・別tsconfigのため共有できない）。
 */

/// 断り文言。表記ゆれを個別に持つより、部分一致で拾える形にしている。
export const NO_SOLICITATION_PATTERNS = [
  // 「お断り」系
  "営業お断り",
  "営業はお断り",
  "営業の方はお断り",
  "営業目的のお問い合わせはお断り",
  "営業メールお断り",
  "営業電話お断り",
  "セールスお断り",
  "売り込みお断り",
  "売込みお断り",
  "勧誘お断り",
  "営業についてはお断り",
  "営業・勧誘はお断り",
  "勧誘・営業はお断り",
  // 「ご遠慮」系
  "営業目的のお問い合わせはご遠慮",
  "営業目的でのご連絡はご遠慮",
  "営業のご連絡はご遠慮",
  "営業のお問い合わせはご遠慮",
  "勧誘・営業はご遠慮",
  "営業・勧誘はご遠慮",
  "営業等のお問い合わせはご遠慮",
  "フォームからの営業はご遠慮",
  "営業目的でのご利用はご遠慮",
  // 「お控え」系
  "営業についてはお控え",
  "営業目的のご連絡はお控え",
  "勧誘・営業目的でのご利用はお控え",
  // その他
  "このフォームからの営業",
  "営業目的での使用は固くお断り",
  "no solicitation",
  "no soliciting",
] as const;

/** 本文に断り文言があれば、最初に一致した文言を返す。無ければ null。 */
export function detectNoSolicitation(text: string): string | null {
  if (!text) return null;
  // 全角スペース・改行・タブを潰してから見る（「営業　お断り」のような表記に対応）
  const flat = text.replace(/[\s　]+/g, "").toLowerCase();
  for (const p of NO_SOLICITATION_PATTERNS) {
    if (flat.includes(p.replace(/[\s　]+/g, "").toLowerCase())) return p;
  }
  return null;
}

// ────────────────────────────────────────────
// サイトを取得して判定する
// ────────────────────────────────────────────

import { lookup } from "node:dns/promises";

const FETCH_TIMEOUT_MS = 8000;
const MAX_BYTES = 1_500_000;
const MAX_REDIRECTS = 3;

/** 到達してはいけないIPか。IPv4/IPv6の両方を見る。 */
function isPrivateAddress(ip: string, family: number): boolean {
  if (family === 4) {
    const m = ip.match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/);
    if (!m) return true; // 判別できないものは通さない
    const [a, b] = [Number(m[1]), Number(m[2])];
    if (a === 0 || a === 10 || a === 127) return true;          // このホスト / プライベート / ループバック
    if (a === 172 && b >= 16 && b <= 31) return true;           // プライベート
    if (a === 192 && b === 168) return true;                    // プライベート
    if (a === 169 && b === 254) return true;                    // リンクローカル＝クラウドのメタデータ
    if (a === 100 && b >= 64 && b <= 127) return true;          // CGNAT
    if (a === 192 && b === 0) return true;                      // 192.0.0.0/24, 192.0.2.0/24
    if (a === 198 && (b === 18 || b === 19)) return true;        // ベンチマーク
    if (a >= 224) return true;                                   // マルチキャスト・予約
    return false;
  }

  const h = ip.toLowerCase();
  if (h === "::" || h === "::1") return true;                    // 未指定 / ループバック
  // IPv4射影アドレス（::ffff:10.0.0.1 など）は中のv4で判定する
  const mapped = h.match(/^::ffff:(\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3})$/);
  if (mapped) return isPrivateAddress(mapped[1], 4);
  if (/^f[cd]/.test(h)) return true;                             // fc00::/7 ユニークローカル
  if (/^fe[89ab]/.test(h)) return true;                          // fe80::/10 リンクローカル
  if (h.startsWith("ff")) return true;                           // マルチキャスト
  return false;
}

/** ホスト名の見た目で明らかに社内向けのものを先に落とす */
function looksInternal(h: string): boolean {
  if (h === "localhost" || h.endsWith(".localhost")) return true;
  if (h.endsWith(".internal") || h.endsWith(".local") || h.endsWith(".lan") || h.endsWith(".home.arpa")) return true;
  if (h === "metadata.google.internal") return true;
  if (!h.includes(".")) return true; // ドットが無い＝社内名の可能性
  return false;
}

/**
 * 宛先が外部の公開ホストか確認する（SSRF対策）。
 *
 * ホスト名の文字列だけを見ても足りない。公開ドメインのDNSが 127.0.0.1 や
 * 169.254.169.254（クラウドのメタデータ）を指しているケースを止められないため、
 * **実際にDNSを引いて、返ってきた全アドレスを検査する**。
 *
 * 残存リスク: 検査から接続までの間にDNSの応答が変わる（DNSリバインディング）攻撃は
 * これだけでは完全には塞げない。宛先はOSにログインした加盟代表が入力したURLに限られ、
 * 完全な遮断にはIP直結+Hostヘッダ（HTTPSの証明書検証と両立しない）か
 * 送信専用プロキシが要るため、ここまでを実装上の線としている。
 */
async function assertSafeUrl(u: URL): Promise<boolean> {
  if (u.protocol !== "http:" && u.protocol !== "https:") return false;
  const h = u.hostname.toLowerCase().replace(/^\[|\]$/g, "");
  if (looksInternal(h)) return false;

  // IP直指定はそのまま判定
  if (/^\d{1,3}(\.\d{1,3}){3}$/.test(h)) return !isPrivateAddress(h, 4);
  if (h.includes(":")) return !isPrivateAddress(h, 6);

  try {
    const addrs = await lookup(h, { all: true });
    if (addrs.length === 0) return false;
    // 1つでも内部アドレスを含むなら接続しない
    return !addrs.some((a) => isPrivateAddress(a.address, a.family));
  } catch {
    return false;
  }
}

/** HTMLから本文テキストを取り出す。script/style は落とす。 */
function htmlToText(html: string): string {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<!--[\s\S]*?-->/g, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">");
}

async function fetchText(url: string): Promise<string | null> {
  let u: URL;
  try {
    u = new URL(url.startsWith("http") ? url : `https://${url}`);
  } catch {
    return null;
  }

  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), FETCH_TIMEOUT_MS);
  try {
    // リダイレクトは自動で追わない。追ってから検査したのでは、
    // 内部アドレスへのリクエストが既に飛んだ後になるため。1ホップずつ検査する。
    for (let hop = 0; hop <= MAX_REDIRECTS; hop++) {
      if (!(await assertSafeUrl(u))) return null;

      const res = await fetch(u.toString(), {
        signal: ctrl.signal,
        redirect: "manual",
        headers: {
          // ブラウザ以外を弾くサイトがあるため
          "User-Agent":
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36",
          "Accept-Language": "ja,en;q=0.8",
        },
      });

      if (res.status >= 300 && res.status < 400) {
        const loc = res.headers.get("location");
        if (!loc) return null;
        try {
          u = new URL(loc, u); // 相対Locationにも対応。次のループ頭で再検査される
        } catch {
          return null;
        }
        continue;
      }

      if (!res.ok) return null;
      const type = res.headers.get("content-type") ?? "";
      if (!type.includes("text/html") && !type.includes("text/plain")) return null;

      const buf = await res.arrayBuffer();
      const slice = buf.byteLength > MAX_BYTES ? buf.slice(0, MAX_BYTES) : buf;
      return new TextDecoder("utf-8", { fatal: false }).decode(slice);
    }
    return null; // リダイレクトが多すぎる
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

/** トップページのHTMLから、問い合わせページらしいURLを1つ拾う */
function findContactLink(html: string, base: URL): string | null {
  const hrefs = [...html.matchAll(/href\s*=\s*["']([^"']+)["']/gi)].map((m) => m[1]);
  const hint = /(contact|inquiry|toiawase|otoiawase|問い合わせ|お問合|問合)/i;
  for (const h of hrefs) {
    if (!hint.test(h)) continue;
    try {
      const abs = new URL(h, base);
      // 同一ホストに限る。宛先の安全確認は fetchText 側で毎回やり直す
      if ((abs.protocol === "http:" || abs.protocol === "https:") && abs.hostname === base.hostname) {
        return abs.toString();
      }
    } catch {
      /* 壊れたhrefは無視 */
    }
  }
  return null;
}

export type SiteCheck =
  | { status: "ok" }
  | { status: "blocked"; phrase: string; where: string }
  | { status: "unreachable" };

/**
 * トップページと、見つかれば問い合わせページを見て断り文言を探す。
 * 断り文言は問い合わせページに書かれていることが多いので、2枚見る。
 */
export async function checkSiteForNoSolicitation(url: string): Promise<SiteCheck> {
  const top = await fetchText(url);
  if (top === null) return { status: "unreachable" };

  const hitTop = detectNoSolicitation(htmlToText(top));
  if (hitTop) return { status: "blocked", phrase: hitTop, where: "トップページ" };

  let base: URL;
  try {
    base = new URL(url.startsWith("http") ? url : `https://${url}`);
  } catch {
    return { status: "ok" };
  }

  const contactUrl = findContactLink(top, base);
  if (!contactUrl) return { status: "ok" };

  const contact = await fetchText(contactUrl);
  if (contact === null) return { status: "ok" };

  const hit = detectNoSolicitation(htmlToText(contact));
  return hit ? { status: "blocked", phrase: hit, where: "お問い合わせページ" } : { status: "ok" };
}

// ────────────────────────────────────────────
// 問い合わせ先メールアドレスの抽出
//
// リード獲得AI（Google Places）はメールアドレスを持たない。
// 営業お断りの確認で既に相手サイトを取得しているので、同じHTMLから拾う。
// ⚠️ 推測はしない。ページに書かれているものだけを返す。
// ────────────────────────────────────────────

/** 明らかに営業先の窓口ではないもの */
const EMAIL_NOISE = [
  "example.com", "example.co.jp", "sample.", "test.", "yourdomain",
  "sentry.io", "wixpress.com", "wordpress.", "godaddy", "cloudflare",
  "noreply", "no-reply", "donotreply", "postmaster", "abuse@",
  "@2x.png", ".png", ".jpg", ".jpeg", ".gif", ".svg", ".webp", ".css", ".js",
];

/** 窓口として優先度が高いもの（前に出す） */
const EMAIL_PREFERRED = ["info@", "contact@", "inquiry@", "office@", "mail@", "support@", "otoiawase@"];

/**
 * メールアドレスとして通す形。これ以外は保存しない。
 * 先頭は英数字に限る。= + - @ で始まるものを通すと、CSVに書き出したときに
 * Excelが数式として解釈する。実在する窓口アドレスがこれらで始まることはない。
 */
const STRICT_EMAIL = /^[a-zA-Z0-9][a-zA-Z0-9._%+-]*@[a-zA-Z0-9][a-zA-Z0-9.-]*\.[a-zA-Z]{2,}$/;

function collectEmails(html: string): string[] {
  const found = new Set<string>();

  // mailto: を最優先で拾う（サイトが明示している窓口）
  for (const m of html.matchAll(/mailto:([^"'?>\s]+)/gi)) {
    const e = decodeURIComponent(m[1]).trim().toLowerCase();
    if (e.includes("@")) found.add(e);
  }
  // 本文に書かれているアドレス
  const text = htmlToText(html);
  for (const m of text.matchAll(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g)) {
    found.add(m[0].trim().toLowerCase());
  }

  const cleaned = [...found].filter((e) => {
    if (e.length > 100) return false;
    // 形の検査は最後に全候補へかける。mailto: は相手のHTMLに書かれた文字列を
    // そのまま読むので、「@ を含む」だけでは = や + で始まる細工を通してしまう
    // （保存された値がCSVに出て、Excelで数式として実行されうる）。
    if (!STRICT_EMAIL.test(e)) return false;
    return !EMAIL_NOISE.some((n) => e.includes(n));
  });

  // 窓口らしいものを先に
  cleaned.sort((a, b) => {
    const pa = EMAIL_PREFERRED.findIndex((p) => a.startsWith(p));
    const pb = EMAIL_PREFERRED.findIndex((p) => b.startsWith(p));
    return (pa === -1 ? 99 : pa) - (pb === -1 ? 99 : pb);
  });
  return cleaned.slice(0, 5);
}

export type SiteScan = {
  /** サイトを開けたか */
  reachable: boolean;
  /** 営業お断りの記載。あれば emails は返さない */
  blocked: { phrase: string; where: string } | null;
  emails: string[];
  where: string | null;
};

/**
 * サイトを1回巡回して「営業お断り」と「メールアドレス」を同時に判定する。
 *
 * 別々に呼ぶと同じページを2回取りに行くことになるので、1本にまとめた。
 * 断り文言が見つかった時点でメールは返さない。断っている会社の宛先を
 * 画面に出してしまうと、うっかり送れてしまうため。
 */
export async function scanSite(url: string): Promise<SiteScan> {
  const top = await fetchText(url);
  if (top === null) return { reachable: false, blocked: null, emails: [], where: null };

  const hitTop = detectNoSolicitation(htmlToText(top));
  if (hitTop) {
    return { reachable: true, blocked: { phrase: hitTop, where: "トップページ" }, emails: [], where: null };
  }

  let emails = collectEmails(top);
  let where: string | null = emails.length > 0 ? "トップページ" : null;
  const partial = () => ({ reachable: true, blocked: null, emails, where });

  let base: URL;
  try {
    base = new URL(url.startsWith("http") ? url : `https://${url}`);
  } catch {
    return partial();
  }

  // メールがトップで見つかっていても問い合わせページは見る。
  // 断り文言はそちらに書かれていることが多く、見落とすと送ってしまうため。
  const contactUrl = findContactLink(top, base);
  if (!contactUrl) return partial();

  const contact = await fetchText(contactUrl);
  if (contact === null) return partial();

  const hit = detectNoSolicitation(htmlToText(contact));
  if (hit) {
    return { reachable: true, blocked: { phrase: hit, where: "お問い合わせページ" }, emails: [], where: null };
  }

  if (emails.length === 0) {
    emails = collectEmails(contact);
    where = emails.length > 0 ? "お問い合わせページ" : null;
  }
  return partial();
}
