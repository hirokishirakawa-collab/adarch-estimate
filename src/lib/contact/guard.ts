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

/** 呼び出し元のIP（Railway のプロキシが付ける x-forwarded-for の先頭） */
export function clientIp(headers: Headers): string {
  return headers.get("x-forwarded-for")?.split(",")[0].trim() || headers.get("x-real-ip") || "unknown";
}
