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

// ==============================================================
// v2（2026-09-10〜・行動量型）
//   未連携（フォーム）= 声かけ数 + 本部に頼みたいこと
//   AI連携（MCP weekly）= 声かけ数・返事数・受注候補はOSの記録から／答え合わせと本部依頼は本人
// ==============================================================

export const WEEKLY_FORM_VERSION = 2;

/** 本部に頼みたいこと（提案書・見積・文面・リストは外す＝AIで自分でやる前提。本部にしかできない角度） */
export const HQ_REQUEST_OPTIONS = [
  { value: "NEW_PLAN", label: "この業種・この相手向けの新しいプランを作ってほしい", short: "新プラン" },
  { value: "MEDIA_TERMS", label: "媒体の枠・条件を本部から交渉してほしい（TVer・サイネージ・LINEなど）", short: "媒体条件の交渉" },
  { value: "JOINT_PROPOSAL", label: "本部名義で一緒に提案したい（大型・自治体・複数県）", short: "本部名義で共同提案" },
  { value: "CASES", label: "他拠点の受注例・実績を出してほしい", short: "他拠点の受注例" },
  { value: "PRICING", label: "値引き・条件の可否を判断してほしい", short: "値引き・条件の判断" },
  { value: "NONE", label: "なし", short: "なし" },
] as const;
export type HqRequest = (typeof HQ_REQUEST_OPTIONS)[number]["value"];
export const HQ_REQUEST_VALUES = HQ_REQUEST_OPTIONS.map((o) => o.value) as HqRequest[];
export const hqRequestLabel = (v: string | null | undefined) => HQ_REQUEST_OPTIONS.find((o) => o.value === v)?.label ?? (v || "—");
export const hqRequestShort = (v: string | null | undefined) => HQ_REQUEST_OPTIONS.find((o) => o.value === v)?.short ?? (v || "—");

/** 先週の「次の一手」は動いた？（AI連携の答え合わせ） */
export const FOLLOW_UP_OPTIONS = [
  { value: "DONE", label: "やった" },
  { value: "PARTIAL", label: "途中" },
  { value: "NOT", label: "やってない" },
] as const;
export type FollowUp = (typeof FOLLOW_UP_OPTIONS)[number]["value"];
export const FOLLOW_UP_VALUES = FOLLOW_UP_OPTIONS.map((o) => o.value) as FollowUp[];
export const followUpLabel = (v: string | null | undefined) => FOLLOW_UP_OPTIONS.find((o) => o.value === v)?.label ?? (v || "—");

/** v2 の閾値（声かけ数）。🟢 3件以上／🟡 1〜2件／🔴 0件 */
export const OUTREACH_GREEN_MIN = 3;

/**
 * v2: 声かけ数から自動ステータス（自己申告なし）
 * 🟢 outreachCount >= 3 / 🟡 1〜2 / 🔴 0
 */
export function calculateStatusV2(outreachCount: number): WeeklyStatus {
  if (outreachCount >= OUTREACH_GREEN_MIN) return "GREEN";
  if (outreachCount >= 1) return "YELLOW";
  return "RED";
}

/** 本部への依頼があるか（NONE と空は依頼なし） */
export const hasHqRequest = (v: string | null | undefined) => !!v && v !== "NONE";

/** 提出1件の要約（一覧・履歴・週報の1行用）。v1/v2 どちらでも */
export function weeklySummaryLine(sub: {
  formVersion?: number | null;
  q1?: string | null;
  outreachCount?: number | null;
  repliedCount?: number | null;
  candidate?: string | null;
  hqRequest?: string | null;
}): string {
  if ((sub.formVersion ?? 1) >= 2) {
    const parts = [`声かけ${sub.outreachCount ?? 0}件`];
    if (sub.repliedCount != null) parts.push(`返事${sub.repliedCount}件`);
    if (sub.candidate) parts.push(`候補: ${sub.candidate.replace(/\s+/g, " ").slice(0, 40)}`);
    if (hasHqRequest(sub.hqRequest)) parts.push(`依頼: ${hqRequestShort(sub.hqRequest)}`);
    return parts.join(" / ");
  }
  return sub.q1 ?? "";
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
