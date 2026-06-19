import { lookup } from "node:dns/promises";
import net from "node:net";
import { Agent } from "undici";

// ---------------------------------------------------------------
// SSRF ガード
// ユーザー入力のURLをサーバーが取得する経路で、内部メタデータ
// (169.254.169.254) やローカル/プライベートIPへの到達を防ぐ。
//
// 方針:
// 1. DNSを一度だけ解決し、返った全アドレスを検査（1つでも禁止なら拒否）
// 2. 検証で得たIPに接続をピン留めしてfetch（検証時と接続時で解決結果が
//    ズレるDNSリバインディング = TOCTOU を防ぐ）
// 3. IPv6はBigIntに正規化して数値で判定。グローバルユニキャスト
//    (2000::/3) 以外は一律拒否し、6to4等に埋め込まれたIPv4も展開して再検査
// 4. リダイレクトは手動追跡し、各ホップで1〜3を再実行
// ---------------------------------------------------------------

export class SsrfError extends Error {}

// ---- IPv4 -----------------------------------------------------
function isBlockedV4Octets(a: number, b: number, c: number, d: number): boolean {
  if ([a, b, c, d].some((n) => Number.isNaN(n) || n < 0 || n > 255)) return true;
  if (a === 0) return true; // 0.0.0.0/8
  if (a === 10) return true; // 10/8 private
  if (a === 127) return true; // loopback
  if (a === 169 && b === 254) return true; // link-local + クラウドメタデータ
  if (a === 172 && b >= 16 && b <= 31) return true; // 172.16/12 private
  if (a === 192 && b === 168) return true; // 192.168/16 private
  if (a === 100 && b >= 64 && b <= 127) return true; // 100.64/10 CGNAT
  if (a === 192 && b === 0 && c === 0) return true; // 192.0.0.0/24
  if (a === 198 && (b === 18 || b === 19)) return true; // 198.18/15 ベンチマーク
  if (a === 192 && b === 0 && c === 2) return true; // 192.0.2.0/24 doc
  if (a === 198 && b === 51 && c === 100) return true; // 198.51.100.0/24 doc
  if (a === 203 && b === 0 && c === 113) return true; // 203.0.113.0/24 doc
  if (a >= 224) return true; // 224+ マルチキャスト/予約
  return false;
}

function isBlockedV4(ip: string): boolean {
  const p = ip.split(".").map(Number);
  if (p.length !== 4) return true;
  return isBlockedV4Octets(p[0], p[1], p[2], p[3]);
}

// ---- IPv6 -----------------------------------------------------
// テキスト表現を8つのhextet(各16bit)に正規化（末尾の埋め込みIPv4も処理）
function ipv6ToHextets(input: string): number[] | null {
  let s = input.toLowerCase();
  const pct = s.indexOf("%"); // ゾーンID除去
  if (pct >= 0) s = s.slice(0, pct);

  // 末尾の "a.b.c.d" を2つのhextetに変換
  const v4 = s.match(/(\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3})$/);
  if (v4) {
    const o = v4[1].split(".").map(Number);
    if (o.some((n) => n > 255)) return null;
    const hex = ((o[0] << 8) | o[1]).toString(16) + ":" + ((o[2] << 8) | o[3]).toString(16);
    s = s.slice(0, v4.index) + hex;
  }

  const halves = s.split("::");
  if (halves.length > 2) return null;
  const head = halves[0] ? halves[0].split(":") : [];
  const tail = halves.length === 2 ? (halves[1] ? halves[1].split(":") : []) : null;

  let groups: string[];
  if (tail === null) {
    groups = head;
  } else {
    const missing = 8 - head.length - tail.length;
    if (missing < 0) return null;
    groups = [...head, ...Array(missing).fill("0"), ...tail];
  }
  if (groups.length !== 8) return null;

  const hextets: number[] = [];
  for (const g of groups) {
    if (!/^[0-9a-f]{1,4}$/.test(g)) return null;
    hextets.push(parseInt(g, 16));
  }
  return hextets;
}

