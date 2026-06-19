import { lookup } from "node:dns/promises";
import net from "node:net";

// ---------------------------------------------------------------
// SSRF ガード
// ユーザー入力のURLをサーバーが取得する経路で、内部メタデータ
// (169.254.169.254) やローカル/プライベートIPへの到達を防ぐ。
// DNSで解決した全アドレスを検査し、1つでも禁止レンジなら拒否。
// リダイレクトは手動追跡して各ホップを再検証する。
// ---------------------------------------------------------------

export class SsrfError extends Error {}

function isBlockedV4(ip: string): boolean {
  const p = ip.split(".").map(Number);
  if (p.length !== 4 || p.some((n) => Number.isNaN(n) || n < 0 || n > 255)) return true;
  const [a, b, c] = p;
  if (a === 0) return true; // 0.0.0.0/8
  if (a === 10) return true; // 10/8 private
  if (a === 127) return true; // loopback
  if (a === 169 && b === 254) return true; // link-local + クラウドメタデータ
  if (a === 172 && b >= 16 && b <= 31) return true; // 172.16/12 private
  if (a === 192 && b === 168) return true; // 192.168/16 private
  if (a === 100 && b >= 64 && b <= 127) return true; // 100.64/10 CGNAT
  if (a === 192 && b === 0 && c === 0) return true; // 192.0.0.0/24
  if (a === 198 && (b === 18 || b === 19)) return true; // 198.18/15 ベンチマーク
  if (a >= 224) return true; // 224+ マルチキャスト/予約
  return false;
}

function isBlockedV6(ip: string): boolean {
  const lower = ip.toLowerCase();
  if (lower === "::1" || lower === "::") return true; // loopback / unspecified
  if (/^f[cd][0-9a-f]{2}:/.test(lower)) return true; // fc00::/7 unique-local
  if (/^fe[89ab][0-9a-f]:/.test(lower)) return true; // fe80::/10 link-local
  return false;
}

function ipInBlockedRange(ip: string): boolean {
  if (net.isIPv4(ip)) return isBlockedV4(ip);
  if (net.isIPv6(ip)) {
    // IPv4-mapped (::ffff:a.b.c.d) は内側のv4で判定
    const m = ip.toLowerCase().match(/^::ffff:(\d+\.\d+\.\d+\.\d+)$/);
    if (m) return isBlockedV4(m[1]);
    return isBlockedV6(ip);
  }
  return true; // 判別不能は拒否
}

// URLを検証し、公開ホストに解決できる http(s) URL のみ通す
export async function assertPublicHttpUrl(rawUrl: string): Promise<URL> {
  let u: URL;
  try {
    u = new URL(rawUrl);
  } catch {
    throw new SsrfError("URLの形式が正しくありません");
  }
  if (u.protocol !== "http:" && u.protocol !== "https:") {
    throw new SsrfError("http(s) のURLのみ対応しています");
  }
  let results: { address: string }[];
  try {
    results = await lookup(u.hostname, { all: true });
  } catch {
    throw new SsrfError("ホスト名を解決できませんでした");
  }
  if (results.length === 0) throw new SsrfError("ホスト名を解決できませんでした");
  for (const r of results) {
    if (ipInBlockedRange(r.address)) {
      throw new SsrfError("このURLには接続できません");
    }
  }
  return u;
}

// 検証つき fetch。リダイレクトを手動追跡し、各ホップを再検証する。
export async function safeFetch(
  rawUrl: string,
  init: RequestInit = {},
  maxRedirects = 3
): Promise<Response> {
  let current = rawUrl;
  for (let i = 0; i <= maxRedirects; i++) {
    await assertPublicHttpUrl(current);
    const res = await fetch(current, { ...init, redirect: "manual" });
    if (res.status >= 300 && res.status < 400) {
      const loc = res.headers.get("location");
      if (!loc) return res;
      current = new URL(loc, current).toString();
      continue;
    }
    return res;
  }
  throw new SsrfError("リダイレクトが多すぎます");
}
