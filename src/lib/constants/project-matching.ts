// ==============================================================
// 案件マッチング — 定数・ユーティリティ
// ==============================================================

import type { ProjectRequestStatus, ProjectRequestCategory, BudgetRange } from "@/generated/prisma/client";

// カテゴリ選択肢
export const CATEGORY_OPTIONS: {
  value: ProjectRequestCategory;
  label: string;
}[] = [
  { value: "SALES", label: "営業" },
  { value: "PRODUCTION", label: "制作" },
  { value: "CONSTRUCTION", label: "施工" },
  { value: "OTHER", label: "その他" },
];

// 予算レンジ選択肢
export const BUDGET_OPTIONS: {
  value: BudgetRange;
  label: string;
}[] = [
  { value: "SMALL", label: "〜50万" },
  { value: "MEDIUM", label: "50万〜200万" },
  { value: "LARGE", label: "200万〜" },
  { value: "UNDECIDED", label: "未定" },
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

/** 応募に必要な直近の提出週数 */
export const REQUIRED_WEEKS = 3;

/**
 * 案件に応募可能かどうか判定
 * - 直近3週の週次シェアをすべて提出
 * - 最新月の売上報告を提出済み
 */
export function canApplyToProject(
  recentSubmissionCount: number,
  hasLatestRevenueReport: boolean
): boolean {
  return recentSubmissionCount >= REQUIRED_WEEKS && hasLatestRevenueReport;
}

/**
 * 最新の売上報告対象月を算出（前月の月初日）
 * 例: 今日が2026-03-08 → 2026-02-01
 */
export function getLatestReportMonth(now: Date = new Date()): Date {
  return new Date(Date.UTC(now.getFullYear(), now.getMonth() - 1, 1));
}

// 都道府県（crm.tsから流用しない場合の最小定義）
export { PREFECTURES } from "@/lib/constants/crm";
