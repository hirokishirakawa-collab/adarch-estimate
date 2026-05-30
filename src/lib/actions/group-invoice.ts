"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { getSessionInfo } from "@/lib/session";
import { logAudit } from "@/lib/audit";
import { createInAppNotification, notifyAdmins } from "@/lib/notifications";
import {
  evaluateMonthlyRoyalty,
  invoiceTotals,
  monthKeyOf,
  MIN_ROYALTY_EXCL_TAX,
} from "@/lib/royalty-monthly";

// 請求書番号 採番: AA-YYYY-NNNN（年内連番）
async function nextInvoiceNo(year: number): Promise<string> {
  const prefix = `AA-${year}-`;
  const count = await db.groupInvoice.count({ where: { invoiceNo: { startsWith: prefix } } });
  return `${prefix}${String(count + 1).padStart(4, "0")}`;
}

// ---------------------------------------------------------------
// 一覧（ADMIN: 全件 / パートナー: 自社の発行済・入金済のみ）
// ---------------------------------------------------------------
export async function getGroupInvoices() {
  const info = await getSessionInfo();
  if (!info) return [];

  if (info.role !== "ADMIN") {
    const user = await db.user.findUnique({
      where: { email: info.email },
      select: { groupCompanyId: true },
    });
    if (!user?.groupCompanyId) return [];
    return db.groupInvoice.findMany({
      where: { groupCompanyId: user.groupCompanyId, status: { in: ["ISSUED", "PAID"] } },
      orderBy: { createdAt: "desc" },
      include: { groupCompany: { select: { name: true, ownerName: true } } },
    });
  }

  return db.groupInvoice.findMany({
    orderBy: { createdAt: "desc" },
    include: { groupCompany: { select: { name: true, ownerName: true } } },
    take: 500,
  });
}

// ---------------------------------------------------------------
// 単件取得
// ---------------------------------------------------------------
export async function getGroupInvoiceById(id: string) {
  const info = await getSessionInfo();
  if (!info) return null;

  const invoice = await db.groupInvoice.findUnique({
    where: { id },
    include: {
      groupCompany: { select: { id: true, name: true, ownerName: true, invoiceNumber: true, invoiceRegistered: true } },
      createdBy: { select: { name: true } },
      items: { orderBy: { sortOrder: "asc" } },
    },
  });
  if (!invoice) return null;

  if (info.role !== "ADMIN") {
    const user = await db.user.findUnique({
      where: { email: info.email },
      select: { groupCompanyId: true },
    });
    if (user?.groupCompanyId !== invoice.groupCompanyId) return null;
    if (invoice.status === "DRAFT") return null;
  }

  return invoice;
}

// ---------------------------------------------------------------
// パートナー選択肢（ADMIN）
// ---------------------------------------------------------------
export async function getPartnersForInvoiceSelect() {
  const info = await getSessionInfo();
  if (!info || info.role !== "ADMIN") return [];
  return db.groupCompany.findMany({
    where: { isActive: true },
    select: { id: true, name: true, ownerName: true, invoiceRegistered: true },
    orderBy: { name: "asc" },
  });
}

// ---------------------------------------------------------------
// 作成（ADMIN）
// ---------------------------------------------------------------
type ItemInput = { name: string; detail: string | null; quantity: number; unitPrice: number; amount: number };

