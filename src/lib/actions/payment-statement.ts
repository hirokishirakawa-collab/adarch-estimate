"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { getSessionInfo } from "@/lib/session";
import { logAudit } from "@/lib/audit";

// ---------------------------------------------------------------
// ADMIN: 支払明細一覧
// ---------------------------------------------------------------
export async function getPaymentStatements() {
  const info = await getSessionInfo();
  if (!info) return [];

  // パートナー: 自社の明細のみ（CONFIRMED/PAID）
  if (info.role !== "ADMIN") {
    const user = await db.user.findUnique({
      where: { email: info.email },
      select: { groupCompanyId: true },
    });
    if (!user?.groupCompanyId) return [];
    return db.paymentStatement.findMany({
      where: {
        groupCompanyId: user.groupCompanyId,
        status: { in: ["CONFIRMED", "PAID"] },
      },
      orderBy: { createdAt: "desc" },
      include: {
        groupCompany: { select: { name: true, ownerName: true } },
      },
    });
  }

  // ADMIN: 全件
  return db.paymentStatement.findMany({
    orderBy: { createdAt: "desc" },
    include: {
      groupCompany: { select: { name: true, ownerName: true, entityType: true, invoiceRegistered: true } },
      invoiceRequest: { select: { id: true, subject: true } },
    },
    take: 500,
  });
}

// ---------------------------------------------------------------
// ADMIN: 支払明細の単件取得
// ---------------------------------------------------------------
export async function getPaymentStatementById(id: string) {
  const info = await getSessionInfo();
  if (!info) return null;

  const statement = await db.paymentStatement.findUnique({
    where: { id },
    include: {
      groupCompany: {
        select: {
          id: true, name: true, ownerName: true,
          entityType: true, invoiceRegistered: true,
          bankName: true, bankBranch: true, bankAccountType: true,
          bankAccountNumber: true, bankAccountHolder: true,
        },
      },
      invoiceRequest: { select: { id: true, subject: true } },
      createdBy: { select: { name: true } },
    },
  });

  if (!statement) return null;

  // パートナーは自社のもの（CONFIRMED/PAID）のみ閲覧可
  if (info.role !== "ADMIN") {
    const user = await db.user.findUnique({
      where: { email: info.email },
      select: { groupCompanyId: true },
    });
    if (user?.groupCompanyId !== statement.groupCompanyId) return null;
    if (statement.status === "DRAFT") return null;
  }

  return statement;
}

// ---------------------------------------------------------------
// ADMIN: 支払明細を作成
// ---------------------------------------------------------------
export async function createPaymentStatement(
  _prev: { error?: string } | null,
  formData: FormData
): Promise<{ error?: string }> {
  const info = await getSessionInfo();
  if (!info || info.role !== "ADMIN") return { error: "権限がありません" };

  const groupCompanyId = (formData.get("groupCompanyId") as string)?.trim();
  const title = (formData.get("title") as string)?.trim();
  const clientName = (formData.get("clientName") as string)?.trim() || null;
  const description = (formData.get("description") as string)?.trim() || null;
  const invoiceRequestId = (formData.get("invoiceRequestId") as string)?.trim() || null;
  const grossAmountRaw = (formData.get("grossAmount") as string)?.replace(/,/g, "").trim();
  const commissionRateRaw = (formData.get("commissionRate") as string)?.trim() || "10";
  const mediaExpenseRaw = (formData.get("mediaExpense") as string)?.replace(/,/g, "").trim() || "0";
  const productionExpenseRaw = (formData.get("productionExpense") as string)?.replace(/,/g, "").trim() || "0";
  const commissionAmountRaw = (formData.get("commissionAmount") as string)?.replace(/,/g, "").trim();
  const withholdingRaw = (formData.get("withholdingTaxAmount") as string)?.replace(/,/g, "").trim() || "0";
  const nonDeductibleRaw = (formData.get("nonDeductibleTaxAmount") as string)?.replace(/,/g, "").trim() || "0";
  const netPaymentRaw = (formData.get("netPaymentAmount") as string)?.replace(/,/g, "").trim();

  if (!groupCompanyId) return { error: "支払先パートナーを選択してください" };
  if (!title) return { error: "件名を入力してください" };
  if (!grossAmountRaw) return { error: "入金額を入力してください" };

  const grossAmount = parseInt(grossAmountRaw, 10);
  const commissionRate = parseFloat(commissionRateRaw);
  const commissionAmount = parseInt(commissionAmountRaw || "0", 10);
  const mediaExpense = parseInt(mediaExpenseRaw, 10);
  const productionExpense = parseInt(productionExpenseRaw, 10);
  const withholdingTaxAmount = parseInt(withholdingRaw, 10);
  const nonDeductibleTaxAmount = parseInt(nonDeductibleRaw, 10);
  const netPaymentAmount = parseInt(netPaymentRaw || "0", 10);

  if (isNaN(grossAmount) || grossAmount <= 0) return { error: "入金額は正の整数で入力してください" };

  let createdId = "";
  try {
    const created = await db.paymentStatement.create({
      data: {
        groupCompanyId,
        invoiceRequestId: invoiceRequestId || null,
        title,
        clientName,
        description,
        grossAmount,
        commissionRate,
        commissionAmount,
        mediaExpense,
        productionExpense,
        withholdingTaxAmount,
        nonDeductibleTaxAmount,
        netPaymentAmount,
        createdById: info.userId,
      },
    });
    createdId = created.id;
    logAudit({
      action: "payment_statement_created",
      email: info.email,
      name: info.staffName,
      entity: "payment_statement",
      entityId: created.id,
      detail: `${title} / 支払額: ¥${netPaymentAmount.toLocaleString()}`,
    });
  } catch (e) {
    console.error("[createPaymentStatement] DB error:", e instanceof Error ? e.message : e);
    return { error: "保存に失敗しました" };
  }

  revalidatePath("/dashboard/admin/payments");
  redirect(`/dashboard/admin/payments/${createdId}`);
}

// ---------------------------------------------------------------
// ADMIN: ステータス変更（確定 / 支払済み）
// ---------------------------------------------------------------
export async function updatePaymentStatementStatus(
  id: string,
  newStatus: "CONFIRMED" | "PAID"
): Promise<{ error?: string }> {
  const info = await getSessionInfo();
  if (!info || info.role !== "ADMIN") return { error: "権限がありません" };

  try {
    await db.paymentStatement.update({
      where: { id },
      data: {
        status: newStatus,
        ...(newStatus === "PAID" ? { paidAt: new Date() } : {}),
      },
    });
    logAudit({
      action: `payment_statement_${newStatus.toLowerCase()}`,
      email: info.email,
      name: info.staffName,
      entity: "payment_statement",
      entityId: id,
      detail: `ステータス変更: ${newStatus}`,
    });
  } catch (e) {
    console.error("[updatePaymentStatementStatus] DB error:", e instanceof Error ? e.message : e);
    return { error: "更新に失敗しました" };
  }

  revalidatePath("/dashboard/admin/payments");
  revalidatePath(`/dashboard/admin/payments/${id}`);
  revalidatePath("/dashboard/payments");
  return {};
}

// ---------------------------------------------------------------
// ADMIN: パートナー一覧（ドロップダウン用）
// ---------------------------------------------------------------
export async function getPartnersForSelect() {
  const info = await getSessionInfo();
  if (!info || info.role !== "ADMIN") return [];

  return db.groupCompany.findMany({
    where: { isActive: true },
    select: {
      id: true,
      name: true,
      ownerName: true,
      entityType: true,
      invoiceRegistered: true,
    },
    orderBy: { name: "asc" },
  });
}
