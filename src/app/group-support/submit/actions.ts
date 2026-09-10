"use server";

import { db } from "@/lib/db";
import { logAudit } from "@/lib/audit";
import { notifyCeo } from "@/lib/google-chat";
import { saveWeeklyShare, validateWeeklyAnswers } from "@/lib/group-support/submit-weekly";

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
    const answers = {
      q1: formData.get("q1") as string,
      q2: formData.get("q2") as string,
      q3: formData.get("q3") as string,
      q4: formData.get("q4") as string,
      q5: formData.get("q5") as string,
    };

    if (!chatSpaceId) {
      return { error: "すべての項目を入力してください" };
    }
    const invalid = validateWeeklyAnswers(answers);
    if (invalid) return { error: invalid };

    const company = await db.groupCompany.findUnique({
      where: { chatSpaceId },
    });

    if (!company) {
      return { error: "企業情報が見つかりません" };
    }

    // 保存・履歴・監査ログ・Q5アラートは共通コア（AI連携の submit_weekly_share と同じ処理）
    await saveWeeklyShare({
      company,
      answers,
      source: "FORM",
      actorEmail: "form@group-support",
    });

    return { success: true, companyName: company.name };
  } catch (e) {
    console.error("[group-support/submit] Error:", e);
    return { error: "送信に失敗しました。しばらくしてからもう一度お試しください。" };
  }
}
