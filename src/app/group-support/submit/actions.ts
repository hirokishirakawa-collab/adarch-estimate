"use server";

import { db } from "@/lib/db";
import { calculateStatus, getWeekId } from "@/lib/constants/group-support";
import { logAudit } from "@/lib/audit";
import { sendGroupSupportAlertEmail, sendGroupSupportAlertChat } from "@/lib/resend";
import { notifyCeo } from "@/lib/google-chat";

export type SubmitState = {
  success?: boolean;
  error?: string;
  companyName?: string;
} | null;

// ---------------------------------------------------------------
// 相談ボタン専用（週次共有とは別経路。WeeklySubmissionは触らない）
// 履歴(MANUAL_NOTE)に記録し、CEOアラートスペースへ即時通知する
// ---------------------------------------------------------------
export async function submitConsult(
  _prev: SubmitState,
  formData: FormData
): Promise<SubmitState> {
  try {
    const chatSpaceId = formData.get("chatSpaceId") as string;
    const content = ((formData.get("content") as string) || "").trim();

    if (!chatSpaceId || !content) {
      return { error: "相談内容を入力してください" };
    }

    const company = await db.groupCompany.findUnique({
      where: { chatSpaceId },
    });
    if (!company) {
      return { error: "企業情報が見つかりません" };
    }

    await db.contactHistory.create({
      data: {
        groupCompanyId: company.id,
        type: "MANUAL_NOTE",
        content: `💬 相談ボタンより: ${content}`,
        actorName: company.ownerName,
      },
    });

    logAudit({
      action: "group_consult_submitted",
      email: "form@group-support",
      name: company.name,
      entity: "contact_history",
      detail: content.slice(0, 80),
    });

    // CEOアラートスペースへ通知（Q5アラートと同じ場所）
    const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "";
    notifyCeo(
      `💬 *相談リクエスト* — ${company.name}（${company.ownerName}）\n\n` +
        `${content}\n\n` +
        (appUrl ? `👉 ${appUrl}/dashboard/group-support/${company.id}` : "")
    ).catch((e) => console.error("[group-support/consult] notifyCeo error:", e));

    return { success: true, companyName: company.name };
  } catch (e) {
    console.error("[group-support/consult] Error:", e);
    return { error: "送信に失敗しました。しばらくしてからもう一度お試しください。" };
  }
}

export async function submitWeeklyShare(
  _prev: SubmitState,
  formData: FormData
): Promise<SubmitState> {
  try {
    const chatSpaceId = formData.get("chatSpaceId") as string;
    const q1 = formData.get("q1") as string;
    const q2 = formData.get("q2") as string;
    const q3 = formData.get("q3") as string;
    const q4 = formData.get("q4") as string;
    const q5 = formData.get("q5") as string;

    if (!chatSpaceId || !q1 || !q2 || !q3 || !q4 || !q5) {
      return { error: "すべての項目を入力してください" };
    }

    const company = await db.groupCompany.findUnique({
      where: { chatSpaceId },
    });

    if (!company) {
      return { error: "企業情報が見つかりません" };
    }

    const weekId = getWeekId();
    const status = calculateStatus(q1, q5);

    const submission = await db.weeklySubmission.upsert({
      where: {
        groupCompanyId_weekId: {
          groupCompanyId: company.id,
          weekId,
        },
      },
      update: { q1, q2, q3, q4, q5, status },
      create: {
        groupCompanyId: company.id,
        weekId,
        q1,
        q2,
        q3,
        q4,
        q5,
        status,
      },
    });

    await db.contactHistory.create({
      data: {
        groupCompanyId: company.id,
        type: "WEEKLY_SUBMISSION",
        content: `週次共有 (${weekId}): ${q1}`,
        actorName: company.ownerName,
        weekId,
      },
    });

    logAudit({
      action: "group_weekly_submitted",
      email: "form@group-support",
      name: company.name,
      entity: "weekly_submission",
      entityId: submission.id,
      detail: `${weekId} status=${status}`,
    });

    // Q5がサポート要請の場合、即時通知（メール＋Chat）
    if (q5 === "あると助かる" || q5 === "できれば早めに欲しい") {
      const alertPayload = {
        companyName: company.name,
        ownerName: company.ownerName,
        companyId: company.id,
        q1,
        q5,
        q4,
        weekId,
      };
      sendGroupSupportAlertEmail(alertPayload).catch((e) =>
        console.error("[group-support/submit] Alert email error:", e)
      );
      sendGroupSupportAlertChat(alertPayload).catch((e) =>
        console.error("[group-support/submit] Alert chat error:", e)
      );
    }

    return { success: true, companyName: company.name };
  } catch (e) {
    console.error("[group-support/submit] Error:", e);
    return { error: "送信に失敗しました。しばらくしてからもう一度お試しください。" };
  }
}
