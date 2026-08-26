// ==============================================================
// 広告賞ファインダー: 「次回の応募の窓」を月日＋確認年から計算する
//
// 正本には月日しか持たない（年が変わると日付だけずれるため）。
// 今日を基準に「受付中／次回いつから／締切だけ分かる／不明」を出し、
// 確認した年より先の窓は isEstimate=true（前年実績の推定）として扱う。
// ==============================================================

import type { AdAward } from "./types";

export type WindowStatus = "OPEN" | "UPCOMING" | "CLOSE_ONLY" | "UNKNOWN";

export interface EntryWindow {
  status: WindowStatus;
  open: Date | null;
  close: Date | null;
  daysToClose: number | null;
  daysToOpen: number | null;
  /** 確認した年より先の窓＝前年実績からの推定 */
  isEstimate: boolean;
  /** 画面に出す短い文 */
  label: string;
  /** 並び替え用（小さいほど先） */
  sortKey: number;
}

const JST_OFFSET_MS = 9 * 60 * 60 * 1000;
const DAY_MS = 86_400_000;

function jstYear(now: Date): number {
  return new Date(now.getTime() + JST_OFFSET_MS).getUTCFullYear();
}

function lastDayOfMonth(year: number, month: number): number {
  return new Date(Date.UTC(year, month, 0)).getUTCDate();
}

/** JSTの 00:00 */
function startOfDayJst(year: number, month: number, day: number): Date {
  return new Date(Date.UTC(year, month - 1, day) - JST_OFFSET_MS);
}

/** JSTの 23:59:59 */
function endOfDayJst(year: number, month: number, day: number): Date {
  return new Date(Date.UTC(year, month - 1, day + 1) - JST_OFFSET_MS - 1000);
}

function md(month: number, day: number | null): string {
  return day ? `${month}/${day}` : `${month}月`;
}

function ceilDays(ms: number): number {
  return Math.ceil(ms / DAY_MS);
}

/** 通年受付（締切なし）の賞か */
function isAnytime(a: AdAward): boolean {
  // 締切月が入っているものは「通年」と書いてあっても段階締切なので通常計算に回す
  return !a.entryCloseMonth && (a.entryPeriodRaw ?? "").includes("通年");
}

/** 応募制ではなく主催側の選考で決まる賞か */
function isNoEntry(a: AdAward): boolean {
  const t = `${a.entryPeriodRaw ?? ""} ${a.feeRaw ?? ""} ${a.eligibility ?? ""}`;
  return /応募制ではない|新聞社選考|選考制|推薦制/.test(t);
}

export function entryWindow(a: AdAward, now: Date = new Date()): EntryWindow {
  const thisYear = jstYear(now);
  const verified = a.verifiedYear ?? 0;

  if (isAnytime(a)) {
    return {
      status: "OPEN",
      open: null,
      close: null,
      daysToClose: null,
      daysToOpen: 0,
      isEstimate: false,
      label: "通年受付（締切なし）",
      sortKey: 500_000,
    };
  }

  if (isNoEntry(a) && !a.entryCloseMonth) {
    return {
      status: "UNKNOWN",
      open: null,
      close: null,
      daysToClose: null,
      daysToOpen: null,
      isEstimate: false,
      label: a.announceMonth
        ? `応募制ではない（主催の選考）・発表 ${a.announceMonth}月頃`
        : "応募制ではない（主催の選考）",
      sortKey: 3_500_000 + (a.announceMonth ?? 13),
    };
  }

  // ── 締切の月が分かっている
  if (a.entryCloseMonth) {
    const cm = a.entryCloseMonth;
    let cy = thisYear;
    let cd = a.entryCloseDay ?? lastDayOfMonth(cy, cm);
    let close = endOfDayJst(cy, cm, cd);
    if (close.getTime() < now.getTime()) {
      cy += 1;
      cd = a.entryCloseDay ?? lastDayOfMonth(cy, cm);
      close = endOfDayJst(cy, cm, cd);
    }
    const isEstimate = cy > verified;
    const est = isEstimate && a.verifiedYear ? `（${a.verifiedYear}年実績）` : "";

    if (a.entryOpenMonth) {
      const om = a.entryOpenMonth;
      const od = a.entryOpenDay ?? 1;
      // 開始月が締切月より後なら年をまたぐ窓（例 12/1〜1/16）
      const oy = om > cm || (om === cm && od > cd) ? cy - 1 : cy;
      const open = startOfDayJst(oy, om, od);
      if (now.getTime() < open.getTime()) {
        const daysToOpen = ceilDays(open.getTime() - now.getTime());
        return {
          status: "UPCOMING",
          open,
          close,
          daysToClose: ceilDays(close.getTime() - now.getTime()),
          daysToOpen,
          isEstimate,
          label: `次回 ${md(om, a.entryOpenDay)}〜${md(cm, a.entryCloseDay)} 受付${est}`,
          sortKey: 1_000_000 + daysToOpen,
        };
      }
      const daysToClose = ceilDays(close.getTime() - now.getTime());
      return {
        status: "OPEN",
        open,
        close,
        daysToClose,
        daysToOpen: 0,
        isEstimate,
        label: `受付中・締切まで${daysToClose}日（${md(cm, a.entryCloseDay)}まで）${est}`,
        sortKey: daysToClose,
      };
    }

    const daysToClose = ceilDays(close.getTime() - now.getTime());
    return {
      status: "CLOSE_ONLY",
      open: null,
      close,
      daysToClose,
      daysToOpen: null,
      isEstimate,
      label: `締切 ${md(cm, a.entryCloseDay)}頃${est}・開始日は要確認`,
      sortKey: 2_000_000 + daysToClose,
    };
  }

  // ── 開始月だけ分かっている
  if (a.entryOpenMonth) {
    const om = a.entryOpenMonth;
    const od = a.entryOpenDay ?? 1;
    let oy = thisYear;
    let open = startOfDayJst(oy, om, od);
    if (open.getTime() < now.getTime()) {
      oy += 1;
      open = startOfDayJst(oy, om, od);
    }
    const daysToOpen = ceilDays(open.getTime() - now.getTime());
    const isEstimate = oy > verified;
    const est = isEstimate && a.verifiedYear ? `（${a.verifiedYear}年実績）` : "";
    return {
      status: "UPCOMING",
      open,
      close: null,
      daysToClose: null,
      daysToOpen,
      isEstimate,
      label: `次回 ${md(om, a.entryOpenDay)}頃 受付開始${est}・締切は要確認`,
      sortKey: 1_000_000 + daysToOpen,
    };
  }

  // ── 応募期間が分からない
  return {
    status: "UNKNOWN",
    open: null,
    close: null,
    daysToClose: null,
    daysToOpen: null,
    isEstimate: true,
    label: a.announceMonth
      ? `発表 ${a.announceMonth}月頃・応募期間は主催へ要確認`
      : "応募期間は主催へ要確認",
    sortKey: 3_000_000 + (a.announceMonth ?? 13),
  };
}
