"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { getMockBranchId } from "@/lib/data/customers";
import type { EstimationStatus } from "@/generated/prisma/client";
import type { UserRole } from "@/types/roles";
import { sendEstimateNotification } from "@/lib/notifications";

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

// ---------------------------------------------------------------
// 見積書の新規作成
// ---------------------------------------------------------------
export type EstimationItemInput = {
  name: string;
  spec: string;
  quantity: number;
  unit: string;
  unitPrice: number;
  amount: number;
  costPrice: number | null;
  templateId: string | null;
};

export async function createEstimation(
  _prev: { error?: string } | null,
  formData: FormData
): Promise<{ error?: string }> {
  const info = await getSessionInfo();
  if (!info) return { error: "ログインが必要です" };
  const { staffName, branchId } = info;

  const title = (formData.get("title") as string)?.trim();
  if (!title) return { error: "見積タイトルは必須です" };

  // _intent: "draft" → DRAFT（通知なし）/ "issue" → ISSUED（通知あり）
  const intent = (formData.get("_intent") as string) || "issue";
  const status: EstimationStatus = intent === "draft" ? "DRAFT" : "ISSUED";
  const estimateDateRaw = (formData.get("estimateDate") as string) || null;
  const validUntilRaw = (formData.get("validUntil") as string) || null;
  const notes = (formData.get("notes") as string)?.trim() || null;
  const customerId = (formData.get("customerId") as string)?.trim() || null;
  const projectId = (formData.get("projectId") as string)?.trim() || null;
  const itemsJson = (formData.get("items") as string) || "[]";
  const discountAmountRaw = formData.get("discountAmount") as string;
  const discountAmount = discountAmountRaw ? Math.max(0, Number(discountAmountRaw)) : null;
  const discountReason = (formData.get("discountReason") as string)?.trim() || null;
  const discountReasonNote = (formData.get("discountReasonNote") as string)?.trim() || null;

  let items: EstimationItemInput[] = [];
  try {
    items = JSON.parse(itemsJson);
  } catch {
    return { error: "明細データが不正です" };
  }

  if (items.length === 0) return { error: "明細を1件以上入力してください" };

  let estimationId: string;
  try {
    const estimation = await db.estimation.create({
      data: {
        title,
        status: status as EstimationStatus,
        estimateDate: estimateDateRaw ? new Date(estimateDateRaw) : new Date(),
        validUntil: validUntilRaw ? new Date(validUntilRaw) : null,
        notes,
        staffName,
        customerId: customerId || null,
        projectId: projectId || null,
        discountAmount: discountAmount && discountAmount > 0 ? discountAmount : null,
        discountReason: discountReason || null,
        discountReasonNote: discountReasonNote || null,
        createdByEmail: info.email,
        branchId,
        items: {
          create: items.map((item, idx) => ({
            name: item.name,
            spec: item.spec || null,
            quantity: item.quantity,
            unit: item.unit || null,
            unitPrice: item.unitPrice,
            amount: item.amount,
            costPrice: item.costPrice ?? null,
            templateId: item.templateId ?? null,
            sortOrder: idx,
          })),
        },
      },
    });
    estimationId = estimation.id;
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error("[createEstimation] DB error:", msg);
    return { error: "保存に失敗しました" };
  }

  // 顧客名を取得（任意紐づき）
  let customerName = "—";
  if (customerId) {
    const customer = await db.customer.findUnique({
      where: { id: customerId },
      select: { name: true },
    });
    if (customer) customerName = customer.name;
  }

  // 合計金額（税込）を計算
  const subtotal = items.reduce((s, it) => s + it.amount, 0);
  const discountedSubtotal = Math.max(
    0,
    subtotal - (discountAmount && discountAmount > 0 ? discountAmount : 0)
  );
  const totalInclTax = discountedSubtotal + Math.round(discountedSubtotal * 0.1);

  // 発行時のみ通知送信（下書きは送らない）
  if (intent !== "draft") sendEstimateNotification({
    estimationId,
    title,
    customerName,
    totalInclTax,
    staffName,
    staffEmail: info.email,
  }).catch((e) => console.error("[createEstimation] notification error:", e));

  revalidatePath("/dashboard/estimates");
  redirect(`/dashboard/estimates/${estimationId}`);
}

// ---------------------------------------------------------------
// 見積書の削除（ADMIN のみ）
// ---------------------------------------------------------------
export async function deleteEstimation(id: string): Promise<{ error?: string }> {
  const info = await getSessionInfo();
  if (!info) return { error: "ログインが必要です" };
  if (info.role !== "ADMIN") return { error: "管理者のみ削除できます" };

  try {
    await db.estimation.delete({ where: { id } });
  } catch (e) {
    console.error("[deleteEstimation]", e);
    return { error: "削除に失敗しました" };
  }

  revalidatePath("/dashboard/estimates");
  return {};
}

// ---------------------------------------------------------------
// 見積書のステータス更新
// ---------------------------------------------------------------
export async function updateEstimationStatus(
  estimationId: string,
  status: EstimationStatus
): Promise<void> {
  const info = await getSessionInfo();
  if (!info) return;

  try {
    await db.estimation.update({
      where: { id: estimationId },
      data: { status },
    });
  } catch (e) {
    console.error("[updateEstimationStatus]", e);
  }

  revalidatePath(`/dashboard/estimates/${estimationId}`);
  revalidatePath("/dashboard/estimates");
}
