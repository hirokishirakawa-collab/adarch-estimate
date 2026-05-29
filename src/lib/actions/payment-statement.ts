"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { getSessionInfo } from "@/lib/session";
import { logAudit } from "@/lib/audit";
import { computeBreakdown } from "@/lib/payment-statement-calc";
import { createInAppNotification } from "@/lib/notifications";

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
      items: { orderBy: { sortOrder: "asc" } },
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
  const itemsRaw = (formData.get("items") as string)?.trim() || "";
  const grossAmountRaw = (formData.get("grossAmount") as string)?.replace(/,/g, "").trim() || "";
  const commissionRateRaw = (formData.get("commissionRate") as string)?.trim() || "10";
  const adMediaCostRaw = (formData.get("adMediaCost") as string)?.replace(/,/g, "").trim() || "0";

  if (!groupCompanyId) return { error: "支払先パートナーを選択してください" };
  if (!title) return { error: "件名を入力してください" };

  const commissionRate = parseFloat(commissionRateRaw) || 0;
  const adMediaCostInput = parseInt(adMediaCostRaw, 10) || 0;

  // クライアント別明細行（複数クライアントを1明細にまとめる場合）
  type ItemInput = { clientName: string; grossAmount: number; note: string | null };
  let items: ItemInput[] = [];
  if (itemsRaw) {
    try {
      const parsed = JSON.parse(itemsRaw) as Array<{ clientName?: string; grossAmount?: number | string; note?: string }>;
      items = parsed
        .map((r) => ({
          clientName: String(r.clientName ?? "").trim(),
          grossAmount: parseInt(String(r.grossAmount ?? "0").replace(/,/g, ""), 10) || 0,
          note: ((r.note ?? "").toString().trim()) || null,
        }))
        .filter((r) => r.clientName && r.grossAmount > 0);
    } catch {
      return { error: "クライアント明細の形式が不正です" };
    }
  }

  // 入金額（税込）合計。明細行があれば行の合計、無ければ単一入金額。
  const grossInclTax = items.length > 0
    ? items.reduce((sum, r) => sum + r.grossAmount, 0)
    : parseInt(grossAmountRaw || "0", 10);

  if (isNaN(grossInclTax) || grossInclTax <= 0) return { error: "入金額を入力してください（クライアント明細を1件以上）" };

  // パートナーの税区分を取得し、税抜ベースでサーバー側計算（クライアント送信値は信用しない）
  const partner = await db.groupCompany.findUnique({
    where: { id: groupCompanyId },
    select: { entityType: true, invoiceRegistered: true },
  });
  if (!partner) return { error: "支払先パートナーが見つかりません" };

  const b = computeBreakdown({
    grossInclTax,
    commissionRate,
    adMediaCost: adMediaCostInput,
    isSoleProprietor: partner.entityType === "SOLE_PROPRIETOR",
    isInvoiceUnregistered: !partner.invoiceRegistered,
  });

  let createdId = "";
  try {
    const created = await db.paymentStatement.create({
      data: {
        groupCompanyId,
        invoiceRequestId: invoiceRequestId || null,
        title,
        clientName,
        description,
        grossAmount: b.grossInclTax,
        commissionRate: b.commissionRate,
        commissionAmount: b.commissionExclTax,
        mediaExpense: b.adMediaCost,
        productionExpense: b.productionExclTax,
        withholdingTaxAmount: b.withholdingTaxAmount,
        nonDeductibleTaxAmount: b.nonDeductibleTaxAmount,
        netPaymentAmount: b.netPaymentAmount,
        createdById: info.userId,
        ...(items.length > 0
          ? {
              items: {
                create: items.map((r, i) => ({
                  clientName: r.clientName,
                  grossAmount: r.grossAmount,
                  note: r.note,
                  sortOrder: i,
                })),
              },
            }
          : {}),
      },
    });
    createdId = created.id;
    logAudit({
      action: "payment_statement_created",
      email: info.email,
      name: info.staffName,
      entity: "payment_statement",
      entityId: created.id,
      detail: `${title} / 支払額: ¥${b.netPaymentAmount.toLocaleString()}`,
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

  let statement: { groupCompanyId: string; title: string; netPaymentAmount: unknown } | null = null;
  try {
    statement = await db.paymentStatement.update({
      where: { id },
      data: {
        status: newStatus,
        ...(newStatus === "PAID" ? { paidAt: new Date() } : {}),
      },
      select: { groupCompanyId: true, title: true, netPaymentAmount: true },
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

  // パートナー（該当グループ会社所属ユーザー）へOS内お知らせ
  if (statement) {
    try {
      const partnerUsers = await db.user.findMany({
        where: { groupCompanyId: statement.groupCompanyId },
        select: { id: true },
      });
      const net = Number(statement.netPaymentAmount).toLocaleString("ja-JP");
      const payload =
        newStatus === "CONFIRMED"
          ? {
              title: "支払明細が発行されました",
              message: `「${statement.title}」の支払明細を確認できます。`,
            }
          : {
              title: "お支払いが完了しました",
              message: `「${statement.title}」（差引支払額 ¥${net}）を支払済みにしました。`,
            };
      await Promise.all(
        partnerUsers.map((u) =>
          createInAppNotification({
            userId: u.id,
            type: "SYSTEM",
            title: payload.title,
            message: payload.message,
            linkUrl: "/dashboard/payments",
          })
        )
      );
    } catch (e) {
      // 通知失敗はステータス変更の成功を妨げない
      console.error("[updatePaymentStatementStatus] notify error:", e instanceof Error ? e.message : e);
    }
  }

  revalidatePath("/dashboard/admin/payments");
  revalidatePath(`/dashboard/admin/payments/${id}`);
  revalidatePath("/dashboard/payments");
  return {};
}

// ---------------------------------------------------------------
// ADMIN: 下書きの削除（DRAFT のみ。確定/支払済みは削除不可）
// ---------------------------------------------------------------
export async function deletePaymentStatement(id: string): Promise<{ error?: string }> {
  const info = await getSessionInfo();
  if (!info || info.role !== "ADMIN") return { error: "権限がありません" };

  const existing = await db.paymentStatement.findUnique({
    where: { id },
    select: { status: true, title: true },
  });
  if (!existing) return { error: "明細が見つかりません" };
  if (existing.status !== "DRAFT") {
    return { error: "確定・支払済みの明細は削除できません（先に下書きへ戻すか、そのまま保管してください）" };
  }

  try {
    // items は onDelete: Cascade で同時削除される
    await db.paymentStatement.delete({ where: { id } });
    logAudit({
      action: "payment_statement_deleted",
      email: info.email,
      name: info.staffName,
      entity: "payment_statement",
      entityId: id,
      detail: `下書き削除: ${existing.title}`,
    });
  } catch (e) {
    console.error("[deletePaymentStatement] DB error:", e instanceof Error ? e.message : e);
    return { error: "削除に失敗しました" };
  }

  revalidatePath("/dashboard/admin/payments");
  redirect("/dashboard/admin/payments");
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