export async function createGroupInvoice(
  _prev: { error?: string } | null,
  formData: FormData,
): Promise<{ error?: string }> {
  const info = await getSessionInfo();
  if (!info || info.role !== "ADMIN") return { error: "権限がありません" };

  const groupCompanyId = (formData.get("groupCompanyId") as string)?.trim();
  const type = ((formData.get("type") as string)?.trim() || "ROYALTY") as "ROYALTY" | "MEMBERSHIP" | "OTHER";
  const title = (formData.get("title") as string)?.trim();
  const targetMonth = (formData.get("targetMonth") as string)?.trim() || null;
  const dueDateRaw = (formData.get("dueDate") as string)?.trim() || "";
  const description = (formData.get("description") as string)?.trim() || null;
  const itemsRaw = (formData.get("items") as string)?.trim() || "";

  if (!groupCompanyId) return { error: "請求先パートナーを選択してください" };
  if (!title) return { error: "件名を入力してください" };

  // 明細行（クライアント送信値は信用せず、金額はサーバーで再計算）
  let items: ItemInput[] = [];
  if (itemsRaw) {
    try {
      const parsed = JSON.parse(itemsRaw) as Array<{ name?: string; detail?: string; quantity?: number | string; unitPrice?: number | string }>;
      items = parsed
        .map((r) => {
          const quantity = parseFloat(String(r.quantity ?? "1").replace(/,/g, "")) || 0;
          const unitPrice = parseInt(String(r.unitPrice ?? "0").replace(/,/g, ""), 10) || 0;
          return {
            name: String(r.name ?? "").trim(),
            detail: (String(r.detail ?? "").trim()) || null,
            quantity,
            unitPrice,
            amount: Math.round(quantity * unitPrice),
          };
        })
        .filter((r) => r.name && r.amount > 0);
    } catch {
      return { error: "明細の形式が不正です" };
    }
  }
  if (items.length === 0) return { error: "明細を1件以上入力してください（金額が0より大きいこと）" };

  const subtotalExclTax = items.reduce((sum, r) => sum + r.amount, 0);
  const totals = invoiceTotals(subtotalExclTax);

  const partner = await db.groupCompany.findUnique({ where: { id: groupCompanyId }, select: { id: true } });
  if (!partner) return { error: "請求先パートナーが見つかりません" };

  let createdId = "";
  const year = new Date().getFullYear();
  // 採番の衝突に備えて数回リトライ
  for (let attempt = 0; attempt < 5; attempt++) {
    try {
      const created = await db.groupInvoice.create({
        data: {
          groupCompanyId,
          invoiceNo: await nextInvoiceNo(year),
          type,
          title,
          targetMonth,
          description,
          subtotalExclTax: totals.subtotalExclTax,
          taxAmount: totals.taxAmount,
          totalInclTax: totals.totalInclTax,
          dueDate: dueDateRaw ? new Date(dueDateRaw) : null,
          createdById: info.userId,
          items: {
            create: items.map((r, i) => ({
              name: r.name,
              detail: r.detail,
              quantity: r.quantity,
              unitPrice: r.unitPrice,
              amount: r.amount,
              sortOrder: i,
            })),
          },
        },
      });
      createdId = created.id;
      break;
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      if (msg.includes("Unique constraint") && attempt < 4) continue; // 採番衝突→リトライ
      console.error("[createGroupInvoice] DB error:", msg);
      return { error: "保存に失敗しました" };
    }
  }
  if (!createdId) return { error: "請求書番号の採番に失敗しました。もう一度お試しください" };

  logAudit({
    action: "group_invoice_created",
    email: info.email,
    name: info.staffName,
    entity: "group_invoice",
    entityId: createdId,
    detail: `${title} / 請求額(税込): ¥${totals.totalInclTax.toLocaleString()}`,
  });

  revalidatePath("/dashboard/admin/group-invoices");
  redirect(`/dashboard/admin/group-invoices/${createdId}`);
}

// ---------------------------------------------------------------
// ステータス変更（発行 / 入金済み）
// ---------------------------------------------------------------
export async function updateGroupInvoiceStatus(
  id: string,
  newStatus: "ISSUED" | "PAID",
): Promise<{ error?: string }> {
  const info = await getSessionInfo();
  if (!info || info.role !== "ADMIN") return { error: "権限がありません" };

  let invoice: { groupCompanyId: string; title: string; totalInclTax: unknown; groupCompany: { name: string } } | null = null;
  try {
    invoice = await db.groupInvoice.update({
      where: { id },
      data: { status: newStatus, ...(newStatus === "PAID" ? { paidAt: new Date() } : {}) },
      select: {
        groupCompanyId: true,
        title: true,
        totalInclTax: true,
        groupCompany: { select: { name: true } },
      },
    });
    logAudit({
      action: `group_invoice_${newStatus.toLowerCase()}`,
      email: info.email,
      name: info.staffName,
      entity: "group_invoice",
      entityId: id,
      detail: `ステータス変更: ${newStatus}`,
    });
  } catch (e) {
    console.error("[updateGroupInvoiceStatus] DB error:", e instanceof Error ? e.message : e);
    return { error: "更新に失敗しました" };
  }

  if (invoice) {
    try {
      const total = Number(invoice.totalInclTax).toLocaleString("ja-JP");
      if (newStatus === "ISSUED") {
        const partnerUsers = await db.user.findMany({
          where: { groupCompanyId: invoice.groupCompanyId },
          select: { id: true },
        });
        await Promise.all(
          partnerUsers.map((u) =>
            createInAppNotification({
              userId: u.id,
              type: "SYSTEM",
              title: "請求書が発行されました",
              message: `「${invoice!.title}」（ご請求額 ¥${total}）を確認できます。`,
              linkUrl: "/dashboard/royalty",
            }),
          ),
        );
      }
      await notifyAdmins({
        type: "SYSTEM",
        title: newStatus === "ISSUED" ? "請求書を発行しました" : "請求書を入金済みにしました",
        message: `${invoice.groupCompany?.name ?? ""}：「${invoice.title}」（¥${total}）を${newStatus === "ISSUED" ? "発行" : "入金済みに"}しました。`,
        linkUrl: `/dashboard/admin/group-invoices/${id}`,
      });
    } catch (e) {
      console.error("[updateGroupInvoiceStatus] notify error:", e instanceof Error ? e.message : e);
    }
  }

  revalidatePath("/dashboard/admin/group-invoices");
  revalidatePath(`/dashboard/admin/group-invoices/${id}`);
  revalidatePath("/dashboard/royalty");
  return {};
}

