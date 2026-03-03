// ==============================================================
// グループサポート — 定数・ユーティリティ
// ==============================================================

import type { WeeklyStatus } from "@/generated/prisma/client";

// ステータス定義（内部用、各社には非表示）
export const STATUS_CONFIG: Record<
  WeeklyStatus,
  { label: string; emoji: string; color: string; bgColor: string }
> = {
  GREEN: {
    label: "いい感じ",
    emoji: "🟢",
    color: "text-emerald-400",
    bgColor: "bg-emerald-500/15 border-emerald-500/30",
  },
  YELLOW: {
    label: "ちょっと苦戦",
    emoji: "🟡",
    color: "text-yellow-400",
    bgColor: "bg-yellow-500/15 border-yellow-500/30",
  },
  RED: {
    label: "要フォロー",
    emoji: "🔴",
    color: "text-red-400",
    bgColor: "bg-red-500/15 border-red-500/30",
  },
  NONE: {
    label: "未共有",
    emoji: "⚪",
    color: "text-zinc-400",
    bgColor: "bg-zinc-700/40 border-zinc-600/30",
  },
};

// フェーズ選択肢
export const PHASE_OPTIONS = [
  { value: "ONBOARDING", label: "導入期" },
  { value: "GROWING", label: "成長期" },
  { value: "STABLE", label: "安定期" },
  { value: "RESTRUCTURING", label: "立て直し期" },
] as const;

// Q1 選択肢
export const Q1_OPTIONS = [
  "いい感じ",
  "ちょっと苦戦中",
  "手が止まっている",
] as const;

// Q5 選択肢
export const Q5_OPTIONS = [
  "今は大丈夫",
  "あると助かる",
  "できれば早めに欲しい",
] as const;

/**
 * Q1 と Q5 の回答から自動ステータスを判定
 *
 * 🟢 Q1=「いい感じ」AND Q5=「今は大丈夫」
 * 🟡 Q1=「ちょっと苦戦中」OR Q5=「あると助かる」
 * 🔴 Q1=「手が止まっている」OR Q5=「できれば早めに欲しい」
 */
export function calculateStatus(q1: string, q5: string): WeeklyStatus {
  if (q1 === "手が止まっている" || q5 === "できれば早めに欲しい") return "RED";
  if (q1 === "ちょっと苦戦中" || q5 === "あると助かる") return "YELLOW";
  if (q1 === "いい感じ" && q5 === "今は大丈夫") return "GREEN";
  return "YELLOW"; // フォールバック
}

/**
 * ISO 週番号を算出（例: "2026-W10"）
 */
export function getWeekId(date: Date = new Date()): string {
  const d = new Date(
    Date.UTC(date.getFullYear(), date.getMonth(), date.getDate())
  );
  d.setUTCDate(d.getUTCDate() + 4 - (d.getUTCDay() || 7));
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  const weekNo = Math.ceil(
    ((d.getTime() - yearStart.getTime()) / 86400000 + 1) / 7
  );
  return `${d.getUTCFullYear()}-W${String(weekNo).padStart(2, "0")}`;
}
