// 表示用の小物（JST）
export function fmtJst(d: Date | null | undefined, withTime = true): string {
  if (!d) return "—";
  return d.toLocaleString("ja-JP", {
    timeZone: "Asia/Tokyo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    ...(withTime ? { hour: "2-digit", minute: "2-digit" } : {}),
  });
}

export function fmtAgo(d: Date | null | undefined): string {
  if (!d) return "—";
  const diff = Date.now() - d.getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return "たった今";
  if (m < 60) return `${m}分前`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}時間前`;
  const days = Math.floor(h / 24);
  if (days < 30) return `${days}日前`;
  return fmtJst(d, false);
}

export function webhookUrl(accountId: string): string {
  const base = (process.env.AUTH_URL ?? process.env.NEXTAUTH_URL ?? "").replace(/\/$/, "");
  return `${base}/api/line/webhook/${accountId}`;
}

export function addFriendUrl(basicId: string | null | undefined): string | null {
  if (!basicId) return null;
  const id = basicId.startsWith("@") ? basicId : `@${basicId}`;
  return `https://line.me/R/ti/p/${id}`;
}

export const TRIGGER_LABEL: Record<string, string> = {
  FOLLOW: "友だち追加で開始",
  TAG: "タグが付いたら開始",
  MANUAL: "手動で開始",
};

export const BROADCAST_STATUS_LABEL: Record<string, string> = {
  SCHEDULED: "予約中",
  SENDING: "送信中",
  SENT: "送信済",
  FAILED: "失敗",
};
