"use server";

import { db } from "@/lib/db";
import { calculateStatus, getWeekId } from "@/lib/constants/group-support";
import { logAudit } from "@/lib/audit";

export type SubmitState = {
  success?: boolean;
  error?: string;
  companyName?: string;
} | null;

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

    return { success: true, companyName: company.name };
  } catch (e) {
    console.error("[group-support/submit] Error:", e);
    return { error: "送信に失敗しました。しばらくしてからもう一度お試しください。" };
  }
}
