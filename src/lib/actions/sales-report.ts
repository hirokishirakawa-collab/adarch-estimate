"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { after } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { getMockBranchId } from "@/lib/data/customers";
import { sendRevenueNotification } from "@/lib/notifications";
import type { UserRole } from "@/types/roles";

// ---------------------------------------------------------------
// 共通: セッション情報取得
// ---------------------------------------------------------------
async function getSessionInfo() {
  const session = await auth();
  if (!session?.user) return null;
  const role = (session.user.role ?? "MANAGER") as UserRole;
  const email = session.user.email ?? "";
  const branchId = getMockBranchId(email, role) ?? "branch_hq";

  // DB から userId を取得（createdById の保存に必要）
  const user = await db.user.findUnique({
    where: { email: session.user.email ?? "" },
    select: { id: true },
  });

  return { role, email, branchId, userId: user?.id ?? null };
}

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
  if (!info.userId) return { error: "ユーザー情報の取得に失敗しました" };

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

  // 本人が作成したレポートのみ編集可
  const existing = await db.revenueReport.findFirst({
    where: { id: reportId, createdById: info.userId ?? "__none__" },
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

  // 本人が作成したレポートのみ削除可
  const existing = await db.revenueReport.findFirst({
    where: { id: reportId, createdById: info.userId ?? "__none__" },
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
