import { db } from "@/lib/db";

/**
 * AI/外部API の利用を1件記録する（fire-and-forget）。
 * checkRateLimit が通過（null返却）した時点で呼ばれる＝実際にAPIを消費したリクエスト。
 * 記録失敗は本体処理を妨げない。
 */
export function logApiUsage(email: string, feature: string): void {
  if (!email || !feature) return;
  db.apiUsageLog
    .create({ data: { email, feature } })
    .catch((e) => console.error("[ApiUsageLog] 記録失敗:", e instanceof Error ? e.message : e));
}
