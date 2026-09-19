// ==============================================================
// 公開の問い合わせ（/api/contact・公開MCPの send_inquiry）で共通の判定
//   ・メール形式
//   ・営業・相互リンク依頼っぽさ（捨てずに印を付けるだけ＝本物を取りこぼさない）
// ==============================================================

export const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// 営業・相互リンク依頼の判定に使う言葉
const SALES_SIGNALS = [
  "相互リンク",
  "被リンク",
  "配信停止",
  "管理番号",
  "突然のご連絡",
  "無料でご提供",
  "ご案内いたします",
];

export function looksLikeSales(message: string): boolean {
  const hits = SALES_SIGNALS.filter((w) => message.includes(w)).length;
  const urls = (message.match(/https?:\/\//g) ?? []).length;
  return hits >= 2 || (hits >= 1 && urls >= 2);
}

/**
 * 呼び出し元のIP（上限の数え方に使う）
 *   1) X-Real-IP … Railway の公式ドキュメント（Public Networking > Technical specifications）に
 *      「X-Real-IP for identifying client's remote IP」とある＝エッジが付ける値。これを優先する
 *   2) x-forwarded-for の末尾 … 先頭は利用者が自由に書けるので使わない。末尾＝直前の中継（エッジ）が見た相手
 *   3) どちらも無ければ "unknown"（全員が同じ枠で数えられる＝安全側）
 *   空白・空要素（"a, , b" や末尾のカンマ）は捨てる
 */
export function clientIp(headers: Headers): string {
  const real = headers.get("x-real-ip")?.trim();
  if (real) return real;
  const parts = (headers.get("x-forwarded-for") ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  return parts.length > 0 ? parts[parts.length - 1] : "unknown";
}
