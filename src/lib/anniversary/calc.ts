// ==============================================================
// 周年の判定
//
// 拾えるのは年だけの会社が多い（月が取れるのは一部）。
// 月が分かる会社は「◯月に来る」まで言い、分からない会社は「今年◯周年」までにする。
// 推測で月日を埋めない ＝ 客先で外さないための線引き。
// ==============================================================

/** 節目。ここに当たるものを◎として上に出す。 */
export const MILESTONE_YEARS = [10, 20, 25, 30, 40, 50, 60, 70, 75, 80, 90, 100, 110, 120, 125, 150];

/** 5年刻みを周年として扱う（3周年などは記念広告の予算が付きにくいため拾わない） */
export const ANNIVERSARY_STEP = 5;

export interface AnniversaryResult {
  /** 迎える周年の年数（例: 50） */
  years: number;
  /** その周年を迎える暦年（例: 2026） */
  onYear: number;
  /** 迎える月。設立月が取れていない会社は null。 */
  onMonth: number | null;
  /** 10・20・30・50 等の節目か */
  isMilestone: boolean;
  /** 今日から何ヶ月後か。月が不明な会社は年の差から概算（12の倍数）。 */
  monthsAway: number;
}

/**
 * 次に迎える「5年刻みの周年」を返す。
 * すでに今年の記念月を過ぎていれば、次の刻み（5年後）を見る。
 *
 * @param today 判定の基準日。テストしやすいように引数で受ける。
 */
export function nextAnniversary(
  foundedYear: number,
  foundedMonth: number | null,
  today: Date = new Date()
): AnniversaryResult | null {
  if (!Number.isFinite(foundedYear) || foundedYear < 1850) return null;

  const y = today.getFullYear();
  const m = today.getMonth() + 1;

  // 今年時点の経過年数。設立月が今年まだ来ていなければ、今年はまだ (age-1) 年目。
  const ageThisYear = y - foundedYear;
  if (ageThisYear < ANNIVERSARY_STEP) return null;

  // 今年の記念月が既に過ぎているか（月不明の会社は「今年はまだ有効」として扱う）
  const passedThisYear = foundedMonth !== null && foundedMonth < m;

  // 今年以降で最初に来る5年刻み
  let years = Math.ceil(ageThisYear / ANNIVERSARY_STEP) * ANNIVERSARY_STEP;
  if (years === ageThisYear && passedThisYear) years += ANNIVERSARY_STEP;
  if (years < ANNIVERSARY_STEP) return null;

  const onYear = foundedYear + years;
  const monthsAway =
    foundedMonth !== null ? (onYear - y) * 12 + (foundedMonth - m) : (onYear - y) * 12;

  return {
    years,
    onYear,
    onMonth: foundedMonth,
    isMilestone: MILESTONE_YEARS.includes(years),
    monthsAway: Math.max(monthsAway, 0),
  };
}

/** 画面に出す一言（「来月 50周年」「今年 30周年（月は不明）」） */
export function anniversaryLabel(a: AnniversaryResult, today: Date = new Date()): string {
  const y = today.getFullYear();
  if (a.onMonth === null) {
    return a.onYear === y ? `今年 ${a.years}周年` : `${a.onYear}年に ${a.years}周年`;
  }
  const diff = a.monthsAway;
  const when = diff === 0 ? "今月" : diff === 1 ? "来月" : `${a.onYear}年${a.onMonth}月`;
  return `${when} ${a.years}周年`;
}