// ---------------------------------------------------------------
// 削除（DRAFT のみ）— 単件・一括
// ---------------------------------------------------------------
export async function deleteGroupInvoice(id: string): Promise<{ error?: string }> {
  const info = await getSessionInfo();
  if (!info || info.role !== "ADMIN") return { error: "権限がありません" };

  const existing = await db.groupInvoice.findUnique({ where: { id }, select: { status: true, title: true } });
  if (!existing) return { error: "請求書が見つかりません" };
  if (existing.status !== "DRAFT") return { error: "発行済・入金済の請求書は削除できません" };

  try {
    await db.groupInvoice.delete({ where: { id } });
    logAudit({
      action: "group_invoice_deleted",
      email: info.email,
      name: info.staffName,
      entity: "group_invoice",
      entityId: id,
      detail: `下書き削除: ${existing.title}`,
    });
  } catch (e) {
    console.error("[deleteGroupInvoice] DB error:", e instanceof Error ? e.message : e);
    return { error: "削除に失敗しました" };
  }

  revalidatePath("/dashboard/admin/group-invoices");
  redirect("/dashboard/admin/group-invoices");
}

export async function bulkDeleteGroupInvoices(ids: string[]): Promise<{ error?: string; deleted?: number }> {
  const info = await getSessionInfo();
  if (!info || info.role !== "ADMIN") return { error: "権限がありません" };
  if (!ids?.length) return { deleted: 0 };

  try {
    // DRAFT のみ削除（発行済・入金済は保護）
    const result = await db.groupInvoice.deleteMany({ where: { id: { in: ids }, status: "DRAFT" } });
    logAudit({
      action: "group_invoice_bulk_deleted",
      email: info.email,
      name: info.staffName,
      entity: "group_invoice",
      entityId: ids.join(","),
      detail: `下書き一括削除: ${result.count}件`,
    });
    revalidatePath("/dashboard/admin/group-invoices");
    return { deleted: result.count };
  } catch (e) {
    console.error("[bulkDeleteGroupInvoices] DB error:", e instanceof Error ? e.message : e);
    return { error: "一括削除に失敗しました" };
  }
}

// ---------------------------------------------------------------
// 月次ロイヤリティ状況（ADMIN: 全パートナー / パートナー: 自社）
//   当月の案件由来 本部手数料(10%) 合計を集計し、最低保証 5万 と比較。
// ---------------------------------------------------------------
export type RoyaltyOverviewRow = {
  groupCompanyId: string;
  name: string;
  ownerName: string;
  units: number;                  // 加盟拠点数
  minRoyaltyExclTax: number;      // 最低ロイヤリティ（税抜）= 5万 × 拠点数
  commissionTotalExclTax: number; // 当月の手数料(10%)合計（税抜）
  shortfallExclTax: number;       // 請求差額（税抜）
  isCovered: boolean;             // 相殺済み（貢献感謝）
  invoice: { id: string; invoiceNo: string; status: string; totalInclTax: number } | null;
};

