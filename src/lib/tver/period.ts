// 配信期間の表示（一覧用）。西暦を必ず出す。同じ年なら年は先頭だけ＝「2024/3/1〜3/29」
//   年をまたぐときは両方に年を出す＝「2024/12/28〜2025/1/5」

const jst = (d: Date, withYear: boolean) =>
  new Intl.DateTimeFormat("ja-JP", { timeZone: "Asia/Tokyo", ...(withYear ? { year: "numeric" } : {}), month: "numeric", day: "numeric" })
    .format(d)
    .replace(/年|月/g, "/")
    .replace(/日/g, "");

const yearInJst = (d: Date) => Number(new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Tokyo", year: "numeric" }).format(d));

export function periodLabel(start: Date | string, end: Date | string): string {
  const s = typeof start === "string" ? new Date(start) : start;
  const e = typeof end === "string" ? new Date(end) : end;
  const same = yearInJst(s) === yearInJst(e);
  return `${jst(s, true)}〜${jst(e, !same)}`;
}

/** 期間の日数（JSTの日付ベース・両端を含む） */
export const periodDays = (start: Date, end: Date) => Math.max(1, Math.round((end.getTime() - start.getTime()) / 86_400_000) + 1);

/** JSTの年・月・日 */
function jstYMD(d: Date): [number, number, number] {
  const [y, m, day] = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Tokyo", year: "numeric", month: "2-digit", day: "2-digit" })
    .format(d)
    .split("-")
    .map(Number);
  return [y, m, day];
}
const daysInMonth = (y: number, m: number) => new Date(Date.UTC(y, m, 0)).getUTCDate();

/**
 * 配信期間が「何ヶ月ぶん」か。暦どおりに数える（月をまたいでも過不足が出ない）
 *   各暦月について「その月に含まれる日数 ÷ その月の日数」を足す
 *   例 8/1〜9/30＝31/31＋30/30＝2.00／8/15〜9/14＝17/31＋14/30＝1.02／2/1〜2/28＝1.00／12/7〜12/14＝8/31＝0.26
 */
export function monthsInPeriod(start: Date, end: Date): number {
  let [sy, sm, sd] = jstYMD(start);
  const [ey, em, ed] = jstYMD(end);
  if (sy > ey || (sy === ey && sm > em)) return 0;
  let total = 0;
  for (let guard = 0; guard < 240; guard++) {
    const dim = daysInMonth(sy, sm);
    const from = sd;
    const to = sy === ey && sm === em ? ed : dim;
    total += (Math.min(to, dim) - from + 1) / dim;
    if (sy === ey && sm === em) break;
    sm += 1;
    if (sm > 12) { sm = 1; sy += 1; }
    sd = 1;
  }
  return Math.round(total * 10000) / 10000;
}

/**
 * 月額予算（媒体実費＝卸値ベース） → この期間ぶんの予算
 *   暦どおりの月数（monthsInPeriod）を掛ける。1ヶ月ちょうどなら月額そのまま、月またぎも過不足なし
 *   拠点・お客様に見せる予算は これ×SELL_MULTIPLIER（budgetSellForPeriod）
 */
export function budgetForPeriod(monthly: number | null | undefined, start: Date, end: Date): number | null {
  if (monthly == null || monthly <= 0) return null;
  return Math.round(monthly * billingMonths(start, end));
}

/** 丸めの幅（ヶ月）。0.1ヶ月＝約3日 */
const SNAP = 0.1;

/**
 * 請求に使う月数。暦どおりの月数を出し、丸ヶ月に±3日ほどで収まっていればその月数に丸める
 *   31日・29日・28日のように「1ヶ月として売った」期間を1ヶ月として扱うため
 *   例 3/1〜3/29=0.94→1.00／2/13〜3/15=1.06→1.00／8/1〜9/30=2.00／7/1〜8/20=1.65（丸めない＝日割り）
 */
export function billingMonths(start: Date, end: Date): number {
  const raw = monthsInPeriod(start, end);
  const whole = Math.round(raw);
  return whole >= 1 && Math.abs(raw - whole) <= SNAP ? whole : raw;
}

/** 拠点・お客様に見せる予算（＝媒体実費の予算×売価係数）。卸値そのものは拠点に出さない */
export function budgetSellForPeriod(monthly: number | null | undefined, start: Date, end: Date, multiplier: number): number | null {
  const b = budgetForPeriod(monthly, start, end);
  return b == null ? null : b * multiplier;
}
