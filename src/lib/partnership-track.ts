import { createHmac } from "crypto";

// ----------------------------------------------------------------
// 加盟の資料請求 自動返信メール内リンクのクリック計測（共通ロジック）
// 送信側（resend.ts）が署名付きリンクを生成し、/api/track/partnership が検証・記録する。
// ----------------------------------------------------------------

export const DOC_PDF_URL = "https://adarch.co.jp/intro/AdArch-overview.pdf";
// 2026-09-07: TimeRex解約に伴い、面談は「LINEで問い合わせ→やり取りで日程調整」へ（合言葉「加盟案内」＝OSの流入枠「LP /intro/」）
export const BOOKING_URL = "https://line.me/R/oaMessage/%40496hvpcm/?%E5%8A%A0%E7%9B%9F%E6%A1%88%E5%86%85";

export function partnershipTrackSign(kind: string, email: string): string {
  const secret = process.env.AUTH_SECRET ?? "";
  return createHmac("sha256", secret).update(`${kind}:${email}`).digest("hex").slice(0, 32);
}

/** 計測リダイレクト経由のリンクを作る。APP_URL 未設定時は素のURLへフォールバック */
export function partnershipTrackedUrl(kind: "doc" | "booking", email: string): string {
  const base = (process.env.NEXT_PUBLIC_APP_URL ?? "").replace(/\/$/, "");
  const direct = kind === "booking" ? BOOKING_URL : DOC_PDF_URL;
  if (!base || !process.env.AUTH_SECRET) return direct;
  const s = partnershipTrackSign(kind, email);
  return `${base}/api/track/partnership?k=${kind}&e=${encodeURIComponent(email)}&s=${s}`;
}