export async function getMonthlyRoyaltyOverview(month: string): Promise<RoyaltyOverviewRow[]> {
  const info = await getSessionInfo();
  if (!info) return [];

  // パートナーは自社のみ
  let limitToGroupCompanyId: string | null = null;
  if (info.role !== "ADMIN") {
    const user = await db.user.findUnique({ where: { email: info.email }, select: { groupCompanyId: true } });
    if (!user?.groupCompanyId) return [];
    limitToGroupCompanyId = user.groupCompanyId;
  }

  const partners = await db.groupCompany.findMany({
    where: { isActive: true, ...(limitToGroupCompanyId ? { id: limitToGroupCompanyId } : {}) },
    select: { id: true, name: true, ownerName: true, membershipCount: true },
    orderBy: { name: "asc" },
  });

  // 確定/支払済みの支払明細（手数料原資）。基準日は入金日優先、なければ作成日。
  const statements = await db.paymentStatement.findMany({
    where: {
      status: { in: ["CONFIRMED", "PAID"] },
      ...(limitToGroupCompanyId ? { groupCompanyId: limitToGroupCompanyId } : {}),
    },
    select: { groupCompanyId: true, commissionAmount: true, paidAt: true, createdAt: true },
  });

  // パートナー×月で手数料を集計
  const commissionByPartner = new Map<string, number>();
  for (const s of statements) {
    if (monthKeyOf(s.paidAt ?? s.createdAt) !== month) continue;
    const prev = commissionByPartner.get(s.groupCompanyId) ?? 0;
    commissionByPartner.set(s.groupCompanyId, prev + Math.max(0, Math.round(Number(s.commissionAmount) || 0)));
  }

  // 既存のロイヤリティ請求書（当月分）
  const invoices = await db.groupInvoice.findMany({
    where: { type: "ROYALTY", targetMonth: month, ...(limitToGroupCompanyId ? { groupCompanyId: limitToGroupCompanyId } : {}) },
    select: { id: true, groupCompanyId: true, invoiceNo: true, status: true, totalInclTax: true },
  });
  const invoiceByPartner = new Map(invoices.map((i) => [i.groupCompanyId, i]));

  return partners.map((p) => {
    const commission = commissionByPartner.get(p.id) ?? 0;
    const evald = evaluateMonthlyRoyalty(commission, p.membershipCount);
    const inv = invoiceByPartner.get(p.id);
    return {
      groupCompanyId: p.id,
      name: p.name,
      ownerName: p.ownerName,
      units: evald.units,
      minRoyaltyExclTax: evald.minRoyaltyExclTax,
      commissionTotalExclTax: commission,
      shortfallExclTax: evald.shortfallExclTax,
      isCovered: evald.isCovered,
      invoice: inv
        ? { id: inv.id, invoiceNo: inv.invoiceNo, status: inv.status, totalInclTax: Number(inv.totalInclTax) }
        : null,
    };
  });
}

// 月次ロイヤリティの差額から請求書を即作成（ADMIN・相殺済みは作成不可）
export async function createRoyaltyInvoiceForMonth(
  groupCompanyId: string,
  month: string,
): Promise<{ error?: string; id?: string }> {
  const info = await getSessionInfo();
  if (!info || info.role !== "ADMIN") return { error: "権限がありません" };

  const rows = await getMonthlyRoyaltyOverview(month);
  const row = rows.find((r) => r.groupCompanyId === groupCompanyId);
  if (!row) return { error: "対象パートナーが見つかりません" };
  if (row.invoice) return { error: "当月の請求書は既に存在します", id: row.invoice.id };
  if (row.isCovered || row.shortfallExclTax <= 0) {
    return { error: "相殺済み（最低保証クリア）のため請求書は不要です" };
  }

  const totals = invoiceTotals(row.shortfallExclTax);
  const [y, m] = month.split("-");
  const unitsSuffix = row.units > 1 ? `（${row.units}拠点）` : "";
  const title = `${y}年${parseInt(m, 10)}月分 ロイヤリティ${unitsSuffix}`;

  let createdId = "";
  const year = new Date().getFullYear();
  for (let attempt = 0; attempt < 5; attempt++) {
    try {
      const created = await db.groupInvoice.create({
        data: {
          groupCompanyId,
          invoiceNo: await nextInvoiceNo(year),
          type: "ROYALTY",
          title,
          targetMonth: month,
          description: `最低保証ロイヤリティ ¥${row.minRoyaltyExclTax.toLocaleString()}（税抜${row.units > 1 ? `・${row.units}拠点 × ¥${MIN_ROYALTY_EXCL_TAX.toLocaleString()}` : ""}）と当月の案件由来手数料 ¥${row.commissionTotalExclTax.toLocaleString()}（税抜）の差額です。`,
          subtotalExclTax: totals.subtotalExclTax,
          taxAmount: totals.taxAmount,
          totalInclTax: totals.totalInclTax,
          createdById: info.userId,
          items: {
            create: [{
              name: `月額ロイヤリティ（最低保証差額・${y}年${parseInt(m, 10)}月分${unitsSuffix}）`,
              detail: `最低保証 ¥${row.minRoyaltyExclTax.toLocaleString()} − 案件手数料 ¥${row.commissionTotalExclTax.toLocaleString()}`,
              quantity: 1,
              unitPrice: totals.subtotalExclTax,
              amount: totals.subtotalExclTax,
              sortOrder: 0,
            }],
          },
        },
      });
      createdId = created.id;
      break;
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      if (msg.includes("Unique constraint") && attempt < 4) continue;
      console.error("[createRoyaltyInvoiceForMonth] DB error:", msg);
      return { error: "保存に失敗しました" };
    }
  }
  if (!createdId) return { error: "採番に失敗しました。もう一度お試しください" };

  logAudit({
    action: "group_invoice_royalty_created",
    email: info.email,
    name: info.staffName,
    entity: "group_invoice",
    entityId: createdId,
    detail: `${title} / 差額(税込): ¥${totals.totalInclTax.toLocaleString()}`,
  });

  revalidatePath("/dashboard/admin/group-invoices");
  revalidatePath("/dashboard/admin/royalty");
  return { id: createdId };
}
