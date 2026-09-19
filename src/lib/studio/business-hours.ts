// ==============================================================
// Ad Arch Studio — 返答期限（営業時間で2時間）
//   営業時間＝平日 9:00〜18:00（日本時間）。祝日は考えない（2026-09-19 代表決定）
// ==============================================================

const JST_MS = 9 * 60 * 60 * 1000;
const OPEN_MIN = 9 * 60;
const CLOSE_MIN = 18 * 60;
export const REPLY_WITHIN_MIN = 120;

/** from から営業時間で minutes 分進めた時刻 */
export function addBusinessMinutes(from: Date, minutes: number = REPLY_WITHIN_MIN): Date {
  // 日本時間の「壁時計」で計算し、最後にUTCへ戻す
  let t = new Date(from.getTime() + JST_MS);
  let left = minutes;
  for (let guard = 0; guard < 30 && left > 0; guard++) {
    const dow = t.getUTCDay();
    const minOfDay = t.getUTCHours() * 60 + t.getUTCMinutes();
    const isWeekday = dow >= 1 && dow <= 5;
    if (!isWeekday || minOfDay >= CLOSE_MIN) {
      // 翌日の9:00へ
      t = new Date(Date.UTC(t.getUTCFullYear(), t.getUTCMonth(), t.getUTCDate() + 1, 9, 0, 0));
      continue;
    }
    if (minOfDay < OPEN_MIN) {
      t = new Date(Date.UTC(t.getUTCFullYear(), t.getUTCMonth(), t.getUTCDate(), 9, 0, 0));
      continue;
    }
    const room = CLOSE_MIN - minOfDay;
    const use = Math.min(room, left);
    t = new Date(t.getTime() + use * 60_000);
    left -= use;
  }
  return new Date(t.getTime() - JST_MS);
}

/** 画面・返答用「9/22(月) 11:30」 */
export function formatJst(d: Date): string {
  return new Intl.DateTimeFormat("ja-JP", { timeZone: "Asia/Tokyo", month: "numeric", day: "numeric", weekday: "short", hour: "2-digit", minute: "2-digit" }).format(d);
}
