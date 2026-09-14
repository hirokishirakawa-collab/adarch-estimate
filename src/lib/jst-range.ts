// 日本時間（UTC+9・夏時間なし）の「今日の0時」「今月1日の0時」。
// 本番サーバーの時計はUTCなので、setHours(0) だと朝9時区切りになる（2026-09-15 修正）
const JST_OFFSET_MS = 9 * 3_600_000;

export function jstDayStart(now: Date = new Date()): Date {
  const j = new Date(now.getTime() + JST_OFFSET_MS);
  return new Date(Date.UTC(j.getUTCFullYear(), j.getUTCMonth(), j.getUTCDate()) - JST_OFFSET_MS);
}

export function jstMonthStart(now: Date = new Date()): Date {
  const j = new Date(now.getTime() + JST_OFFSET_MS);
  return new Date(Date.UTC(j.getUTCFullYear(), j.getUTCMonth(), 1) - JST_OFFSET_MS);
}
