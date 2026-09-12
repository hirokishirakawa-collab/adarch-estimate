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
