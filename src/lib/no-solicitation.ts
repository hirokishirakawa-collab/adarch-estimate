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

const FETCH_TIMEOUT_MS = 8000;
const MAX_BYTES = 1_500_000;

/** 社内ネットワークや自分自身を叩かせないための宛先チェック（SSRF対策） */
function isPubliclyRoutable(u: URL): boolean {
  if (u.protocol !== "http:" && u.protocol !== "https:") return false;
  const h = u.hostname.toLowerCase();
  if (h === "localhost" || h.endsWith(".localhost") || h.endsWith(".internal") || h.endsWith(".local")) return false;
  if (h === "metadata.google.internal") return false;

  // IPv4 直指定
  const v4 = h.match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/);
  if (v4) {
    const [a, b] = [Number(v4[1]), Number(v4[2])];
    if (a === 10 || a === 127 || a === 0) return false;
    if (a === 172 && b >= 16 && b <= 31) return false;
    if (a === 192 && b === 168) return false;
    if (a === 169 && b === 254) return false; // クラウドのメタデータ
    if (a >= 224) return false;
    return true;
  }
  // IPv6 直指定はまとめて拒否（営業先サイトが素のIPv6で来ることはない）
  if (h.includes(":") || h.startsWith("[")) return false;
  if (!h.includes(".")) return false; // ホスト名にドットが無い＝社内名の可能性
  return true;
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
  if (!isPubliclyRoutable(u)) return null;

  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), FETCH_TIMEOUT_MS);
  try {
    const res = await fetch(u.toString(), {
      signal: ctrl.signal,
      redirect: "follow",
      headers: {
        // ブラウザ以外を弾くサイトがあるため
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36",
        "Accept-Language": "ja,en;q=0.8",
      },
    });
    if (!res.ok) return null;
    const type = res.headers.get("content-type") ?? "";
    if (!type.includes("text/html") && !type.includes("text/plain")) return null;
    // 実際に飛んだ先も検証する（リダイレクトで社内へ回されないように）
    if (!isPubliclyRoutable(new URL(res.url))) return null;

    const buf = await res.arrayBuffer();
    const slice = buf.byteLength > MAX_BYTES ? buf.slice(0, MAX_BYTES) : buf;
    return new TextDecoder("utf-8", { fatal: false }).decode(slice);
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
      if (isPubliclyRoutable(abs) && abs.hostname === base.hostname) return abs.toString();
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
