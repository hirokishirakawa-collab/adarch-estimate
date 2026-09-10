// ==============================================================
// 週次共有の提出（共通コア）
//   v2（2026-09-10〜・行動量型）: フォーム（未連携＝声かけ数＋本部依頼）と AI連携（MCP submit_weekly_share）
//   v1（q1〜q5・気分型）: 旧 Webhook 経路だけが使う
//   同じ週の判定・ステータス計算・履歴・監査ログ・本部依頼アラートを1か所に置く。
// ==============================================================

import { db } from "@/lib/db";
import {
  calculateStatus,
  calculateStatusV2,
  getWeekId,
  Q1_OPTIONS,
  Q5_OPTIONS,
  HQ_REQUEST_VALUES,
  FOLLOW_UP_VALUES,
  WEEKLY_FORM_VERSION,
  hasHqRequest,
  hqRequestLabel,
  weeklySummaryLine,
} from "@/lib/constants/group-support";
import { logAudit } from "@/lib/audit";
import { sendGroupSupportAlertEmail, sendGroupSupportAlertChat } from "@/lib/resend";

export type WeeklySource = "FORM" | "AI" | "WEBHOOK";

/** 履歴・監査ログに付ける印（AI連携から出した週次） */
export const WEEKLY_AI_MARK = "[AI記録]";

// ---------------- v2 ----------------

export type WeeklyAnswersV2 = {
  outreachCount: number; // 今週、新しく声をかけた先（件）
  hqRequest: string; // 本部に頼みたいこと（HQ_REQUEST_VALUES）
  hqNote?: string | null; // 依頼の一言（任意）
  // 以下は AI連携のみ（フォームでは送らない）
  repliedCount?: number | null;
  candidate?: string | null;
  followUp?: string | null; // DONE / PARTIAL / NOT
  followUpNote?: string | null;
};

const intOrNull = (v: unknown): number | null => {
  if (v === null || v === undefined || v === "") return null;
  const n = typeof v === "number" ? v : Number(String(v).trim());
  return Number.isFinite(n) ? Math.max(0, Math.round(n)) : null;
};
const textOrNull = (v: unknown, max: number): string | null => {
  const t = (v == null ? "" : String(v)).trim();
  return t ? t.slice(0, max) : null;
};

export function validateWeeklyAnswersV2(a: Partial<WeeklyAnswersV2>): { error: string } | { ok: WeeklyAnswersV2 } {
  const outreachCount = intOrNull(a.outreachCount);
  if (outreachCount === null) return { error: "今週、新しく声をかけた先の件数を数字で入力してください（0でもOK）" };
  if (outreachCount > 999) return { error: "件数が大きすぎます" };
  const hqRequest = (a.hqRequest ?? "").trim();
  if (!(HQ_REQUEST_VALUES as string[]).includes(hqRequest)) return { error: "本部に頼みたいことを選んでください" };
  const followUp = textOrNull(a.followUp, 20);
  if (followUp && !(FOLLOW_UP_VALUES as string[]).includes(followUp)) return { error: "先週の次の一手の結果は やった / 途中 / やってない のどれかにしてください" };
  return {
    ok: {
      outreachCount,
      hqRequest,
      hqNote: textOrNull(a.hqNote, 1000),
      repliedCount: intOrNull(a.repliedCount),
      candidate: textOrNull(a.candidate, 500),
      followUp,
      followUpNote: textOrNull(a.followUpNote, 500),
    },
  };
}

/**
 * v2 の週次共有を保存する（同じ週は上書き）。
 */
