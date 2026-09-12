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

/**
 * 月額予算（媒体実費＝卸値ベース） → この期間ぶんの予算
 *   28〜31日は「1ヶ月」とみなす（月次レポートはそのまま月額）。それ以外は日割り（月額÷30×日数）
 *   拠点・お客様に見せる予算は これ×SELL_MULTIPLIER（budgetSellForPeriod）
 */
export function budgetForPeriod(monthly: number | null | undefined, days: number): number | null {
  if (monthly == null || monthly <= 0) return null;
  if (days >= 28 && days <= 31) return monthly;
  return Math.round((monthly / 30) * days);
}

/** 拠点・お客様に見せる予算（＝媒体実費の予算×売価係数）。卸値そのものは拠点に出さない */
export function budgetSellForPeriod(monthly: number | null | undefined, days: number, multiplier: number): number | null {
  const b = budgetForPeriod(monthly, days);
  return b == null ? null : b * multiplier;
}
