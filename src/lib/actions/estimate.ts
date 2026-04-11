"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { getMockBranchId } from "@/lib/data/customers";
import type { EstimationStatus } from "@/generated/prisma/client";
import type { UserRole } from "@/types/roles";
import { sendEstimateNotification } from "@/lib/notifications";
import { logAudit } from "@/lib/audit";

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
    logAudit({ action: "estimation_created", email: info.email, name: staffName, entity: "estimation", entityId: estimation.id, detail: title });
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
// 見積書の更新（閲覧可能ユーザー / ACCEPTED は編集不可）
// ---------------------------------------------------------------
export async function updateEstimation(
  _prev: { error?: string } | null,
  formData: FormData
): Promise<{ error?: string }> {
  const info = await getSessionInfo();
  if (!info) return { error: "ログインが必要です" };
  const { role, staffName, branchId: userBranchId } = info;

  const estimationId = (formData.get("estimationId") as string)?.trim();
  if (!estimationId) return { error: "見積IDが指定されていません" };

  // 既存取得 + 認可（同拠点 or ADMIN）
  const existing = await db.estimation.findUnique({
    where: { id: estimationId },
    select: { id: true, branchId: true, status: true, title: true },
  });
  if (!existing) return { error: "見積が見つかりません" };
  if (role !== "ADMIN" && existing.branchId !== userBranchId) {
    return { error: "編集権限がありません" };
  }
  if (existing.status === "ACCEPTED") {
    return { error: "承認済みの見積は編集できません" };
  }

  const title = (formData.get("title") as string)?.trim();
  if (!title) return { error: "見積タイトルは必須です" };

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

  try {
    await db.$transaction([
      db.estimationItem.deleteMany({ where: { estimationId } }),
      db.estimation.update({
        where: { id: estimationId },
        data: {
          title,
          estimateDate: estimateDateRaw ? new Date(estimateDateRaw) : new Date(),
          validUntil: validUntilRaw ? new Date(validUntilRaw) : null,
          notes,
          customerId: customerId || null,
          projectId: projectId || null,
          discountAmount: discountAmount && discountAmount > 0 ? discountAmount : null,
          discountReason: discountReason || null,
          discountReasonNote: discountReasonNote || null,
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
      }),
    ]);
    logAudit({ action: "estimation_updated", email: info.email, name: staffName, entity: "estimation", entityId: estimationId, detail: title });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error("[updateEstimation] DB error:", msg);
    return { error: "更新に失敗しました" };
  }

  revalidatePath(`/dashboard/estimates/${estimationId}`);
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
    logAudit({ action: "estimation_deleted", email: info.email, name: info.staffName, entity: "estimation", entityId: id });
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
    logAudit({ action: "estimation_status_updated", email: info.email, name: info.staffName, entity: "estimation", entityId: estimationId, detail: status });
  } catch (e) {
    console.error("[updateEstimationStatus]", e);
  }

  revalidatePath(`/dashboard/estimates/${estimationId}`);
  revalidatePath("/dashboard/estimates");
}