export async function saveWeeklyShareV2(input: {
  company: { id: string; name: string; ownerName: string };
  answers: WeeklyAnswersV2;
  source: WeeklySource;
  actorEmail: string;
  actorName?: string | null;
}) {
  const { company, answers, source } = input;
  const weekId = getWeekId();
  const status = calculateStatusV2(answers.outreachCount);
  const mark = source === "AI" ? `${WEEKLY_AI_MARK} ` : "";
  const data = {
    formVersion: WEEKLY_FORM_VERSION,
    source,
    outreachCount: answers.outreachCount,
    repliedCount: answers.repliedCount ?? null,
    candidate: answers.candidate ?? null,
    followUp: answers.followUp ?? null,
    followUpNote: answers.followUpNote ?? null,
    hqRequest: answers.hqRequest,
    hqNote: answers.hqNote ?? null,
    // v1 列は空に（旧データが残っていた場合の混在を防ぐ）
    q1: "",
    q2: "",
    q3: "",
    q4: "",
    q5: "",
    status,
  };

  const submission = await db.weeklySubmission.upsert({
    where: { groupCompanyId_weekId: { groupCompanyId: company.id, weekId } },
    update: data,
    create: { groupCompanyId: company.id, weekId, ...data },
  });

  const summary = weeklySummaryLine(submission);
  await db.contactHistory.create({
    data: {
      groupCompanyId: company.id,
      type: "WEEKLY_SUBMISSION",
      content: `${mark}週次共有 (${weekId}): ${summary}`,
      actorName: input.actorName ?? company.ownerName,
      weekId,
    },
  });

  logAudit({
    action: "group_weekly_submitted",
    email: input.actorEmail,
    name: company.name,
    entity: "weekly_submission",
    entityId: submission.id,
    detail: `${weekId} v2 status=${status} source=${source} outreach=${answers.outreachCount} hq=${answers.hqRequest}`,
  });

  // 本部への依頼があれば即時通知（メール＋Chat）
  if (hasHqRequest(answers.hqRequest)) {
    const alertPayload = {
      companyName: company.name,
      ownerName: company.ownerName,
      companyId: company.id,
      weekId,
      requestLabel: hqRequestLabel(answers.hqRequest),
      note: answers.hqNote ?? "",
      summary,
    };
    sendGroupSupportAlertEmail(alertPayload).catch((e) => console.error("[group-support/submit] Alert email error:", e));
    sendGroupSupportAlertChat(alertPayload).catch((e) => console.error("[group-support/submit] Alert chat error:", e));
  }

  return { submission, weekId, status, summary };
}

// ---------------- v1（旧 Webhook 用に残す） ----------------

export type WeeklyAnswers = { q1: string; q2: string; q3: string; q4: string; q5: string };

export function validateWeeklyAnswers(a: Partial<WeeklyAnswers>): string | null {
  if (!a.q1 || !a.q2 || !a.q3 || !a.q4 || !a.q5) return "すべての項目を入力してください";
  if (!(Q1_OPTIONS as readonly string[]).includes(a.q1)) return `Q1 は ${Q1_OPTIONS.join(" / ")} のどれかにしてください`;
  if (!(Q5_OPTIONS as readonly string[]).includes(a.q5)) return `Q5 は ${Q5_OPTIONS.join(" / ")} のどれかにしてください`;
  return null;
}

export async function saveWeeklyShare(input: {
  company: { id: string; name: string; ownerName: string };
  answers: WeeklyAnswers;
  source: WeeklySource;
  actorEmail: string;
  actorName?: string | null;
}) {
  const { company, answers, source } = input;
  const weekId = getWeekId();
  const status = calculateStatus(answers.q1, answers.q5);
  const data = { ...answers, status, formVersion: 1, source };

  const submission = await db.weeklySubmission.upsert({
    where: { groupCompanyId_weekId: { groupCompanyId: company.id, weekId } },
    update: data,
    create: { groupCompanyId: company.id, weekId, ...data },
  });

  await db.contactHistory.create({
    data: {
      groupCompanyId: company.id,
      type: "WEEKLY_SUBMISSION",
      content: `週次共有 (${weekId}): ${answers.q1}`,
      actorName: input.actorName ?? company.ownerName,
      weekId,
    },
  });

  logAudit({
    action: "group_weekly_submitted",
    email: input.actorEmail,
    name: company.name,
    entity: "weekly_submission",
    entityId: submission.id,
    detail: `${weekId} v1 status=${status} source=${source}`,
  });

  if (answers.q5 === "あると助かる" || answers.q5 === "できれば早めに欲しい") {
    const alertPayload = {
      companyName: company.name,
      ownerName: company.ownerName,
      companyId: company.id,
      weekId,
      requestLabel: `サポート: ${answers.q5}`,
      note: answers.q4,
      summary: answers.q1,
    };
    sendGroupSupportAlertEmail(alertPayload).catch((e) => console.error("[group-support/submit] Alert email error:", e));
    sendGroupSupportAlertChat(alertPayload).catch((e) => console.error("[group-support/submit] Alert chat error:", e));
  }

  return { submission, weekId, status };
}
