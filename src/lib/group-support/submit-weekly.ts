// ==============================================================
// 週次共有の提出（共通コア）
//   フォーム（/group-support/submit）と AI連携（MCP submit_weekly_share）の両方から呼ぶ。
//   同じ週の判定・ステータス計算・履歴・監査ログ・Q5アラートを1か所に置く。
// ==============================================================

import { db } from "@/lib/db";
import { calculateStatus, getWeekId, Q1_OPTIONS, Q5_OPTIONS } from "@/lib/constants/group-support";
import { logAudit } from "@/lib/audit";
import { sendGroupSupportAlertEmail, sendGroupSupportAlertChat } from "@/lib/resend";

export type WeeklyAnswers = { q1: string; q2: string; q3: string; q4: string; q5: string };

export type WeeklySource = "FORM" | "AI";

/** 履歴・監査ログに付ける印（AI連携から出した週次） */
export const WEEKLY_AI_MARK = "[AI記録]";

export function validateWeeklyAnswers(a: Partial<WeeklyAnswers>): string | null {
  if (!a.q1 || !a.q2 || !a.q3 || !a.q4 || !a.q5) return "すべての項目を入力してください";
  if (!(Q1_OPTIONS as readonly string[]).includes(a.q1)) return `Q1 は ${Q1_OPTIONS.join(" / ")} のどれかにしてください`;
  if (!(Q5_OPTIONS as readonly string[]).includes(a.q5)) return `Q5 は ${Q5_OPTIONS.join(" / ")} のどれかにしてください`;
  for (const [k, n] of [["q2", 2000], ["q3", 2000], ["q4", 2000]] as const) {
    if ((a[k] ?? "").length > n) return `${k.toUpperCase()} は${n}文字以内にしてください`;
  }
  return null;
}

/**
 * 週次共有を保存する（同じ週は上書き）。
 * company は chatSpaceId（フォーム）or groupCompanyId（AI）で解決済みのもの。
 */
export async function saveWeeklyShare(input: {
  company: { id: string; name: string; ownerName: string };
  answers: WeeklyAnswers;
  source: WeeklySource;
  /** 監査ログの記録者（フォームは "form@group-support"、AIは接続した本人のメール） */
  actorEmail: string;
  actorName?: string | null;
}) {
  const { company, answers, source } = input;
  const weekId = getWeekId();
  const status = calculateStatus(answers.q1, answers.q5);
  const mark = source === "AI" ? `${WEEKLY_AI_MARK} ` : "";

  const submission = await db.weeklySubmission.upsert({
    where: { groupCompanyId_weekId: { groupCompanyId: company.id, weekId } },
    update: { ...answers, status },
    create: { groupCompanyId: company.id, weekId, ...answers, status },
  });

  await db.contactHistory.create({
    data: {
      groupCompanyId: company.id,
      type: "WEEKLY_SUBMISSION",
      content: `${mark}週次共有 (${weekId}): ${answers.q1}`,
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
    detail: `${weekId} status=${status} source=${source}`,
  });

  // Q5がサポート要請の場合、即時通知（メール＋Chat）
  if (answers.q5 === "あると助かる" || answers.q5 === "できれば早めに欲しい") {
    const alertPayload = {
      companyName: company.name,
      ownerName: company.ownerName,
      companyId: company.id,
      q1: answers.q1,
      q5: answers.q5,
      q4: answers.q4,
      weekId,
    };
    sendGroupSupportAlertEmail(alertPayload).catch((e) => console.error("[group-support/submit] Alert email error:", e));
    sendGroupSupportAlertChat(alertPayload).catch((e) => console.error("[group-support/submit] Alert chat error:", e));
  }

  return { submission, weekId, status };
}