function isBlockedV6(ip: string): boolean {
  const h = ipv6ToHextets(ip);
  if (h === null) return true; // 解析不能は拒否

  // グローバルユニキャスト(2000::/3)以外は一律拒否。
  // → loopback(::1)/unspecified(::)/ULA(fc00::/7)/link-local(fe80::/10)/
  //   multicast(ff00::/8)/IPv4-mapped(::ffff:.../96)/NAT64(64:ff9b::/96)等を全て遮断
  if ((h[0] & 0xe000) !== 0x2000) return true;

  if (h[0] === 0x2001 && h[1] === 0x0db8) return true; // 2001:db8::/32 ドキュメント
  if (h[0] === 0x2001 && h[1] === 0x0000) return true; // 2001::/32 Teredo
  if (h[0] === 0x2002) {
    // 6to4: 埋め込みIPv4(bit16..48 = h[1],h[2])を展開して再検査
    return isBlockedV4Octets(h[1] >> 8, h[1] & 0xff, h[2] >> 8, h[2] & 0xff);
  }
  return false;
}

function ipInBlockedRange(ip: string): boolean {
  if (net.isIPv4(ip)) return isBlockedV4(ip);
  if (net.isIPv6(ip)) return isBlockedV6(ip);
  return true; // 判別不能は拒否
}

// URLを検証し、公開ホストに解決できる http(s) URL と検証済みアドレス群を返す
export async function assertPublicHttpUrl(
  rawUrl: string
): Promise<{ url: URL; addresses: { address: string; family: number }[] }> {
  let url: URL;
  try {
    url = new URL(rawUrl);
  } catch {
    throw new SsrfError("URLの形式が正しくありません");
  }
  if (url.protocol !== "http:" && url.protocol !== "https:") {
    throw new SsrfError("http(s) のURLのみ対応しています");
  }

  let results: { address: string; family: number }[];
  try {
    results = await lookup(url.hostname, { all: true });
  } catch {
    throw new SsrfError("ホスト名を解決できませんでした");
  }
  if (results.length === 0) throw new SsrfError("ホスト名を解決できませんでした");
  for (const r of results) {
    if (ipInBlockedRange(r.address)) {
      throw new SsrfError("このURLには接続できません");
    }
  }
  return { url, addresses: results };
}

// 検証済みIPにピン留めした undici ディスパッチャを作る
function pinnedDispatcher(address: string): Agent {
  const family = net.isIPv6(address) ? 6 : 4;
  return new Agent({
    // keep-aliveを抑えてソケットの残留を最小化
    keepAliveTimeout: 1,
    keepAliveMaxTimeout: 1,
    connect: {
      // hostname を無視し、検証済みIPに固定で接続（Host/SNIは元のURL由来のまま）
      lookup: (
        _hostname: string,
        options: { all?: boolean },
        cb: (
          err: NodeJS.ErrnoException | null,
          address: string | { address: string; family: number }[],
          family?: number
        ) => void
      ) => {
        if (options && options.all) cb(null, [{ address, family }]);
        else cb(null, address, family);
      },
    },
  });
}

// 検証つき fetch。一度の解決→ピン留め接続でTOCTOUを防ぎ、リダイレクトは
// 手動追跡して各ホップを再検証・再ピン留めする。
export async function safeFetch(
  rawUrl: string,
  init: RequestInit = {},
  maxRedirects = 3
): Promise<Response> {
  let current = rawUrl;
  for (let i = 0; i <= maxRedirects; i++) {
    const { url, addresses } = await assertPublicHttpUrl(current);
    const dispatcher = pinnedDispatcher(addresses[0].address);

    const res = await fetch(url, {
      ...init,
      redirect: "manual",
      dispatcher,
    } as RequestInit & { dispatcher: Agent });

    if (res.status >= 300 && res.status < 400) {
      const loc = res.headers.get("location");
      if (!loc) return res;
      current = new URL(loc, url).toString();
      continue;
    }
    return res;
  }
  throw new SsrfError("リダイレクトが多すぎます");
}
