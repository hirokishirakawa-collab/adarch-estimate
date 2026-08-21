// ---------------------------------------------------------------
// 送った先の「結果」（アウトリーチの往復を閉じる4択）
//   送付済みにしたリードに対して、返ってきた結果を1クリックで記録する。
//   ここで決めた4つが、リードのステータス／グループ事例DBの両方へ波及する。
// ---------------------------------------------------------------
import type { LeadStatus, SalesApproachResult } from "@/generated/prisma/client";

export interface OutreachResultOption {
  /** Lead.outreachResult に入る値 */
  value: "REPLIED" | "REPLIED_NG" | "NO_REPLY" | "REJECTED";
  label: string;
  icon: string;
  /** ボタン（未選択時）の見た目 */
  className: string;
  /** 選択済みバッジの見た目 */
  activeClassName: string;
  /** グループ事例DB（SalesApproach）へ写すときの結果 */
  approachResult: SalesApproachResult;
  /**
   * リードのステータスをどう動かすか。
   *   from に載っているステータスのときだけ to へ移す（手で進めた状態を巻き戻さない）
   *   null = ステータスは触らない
   */
  statusMove: { from: LeadStatus[]; to: LeadStatus } | null;
}

export const OUTREACH_RESULT_OPTIONS: OutreachResultOption[] = [
  {
    value: "REPLIED",
    label: "返信あり",
    icon: "💬",
    className: "text-emerald-700 border-emerald-200 hover:bg-emerald-50",
    activeClassName: "bg-emerald-600 text-white border-emerald-600",
    approachResult: "REPLIED_OK",
    statusMove: { from: ["UNTOUCHED"], to: "CALLED" },
  },
  {
    value: "REPLIED_NG",
    label: "返信NG",
    icon: "🙅",
    className: "text-amber-700 border-amber-200 hover:bg-amber-50",
    activeClassName: "bg-amber-500 text-white border-amber-500",
    approachResult: "REPLIED_NG",
    statusMove: { from: ["UNTOUCHED"], to: "CALLED" },
  },
  {
    value: "NO_REPLY",
    label: "無反応",
    icon: "😶",
    className: "text-zinc-600 border-zinc-200 hover:bg-zinc-50",
    activeClassName: "bg-zinc-500 text-white border-zinc-500",
    approachResult: "NO_REPLY",
    statusMove: null,
  },
  {
    value: "REJECTED",
    label: "断り",
    icon: "🚫",
    className: "text-red-600 border-red-200 hover:bg-red-50",
    activeClassName: "bg-red-600 text-white border-red-600",
    approachResult: "REJECTED",
    // 断られた先は一覧の主線から外す（営業お断りリストへの登録は別操作）
    statusMove: { from: ["UNTOUCHED", "CALLED"], to: "SKIPPED" },
  },
];

export function getOutreachResultOption(value: string | null | undefined): OutreachResultOption | null {
  if (!value) return null;
  return OUTREACH_RESULT_OPTIONS.find((o) => o.value === value) ?? null;
}

/** ○日前の時刻（「7日以上そのまま」の絞り込みなどに使う） */
export function cutoffDaysAgo(days: number): Date {
  return new Date(Date.now() - days * 86400000);
}

/** 送付日からの経過日数（0以上） */
export function daysSince(date: Date | string): number {
  const t = new Date(date).getTime();
  return Math.max(0, Math.floor((Date.now() - t) / 86400000));
}
