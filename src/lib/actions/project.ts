"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { getMockBranchId } from "@/lib/data/customers";
import type { ProjectStatus, ExpenseCategory, BillingStatus } from "@/generated/prisma/client";
import type { UserRole } from "@/types/roles";

// ---------------------------------------------------------------
// 共通ユーティリティ
// ---------------------------------------------------------------
async function getSessionInfo() {
  const session = await auth();
  if (!session?.user) return null;
  const role = (session.user.role ?? "MANAGER") as UserRole;
  const email = session.user.email ?? "";
  const staffName = session.user.name ?? session.user.email ?? "不明";
  const branchId = getMockBranchId(email, role) ?? "branch_hq";
  return { role, email, staffName, branchId };
}

// プロジェクトステータスのラベル
const STATUS_LABELS: Record<string, string> = {
  ORDERED:     "受注済み",
  IN_PROGRESS: "進行中",
  COMPLETED:   "完了",
  ON_HOLD:     "保留",
  CANCELLED:   "キャンセル",
};

// フィールド名のラベル
const FIELD_LABELS: Record<string, string> = {
  title:       "プロジェクト名",
  status:      "ステータス",
  deadline:    "納期",
  budget:      "予算",
  description: "概要・説明",
  staffName:   "担当者",
  customerId:  "顧客",
};

// ---------------------------------------------------------------
// プロジェクトを新規作成する
// ---------------------------------------------------------------
export async function createProject(
  _prev: { error?: string } | null,
  formData: FormData
): Promise<{ error?: string }> {
  const info = await getSessionInfo();
  if (!info) return { error: "ログインが必要です" };
  const { staffName, branchId } = info;

  const title = (formData.get("title") as string)?.trim();
  if (!title) return { error: "プロジェクト名は必須です" };
  if (title.length > 100) return { error: "プロジェクト名は100文字以内で入力してください" };

  const status    = (formData.get("status") as string)   || "IN_PROGRESS";
  const deadline  = (formData.get("deadline") as string)  || null;
  const budgetRaw = (formData.get("budget") as string)?.trim();
  const budget    = budgetRaw ? parseInt(budgetRaw.replace(/,/g, ""), 10) : null;
  const description = (formData.get("description") as string)?.trim() || null;
  const customerId  = (formData.get("customerId") as string)?.trim()  || null;

  if (budget !== null && (isNaN(budget) || budget < 0)) {
    return { error: "予算は0以上の整数で入力してください" };
  }

  let projectId: string;
  try {
    const project = await db.project.create({
      data: {
        title,
        status: status as ProjectStatus,
        deadline: deadline ? new Date(deadline) : null,
        budget: budget ?? null,
        description,
        staffName,
        customerId: customerId || null,
        branchId,
      },
    });
    projectId = project.id;
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error("[createProject] DB error:", msg);
    return { error: process.env.NODE_ENV !== "production" ? `保存失敗: ${msg}` : "保存に失敗しました。再度お試しください" };
  }

  revalidatePath("/dashboard/projects");
  redirect(`/dashboard/projects/${projectId}`);
}

// ---------------------------------------------------------------
// プロジェクトを更新する（変更点を自動ログ）
// ---------------------------------------------------------------
export async function updateProject(
  projectId: string,
  _prev: { error?: string } | null,
  formData: FormData
): Promise<{ error?: string }> {
  const info = await getSessionInfo();
  if (!info) return { error: "ログインが必要です" };
  const { staffName, branchId, role } = info;

  // 既存データ取得
  const whereClause = role === "ADMIN" ? { id: projectId } : { id: projectId, branchId };
  const existing = await db.project.findFirst({ where: whereClause });
  if (!existing) return { error: "プロジェクトが見つかりません" };

  const title       = (formData.get("title") as string)?.trim();
  const status      = (formData.get("status") as string) || "IN_PROGRESS";
  const deadlineRaw = (formData.get("deadline") as string) || null;
  const budgetRaw   = (formData.get("budget") as string)?.trim();
  const description = (formData.get("description") as string)?.trim() || null;
  const customerIdRaw = (formData.get("customerId") as string)?.trim() || null;
  const staffNameField = (formData.get("staffName") as string)?.trim() || null;

  if (!title) return { error: "プロジェクト名は必須です" };
  if (title.length > 100) return { error: "プロジェクト名は100文字以内で入力してください" };

  const budget = budgetRaw ? parseInt(budgetRaw.replace(/,/g, ""), 10) : null;
  if (budget !== null && (isNaN(budget) || budget < 0)) {
    return { error: "予算は0以上の整数で入力してください" };
  }

  const deadline = deadlineRaw ? new Date(deadlineRaw) : null;

  // 差分検出
  const diffs: string[] = [];

  const newBudget = budget !== null ? BigInt(budget) : null;
  const oldBudget = existing.budget !== null ? BigInt(existing.budget.toString()) : null;

  if (existing.title !== title)
    diffs.push(`「${FIELD_LABELS.title}」を「${existing.title}」から「${title}」に変更しました`);
  if (existing.status !== status)
    diffs.push(`「${FIELD_LABELS.status}」を「${STATUS_LABELS[existing.status] ?? existing.status}」から「${STATUS_LABELS[status] ?? status}」に変更しました`);
  if (String(oldBudget) !== String(newBudget))
    diffs.push(`「${FIELD_LABELS.budget}」を「${oldBudget !== null ? Number(oldBudget).toLocaleString() + "円" : "未設定"}」から「${newBudget !== null ? Number(newBudget).toLocaleString() + "円" : "未設定"}」に変更しました`);
  if ((existing.description ?? "") !== (description ?? ""))
    diffs.push(`「${FIELD_LABELS.description}」を更新しました`);
  if ((existing.staffName ?? "") !== (staffNameField ?? ""))
    diffs.push(`「${FIELD_LABELS.staffName}」を「${existing.staffName ?? "未設定"}」から「${staffNameField ?? "未設定"}」に変更しました`);
  if ((existing.customerId ?? null) !== (customerIdRaw ?? null))
    diffs.push(`「${FIELD_LABELS.customerId}」を変更しました`);

  // 納期の差分（日付比較）
  const oldDeadlineStr = existing.deadline ? existing.deadline.toISOString().split("T")[0] : null;
  const newDeadlineStr = deadline ? deadline.toISOString().split("T")[0] : null;
  if (oldDeadlineStr !== newDeadlineStr)
    diffs.push(`「${FIELD_LABELS.deadline}」を「${oldDeadlineStr ?? "未設定"}」から「${newDeadlineStr ?? "未設定"}」に変更しました`);

  try {
    await db.project.update({
      where: { id: projectId },
      data: {
        title,
        status: status as ProjectStatus,
        deadline,
        budget: budget ?? null,
        description,
        staffName: staffNameField,
        customerId: customerIdRaw || null,
      },
    });

    // 差分ログを ProjectLog に保存
    if (diffs.length > 0) {
      await db.projectLog.create({
        data: {
          type: "SYSTEM",
          content: diffs.join("\n"),
          staffName,
          projectId,
        },
      });
    }
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error("[updateProject] DB error:", msg);
    return { error: process.env.NODE_ENV !== "production" ? `保存失敗: ${msg}` : "保存に失敗しました" };
  }

  revalidatePath(`/dashboard/projects/${projectId}`);
  redirect(`/dashboard/projects/${projectId}`);
}

