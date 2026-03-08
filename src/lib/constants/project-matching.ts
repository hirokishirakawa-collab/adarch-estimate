// ==============================================================
// 案件マッチング — 定数・ユーティリティ
// ==============================================================

import type { ProjectRequestStatus, ProjectRequestCategory, ProjectFrequency } from "@/generated/prisma/client";

// カテゴリ選択肢
export const CATEGORY_OPTIONS: {
  value: ProjectRequestCategory;
  label: string;
}[] = [
  { value: "PARTIAL_SALES", label: "部分営業対応（挨拶）" },
  { value: "SHOOTING", label: "撮影" },
  { value: "EDITING", label: "編集" },
  { value: "OTHER", label: "その他" },
];

// レギュラー/単発
export const FREQUENCY_OPTIONS: {
  value: ProjectFrequency;
  label: string;
}[] = [
  { value: "ONE_TIME", label: "単発" },
  { value: "REGULAR", label: "レギュラー" },
];

// ステータス定義
export const STATUS_CONFIG: Record<
  ProjectRequestStatus,
  { label: string; color: string; bgColor: string }
> = {
  OPEN: {
    label: "募集中",
    color: "text-emerald-700",
    bgColor: "bg-emerald-50 border-emerald-200",
  },
  MATCHED: {
    label: "マッチ済み",
    color: "text-blue-700",
    bgColor: "bg-blue-50 border-blue-200",
  },
  CLOSED: {
    label: "終了",
    color: "text-zinc-500",
    bgColor: "bg-zinc-50 border-zinc-200",
  },
};

/**
 * 金額をフォーマット（例: 500000 → "50万円", 1200000 → "120万円"）
 */
export function formatBudget(amount: number | null | undefined): string {
  if (amount == null) return "未定";
  if (amount >= 10000) return `${Math.round(amount / 10000)}万円`;
  return `${amount.toLocaleString()}円`;
}

/** 応募に必要な直近の提出週数（通常） */
export const REQUIRED_WEEKS = 3;

// 移行期間の設定
// 週次シェア: 2026-03-29まで → 1週でOK、2026-03-30以降 → 3週必須
const WEEKLY_GRACE_END = new Date("2026-03-30T00:00:00+09:00");
// 売上報告: 2026-03-31まで免除、2026-04-01以降必須
const REVENUE_GRACE_END = new Date("2026-04-01T00:00:00+09:00");

/**
 * 現在の必要提出週数を返す（移行期間中は1週でOK）
 */
export function getRequiredWeeks(now: Date = new Date()): number {
  return now < WEEKLY_GRACE_END ? 1 : REQUIRED_WEEKS;
}

/**
 * 売上報告チェックが有効かどうか
 */
export function isRevenueCheckActive(now: Date = new Date()): boolean {
  return now >= REVENUE_GRACE_END;
}

/**
 * 案件に応募可能かどうか判定
 * - 移行期間中は条件を緩和
 */
export function canApplyToProject(
  recentSubmissionCount: number,
  hasLatestRevenueReport: boolean,
  now: Date = new Date()
): boolean {
  const requiredWeeks = getRequiredWeeks(now);
  const weeklyOk = recentSubmissionCount >= requiredWeeks;
  const revenueOk = isRevenueCheckActive(now) ? hasLatestRevenueReport : true;
  return weeklyOk && revenueOk;
}

/**
 * 最新の売上報告対象月を算出（前月の月初日）
 * 例: 今日が2026-03-08 → 2026-02-01
 */
export function getLatestReportMonth(now: Date = new Date()): Date {
  return new Date(Date.UTC(now.getFullYear(), now.getMonth() - 1, 1));
}

// 都道府県
export { PREFECTURES } from "@/lib/constants/crm";
