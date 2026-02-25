"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { after } from "next/server";
import { db } from "@/lib/db";
import { getSessionInfo } from "@/lib/session";
import { sendRevenueNotification } from "@/lib/notifications";
import type { UserRole } from "@/types/roles";

/** MANAGER 以上のみ許可 */
function isForbidden(role: UserRole): boolean {
  return role === "USER";
}

// ---------------------------------------------------------------
// 売上報告を作成する
// ---------------------------------------------------------------
export async function createRevenueReport(
  _prev: { error?: string } | null,
  formData: FormData
): Promise<{ error?: string }> {
  const info = await getSessionInfo();
  if (!info) return { error: "ログインが必要です" };
  if (isForbidden(info.role)) return { error: "権限がありません" };
  // userId は getSessionInfo() の upsert により必ず存在する

  const amountRaw = (formData.get("amount") as string)?.replace(/,/g, "").trim();
  const amount = amountRaw ? parseInt(amountRaw, 10) : NaN;
  if (!amountRaw || isNaN(amount) || amount < 0)
    return { error: "金額（税抜）は0以上の整数で入力してください" };

  const targetMonthRaw = (formData.get("targetMonth") as string)?.trim();
  if (!targetMonthRaw) return { error: "計上月を選択してください" };
  // "YYYY-MM" → 月初日 DateTime
  const targetMonth = new Date(`${targetMonthRaw}-01T00:00:00.000Z`);
  if (isNaN(targetMonth.getTime())) return { error: "計上月の形式が正しくありません" };

  const projectName = (formData.get("projectName") as string)?.trim() || null;
  const memo        = (formData.get("memo") as string)?.trim() || null;

  try {
    await db.revenueReport.create({
      data: {
        amount,
        targetMonth,
        projectName,
        memo,
        branchId: info.branchId,
        createdById: info.userId,
      },
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error("[createRevenueReport] DB error:", msg);
    return { error: "保存に失敗しました" };
  }

  const monthLabel = targetMonth.toLocaleDateString("ja-JP", { year: "numeric", month: "long", timeZone: "UTC" });
  after(async () => {
    await sendRevenueNotification({
      eventType: "REVENUE_CREATED",
      reportId: "",
      targetMonth: monthLabel,
      amount,
      projectName,
      staffName: info.email,
    });
  });

  revalidatePath("/dashboard/sales-report");
  redirect("/dashboard/sales-report");
}

// ---------------------------------------------------------------
// 売上報告を更新する
// ---------------------------------------------------------------
export async function updateRevenueReport(
  reportId: string,
  _prev: { error?: string } | null,
  formData: FormData
): Promise<{ error?: string }> {
  const info = await getSessionInfo();
  if (!info) return { error: "ログインが必要です" };
  if (isForbidden(info.role)) return { error: "権限がありません" };
  // userId は getSessionInfo() の upsert により必ず存在する

  // 本人が作成したレポートのみ編集可
  const existing = await db.revenueReport.findFirst({
    where: { id: reportId, createdById: info.userId },
  });
  if (!existing) return { error: "対象の売上報告が見つかりません" };

  const amountRaw = (formData.get("amount") as string)?.replace(/,/g, "").trim();
  const amount = amountRaw ? parseInt(amountRaw, 10) : NaN;
  if (!amountRaw || isNaN(amount) || amount < 0)
    return { error: "金額（税抜）は0以上の整数で入力してください" };

  const targetMonthRaw = (formData.get("targetMonth") as string)?.trim();
  if (!targetMonthRaw) return { error: "計上月を選択してください" };
  const targetMonth = new Date(`${targetMonthRaw}-01T00:00:00.000Z`);
  if (isNaN(targetMonth.getTime())) return { error: "計上月の形式が正しくありません" };

  const projectName = (formData.get("projectName") as string)?.trim() || null;
  const memo        = (formData.get("memo") as string)?.trim() || null;

  try {
    await db.revenueReport.update({
      where: { id: reportId },
      data: { amount, targetMonth, projectName, memo },
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error("[updateRevenueReport] DB error:", msg);
    return { error: "更新に失敗しました" };
  }

  const monthLabel = targetMonth.toLocaleDateString("ja-JP", { year: "numeric", month: "long", timeZone: "UTC" });
  after(async () => {
    await sendRevenueNotification({
      eventType: "REVENUE_UPDATED",
      reportId,
      targetMonth: monthLabel,
      amount,
      projectName,
      staffName: info.email,
    });
  });

  revalidatePath("/dashboard/sales-report");
  redirect("/dashboard/sales-report");
}

// ---------------------------------------------------------------
// 売上報告を削除する
// ---------------------------------------------------------------
export async function deleteRevenueReport(
  reportId: string
): Promise<{ error?: string }> {
  const info = await getSessionInfo();
  if (!info) return { error: "ログインが必要です" };
  if (isForbidden(info.role)) return { error: "権限がありません" };
  // userId は getSessionInfo() の upsert により必ず存在する

  // 本人が作成したレポートのみ削除可
  const existing = await db.revenueReport.findFirst({
    where: { id: reportId, createdById: info.userId },
  });
  if (!existing) return { error: "対象の売上報告が見つかりません" };

  try {
    await db.revenueReport.delete({ where: { id: reportId } });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error("[deleteRevenueReport] DB error:", msg);
    return { error: "削除に失敗しました" };
  }

  revalidatePath("/dashboard/sales-report");
  redirect("/dashboard/sales-report");
}
