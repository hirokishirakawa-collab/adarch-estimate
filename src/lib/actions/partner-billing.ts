"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { getSessionInfo } from "@/lib/session";
import { logAudit } from "@/lib/audit";

interface BillingInfo {
  registeredName?: string | null;
  entityType: "CORPORATION" | "SOLE_PROPRIETOR" | "UNKNOWN";
  corporateNumber: string | null;
  invoiceNumber: string | null;
  invoiceRegistered: boolean;
  bankName: string | null;
  bankBranch: string | null;
  bankAccountType: "SAVINGS" | "CHECKING" | null;
  bankAccountNumber: string | null;
  bankAccountHolder: string | null;
  contractEndDate?: string | null;
  contractRenewed?: boolean;
}

export async function updatePartnerBillingInfo(
  companyId: string,
  data: BillingInfo
): Promise<{ error?: string }> {
  const info = await getSessionInfo();
  if (!info || info.role !== "ADMIN") {
    return { error: "権限がありません" };
  }

  try {
    await db.groupCompany.update({
      where: { id: companyId },
      data: {
        ...(data.registeredName !== undefined ? { registeredName: data.registeredName } : {}),
        entityType: data.entityType,
        corporateNumber: data.corporateNumber,
        invoiceNumber: data.invoiceNumber,
        invoiceRegistered: data.invoiceRegistered,
        bankName: data.bankName,
        bankBranch: data.bankBranch,
        bankAccountType: data.bankAccountType,
        bankAccountNumber: data.bankAccountNumber,
        bankAccountHolder: data.bankAccountHolder,
        ...(data.contractEndDate !== undefined
          ? { contractEndDate: data.contractEndDate ? new Date(data.contractEndDate) : null }
          : {}),
        ...(data.contractRenewed !== undefined
          ? { contractRenewed: data.contractRenewed }
          : {}),
      },
    });

    logAudit({
      action: "partner_billing_updated",
      email: info.email,
      name: info.staffName,
      entity: "group_company",
      entityId: companyId,
      detail: `法人区分: ${data.entityType}, インボイス: ${data.invoiceRegistered ? "登録済" : "未登録"}`,
    });
  } catch (e) {
    console.error("[updatePartnerBillingInfo] DB error:", e instanceof Error ? e.message : e);
    return { error: "保存に失敗しました" };
  }

  revalidatePath("/dashboard/admin/partner-billing");
  revalidatePath("/dashboard/billing/settings");
  return {};
}

// ---------------------------------------------------------------
// パートナー自身の経理情報取得
// ---------------------------------------------------------------
export async function getMyBillingInfo() {
  const info = await getSessionInfo();
  if (!info) return null;

  const user = await db.user.findUnique({
    where: { email: info.email },
    select: { groupCompanyId: true },
  });
  if (!user?.groupCompanyId) return null;

  return db.groupCompany.findUnique({
    where: { id: user.groupCompanyId },
    select: {
      id: true,
      name: true,
      ownerName: true,
      registeredName: true,
      entityType: true,
      corporateNumber: true,
      invoiceNumber: true,
      invoiceRegistered: true,
      bankName: true,
      bankBranch: true,
      bankAccountType: true,
      bankAccountNumber: true,
      bankAccountHolder: true,
    },
  });
}

// ---------------------------------------------------------------
// パートナー自身が経理情報を更新
// ---------------------------------------------------------------
export async function updateMyBillingInfo(
  _prev: { error?: string; success?: boolean } | null,
  formData: FormData
): Promise<{ error?: string; success?: boolean }> {
  const info = await getSessionInfo();
  if (!info) return { error: "ログインが必要です" };

  const user = await db.user.findUnique({
    where: { email: info.email },
    select: { groupCompanyId: true },
  });
  if (!user?.groupCompanyId) {
    return { error: "グループ企業が紐付けされていません。管理者にお問い合わせください。" };
  }

  const registeredName = (formData.get("registeredName") as string)?.trim() || null;
  const entityType = (formData.get("entityType") as string) || "UNKNOWN";
  const corporateNumber = (formData.get("corporateNumber") as string)?.trim() || null;
  const invoiceRegistered = formData.get("invoiceRegistered") === "on";
  const invoiceNumber = (formData.get("invoiceNumber") as string)?.trim() || null;
  const bankName = (formData.get("bankName") as string)?.trim() || null;
  const bankBranch = (formData.get("bankBranch") as string)?.trim() || null;
  const bankAccountType = (formData.get("bankAccountType") as string) || null;
  const bankAccountNumber = (formData.get("bankAccountNumber") as string)?.trim() || null;
  const bankAccountHolder = (formData.get("bankAccountHolder") as string)?.trim() || null;

  try {
    await db.groupCompany.update({
      where: { id: user.groupCompanyId },
      data: {
        registeredName,
        entityType: entityType as "CORPORATION" | "SOLE_PROPRIETOR" | "UNKNOWN",
        corporateNumber,
        invoiceNumber,
        invoiceRegistered,
        bankName,
        bankBranch,
        bankAccountType: bankAccountType as "SAVINGS" | "CHECKING" | null,
        bankAccountNumber,
        bankAccountHolder,
      },
    });

    logAudit({
      action: "partner_billing_self_updated",
      email: info.email,
      name: info.staffName,
      entity: "group_company",
      entityId: user.groupCompanyId,
      detail: `法人区分: ${entityType}, インボイス: ${invoiceRegistered ? "登録済" : "未登録"}`,
    });
  } catch (e) {
    console.error("[updateMyBillingInfo] DB error:", e instanceof Error ? e.message : e);
    return { error: "保存に失敗しました" };
  }

  revalidatePath("/dashboard/billing/settings");
  revalidatePath("/dashboard/admin/partner-billing");
  return { success: true };
}