// ---------------------------------------------------------------
// 経費を追加する
// ---------------------------------------------------------------
export async function createExpense(
  projectId: string,
  _prev: { error?: string } | null,
  formData: FormData
): Promise<{ error?: string }> {
  const info = await getSessionInfo();
  if (!info) return { error: "ログインが必要です" };
  const { staffName, branchId } = info;

  const title = (formData.get("title") as string)?.trim();
  if (!title) return { error: "経費名は必須です" };

  const amountRaw = (formData.get("amount") as string)?.trim();
  const amount = amountRaw ? parseInt(amountRaw.replace(/,/g, ""), 10) : NaN;
  if (isNaN(amount) || amount <= 0) return { error: "金額は1円以上の整数で入力してください" };

  const category = (formData.get("category") as string) || "OTHER";
  const dateRaw  = (formData.get("date") as string) || null;
  const notes    = (formData.get("notes") as string)?.trim() || null;

  try {
    await db.expense.create({
      data: {
        title,
        amount,
        category: category as ExpenseCategory,
        date: dateRaw ? new Date(dateRaw) : new Date(),
        notes,
        staffName,
        projectId,
        branchId,
      },
    });

    // 経費追加ログ
    await db.projectLog.create({
      data: {
        type: "EXPENSE_ADDED",
        content: `経費「${title}」${amount.toLocaleString()}円 を追加しました`,
        staffName,
        projectId,
      },
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error("[createExpense] DB error:", msg);
    return { error: process.env.NODE_ENV !== "production" ? `保存失敗: ${msg}` : "保存に失敗しました" };
  }

  revalidatePath(`/dashboard/projects/${projectId}`);
  return {};
}

// ---------------------------------------------------------------
// 請求ステータスを更新する
// ---------------------------------------------------------------
export async function updateBillingStatus(
  projectId: string,
  status: BillingStatus
): Promise<void> {
  const info = await getSessionInfo();
  if (!info) return;
  const { staffName } = info;

  const BILLING_LABELS: Record<BillingStatus, string> = {
    UNBILLED: "未請求",
    BILLED:   "請求済み",
    PAID:     "入金済み",
  };

  try {
    await db.project.update({
      where: { id: projectId },
      data: { billingStatus: status },
    });

    await db.projectLog.create({
      data: {
        type: "SYSTEM",
        content: `請求ステータスを「${BILLING_LABELS[status]}」に更新しました`,
        staffName,
        projectId,
      },
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error("[updateBillingStatus] DB error:", msg);
    return;
  }

  revalidatePath(`/dashboard/projects/${projectId}`);
}

// ---------------------------------------------------------------
// 経費を削除する
// ---------------------------------------------------------------
export async function deleteExpense(
  expenseId: string,
  projectId: string
): Promise<{ error?: string }> {
  const info = await getSessionInfo();
  if (!info) return { error: "ログインが必要です" };
  const { staffName } = info;

  try {
    const expense = await db.expense.findUnique({ where: { id: expenseId } });
    if (!expense) return { error: "経費が見つかりません" };

    await db.expense.delete({ where: { id: expenseId } });

    // 経費削除ログ
    await db.projectLog.create({
      data: {
        type: "EXPENSE_DELETED",
        content: `経費「${expense.title}」${Number(expense.amount).toLocaleString()}円 を削除しました`,
        staffName,
        projectId,
      },
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error("[deleteExpense] DB error:", msg);
    return { error: process.env.NODE_ENV !== "production" ? `削除失敗: ${msg}` : "削除に失敗しました" };
  }

  revalidatePath(`/dashboard/projects/${projectId}`);
  return {};
}
