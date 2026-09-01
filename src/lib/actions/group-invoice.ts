"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { getSessionInfo } from "@/lib/session";
import { logAudit } from "@/lib/audit";
import { createInAppNotification, notifyAdmins } from "@/lib/notifications";
import { sendGroupInvoiceEmailById } from "@/lib/group-invoice-email";
import { fetchReportedRevenue } from "@/lib/royalty-revenue";
import {
  commissionOf,
  evaluatePartnerRoyalty,
  HQ_COMMISSION_RATE,
  invoiceTotals,
  MIN_ROYALTY_EXCL_TAX,
  resolveEffectiveCommission,
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
      // 取消済みも見せる。発行時にPDFがメール送付されているため、黙って消えると却って分かりにくい。
      where: { groupCompanyId: user.groupCompanyId, status: { in: ["ISSUED", "PAID", "CANCELLED"] } },
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

  // 発行時はパートナーへ請求書PDFを自動メール送付（失敗してもステータス変更は成功扱い）
  if (newStatus === "ISSUED") {
    try {
      const res = await sendGroupInvoiceEmailById(id);
      if (!res.ok) console.error("[updateGroupInvoiceStatus] invoice email skipped:", res.error);
    } catch (e) {
      console.error("[updateGroupInvoiceStatus] invoice email error:", e instanceof Error ? e.message : e);
    }
  }

  revalidatePath("/dashboard/admin/group-invoices");
  revalidatePath(`/dashboard/admin/group-invoices/${id}`);
  revalidatePath("/dashboard/royalty");
  return {};
}

// ---------------------------------------------------------------
// 請求書をパートナーへメール送付（ADMIN・手動再送）
// ---------------------------------------------------------------
export async function emailGroupInvoice(id: string): Promise<{ error?: string; sentTo?: string[] }> {
  const info = await getSessionInfo();
  if (!info || info.role !== "ADMIN") return { error: "権限がありません" };

  try {
    const res = await sendGroupInvoiceEmailById(id);
    if (!res.ok) return { error: res.error };
    logAudit({
      action: "group_invoice_emailed",
      email: info.email,
      name: info.staffName,
      entity: "group_invoice",
      entityId: id,
      detail: `請求書メール送付: ${res.sentTo?.join(", ")}`,
    });
    return { sentTo: res.sentTo };
  } catch (e) {
    console.error("[emailGroupInvoice] error:", e instanceof Error ? e.message : e);
    return { error: "メール送信に失敗しました" };
  }
}

// ---------------------------------------------------------------
// 取消（誤発行の取り消し・ISSUED / PAID のみ）
//
// 発行済・入金済は削除できない（発行した記録を残す必要があるため）。
// 誤って発行した請求書はこのアクションで取り消し、理由と日時を残す。
// 取り消した月は請求書なし扱いに戻るので、正しい内容で再発行できる。
// ---------------------------------------------------------------
export async function cancelGroupInvoice(id: string, reason: string): Promise<{ error?: string }> {
  const info = await getSessionInfo();
  if (!info || info.role !== "ADMIN") return { error: "権限がありません" };

  const trimmedReason = (reason ?? "").trim();
  if (!trimmedReason) return { error: "取消理由を入力してください" };

  const existing = await db.groupInvoice.findUnique({
    where: { id },
    select: {
      status: true,
      title: true,
      invoiceNo: true,
      totalInclTax: true,
      groupCompanyId: true,
      targetMonth: true,
      groupCompany: { select: { name: true } },
    },
  });
  if (!existing) return { error: "請求書が見つかりません" };
  if (existing.status === "CANCELLED") return { error: "すでに取消済みです" };
  if (existing.status === "DRAFT") return { error: "下書きは取消ではなく削除してください" };

  try {
    await db.groupInvoice.update({
      where: { id },
      data: { status: "CANCELLED", cancelledAt: new Date(), cancelReason: trimmedReason },
    });
    logAudit({
      action: "group_invoice_cancelled",
      email: info.email,
      name: info.staffName,
      entity: "group_invoice",
      entityId: id,
      detail: `${existing.invoiceNo} ${existing.title}（¥${Number(existing.totalInclTax).toLocaleString("ja-JP")}）を取消 / 理由: ${trimmedReason}`,
    });
  } catch (e) {
    console.error("[cancelGroupInvoice] DB error:", e instanceof Error ? e.message : e);
    return { error: "取消に失敗しました" };
  }

  // 発行済みの請求書はパートナーへメール送付済みのため、取消も必ず知らせる。
  try {
    const total = Number(existing.totalInclTax).toLocaleString("ja-JP");
    const partnerUsers = await db.user.findMany({
      where: { groupCompanyId: existing.groupCompanyId },
      select: { id: true },
    });
    await Promise.all(
      partnerUsers.map((u) =>
        createInAppNotification({
          userId: u.id,
          type: "SYSTEM",
          title: "請求書を取り消しました",
          message: `「${existing.title}」（¥${total}）は取り消しとなりました。お支払いは不要です。`,
          linkUrl: "/dashboard/royalty",
        }),
      ),
    );
    await notifyAdmins({
      type: "SYSTEM",
      title: "請求書を取り消しました",
      message: `${existing.groupCompany?.name ?? ""}：${existing.invoiceNo}「${existing.title}」（¥${total}）を取消。理由: ${trimmedReason}`,
      linkUrl: `/dashboard/admin/group-invoices/${id}`,
    });
  } catch (e) {
    console.error("[cancelGroupInvoice] notify error:", e instanceof Error ? e.message : e);
  }

  revalidatePath("/dashboard/admin/group-invoices");
  revalidatePath(`/dashboard/admin/group-invoices/${id}`);
  revalidatePath("/dashboard/admin/royalty");
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
  if (existing.status !== "DRAFT") return { error: "発行済・入金済の請求書は削除できません。誤発行の場合は「取消」をお使いください" };

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
  units: number;                  // 拠点数
  minRoyaltyExclTax: number;      // 最低ロイヤリティ合計（税抜）= 5万 × 拠点数
  revenueExclTax: number;         // 月次報告の売上（税抜・自社請求＋本部請求）
  selfRevenueExclTax: number;     // うち自社請求（税抜）＝ロイヤリティ請求書に載る側
  hqRevenueExclTax: number;       // うち本部請求（税抜）＝クライアント入金時に控除済みの側
  royaltyExclTax: number;         // ロイヤリティ = max(最低保証, 売上×10%, 手数料)（税抜）
  commissionTotalExclTax: number; // 当月の手数料(10%)合計（税抜）＝相殺
  shortfallExclTax: number;       // 請求差額（税抜・県別不足の合計）
  isCovered: boolean;             // 全県クリア（貢献感謝）
  isExempt: boolean;              // ロイヤリティ免除（恒久 or 当月）
  isExemptPermanent: boolean;     // 恒久免除（経理管理設定）
  isMonthExempt: boolean;         // 当月のみ免除（ワンボタン）
  branches: { label: string; revenueExclTax: number; royaltyExclTax: number; commissionExclTax: number; shortfallExclTax: number; isCovered: boolean }[]; // 県別内訳（単一拠点は空）
  untaggedCommissionExclTax: number; // 県未指定の手数料（要再割当）
  branchLabels: string[];         // 県名（手入力UI用。単一拠点は空）
  manualOverrides: Record<string, number>; // 手入力の相殺額（key=県名 or "" 単一）
  invoice: { id: string; invoiceNo: string; status: string; totalInclTax: number } | null;
  paymentLink: { url: string; amountInclTax: number } | null; // Square決済リンク（社×月）
  mfBilling: { mfBillingId: string; billingNumber: string | null; pdfUrl: string | null; totalInclTax: number; paymentStatus: number | null } | null; // MF請求書（社×月）
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
    select: { id: true, name: true, ownerName: true, branchLabels: true, royaltyMinExclTax: true, royaltyExempt: true },
    orderBy: { name: "asc" },
  });

  // 相殺の自動集計＝請求申請（提出済み）に保存された本部手数料。基準は請求日（billingDate）。
  // commissionExclTax が null の行はフィールド追加前の既存データ＝税抜金額×既定率にフォールバック。
  const [yy, mm] = month.split("-").map(Number);
  const monthStart = new Date(yy, mm - 1, 1);
  const monthEnd = new Date(yy, mm, 1);
  const requests = await db.invoiceRequest.findMany({
    where: {
      status: { not: "DRAFT" },
      billingDate: { gte: monthStart, lt: monthEnd },
      ...(limitToGroupCompanyId ? { createdBy: { groupCompanyId: limitToGroupCompanyId } } : {}),
    },
    select: {
      kind: true,
      amountExclTax: true,
      commissionRate: true,
      commissionExclTax: true,
      branchLabel: true,
      createdBy: { select: { groupCompanyId: true } },
    },
  });

  const totalByPartner = new Map<string, number>();
  const byPartnerLabel = new Map<string, Record<string, number>>();
  for (const r of requests) {
    const gc = r.createdBy?.groupCompanyId;
    if (!gc) continue;
    // 媒体請求は本部が許可時に打ち込んだ額だけを見る。
    // 率での自動計算（フォールバック）は通さない＝入っていなければ0。
    const commission =
      r.commissionExclTax != null
        ? Math.max(0, Number(r.commissionExclTax))
        : r.kind === "MEDIA"
          ? 0
          : commissionOf(Number(r.amountExclTax), Number(r.commissionRate));
    totalByPartner.set(gc, (totalByPartner.get(gc) ?? 0) + commission);
    if (r.branchLabel) {
      const m = byPartnerLabel.get(gc) ?? {};
      m[r.branchLabel] = (m[r.branchLabel] ?? 0) + commission;
      byPartnerLabel.set(gc, m);
    }
  }

  // 月次報告の売上（税抜）＝売上連動10%の基礎
  const revenueMap = await fetchReportedRevenue({
    from: monthStart,
    to: monthEnd,
    groupCompanyId: limitToGroupCompanyId,
    branchLabelsByCompany: new Map(partners.map((p) => [p.id, (p.branchLabels ?? []).filter(Boolean)])),
  });

  // 既存のロイヤリティ請求書（当月分）。
  // 取消済みは「請求書なし」として扱い、正しい内容で再発行できるようにする。
  const invoices = await db.groupInvoice.findMany({
    where: {
      type: "ROYALTY",
      targetMonth: month,
      status: { not: "CANCELLED" },
      ...(limitToGroupCompanyId ? { groupCompanyId: limitToGroupCompanyId } : {}),
    },
    select: { id: true, groupCompanyId: true, invoiceNo: true, status: true, totalInclTax: true },
  });
  const invoiceByPartner = new Map(invoices.map((i) => [i.groupCompanyId, i]));

  // Square決済リンク（当月分）
  const links = await db.royaltyPaymentLink.findMany({
    where: { month, ...(limitToGroupCompanyId ? { groupCompanyId: limitToGroupCompanyId } : {}) },
    select: { groupCompanyId: true, url: true, amountInclTax: true },
  });
  const linkByPartner = new Map(links.map((l) => [l.groupCompanyId, l]));

  // MF請求書（当月分）
  const mfBillings = await db.royaltyMfBilling.findMany({
    where: { month, ...(limitToGroupCompanyId ? { groupCompanyId: limitToGroupCompanyId } : {}) },
    select: { groupCompanyId: true, mfBillingId: true, billingNumber: true, pdfUrl: true, totalInclTax: true, paymentStatus: true },
  });
  const mfByPartner = new Map(mfBillings.map((b) => [b.groupCompanyId, b]));

  // 手入力の相殺調整（自動集計を上書き）
  const adjustments = await db.royaltyAdjustment.findMany({
    where: { month, ...(limitToGroupCompanyId ? { groupCompanyId: limitToGroupCompanyId } : {}) },
    select: { groupCompanyId: true, branchLabel: true, commissionExclTax: true, exempt: true },
  });
  const overrideByPartner = new Map<string, Record<string, number>>();
  const monthExemptByPartner = new Set<string>();
  for (const a of adjustments) {
    if (a.branchLabel === "" && a.exempt) monthExemptByPartner.add(a.groupCompanyId);
    const m = overrideByPartner.get(a.groupCompanyId) ?? {};
    m[a.branchLabel] = a.commissionExclTax;
    overrideByPartner.set(a.groupCompanyId, m);
  }

  return partners.map((p) => {
    const labels = (p.branchLabels ?? []).filter(Boolean);
    const autoByLabel = byPartnerLabel.get(p.id) ?? {};
    const autoTotal = totalByPartner.get(p.id) ?? 0;
    const ov = overrideByPartner.get(p.id) ?? {};

    // 手入力があればそれで上書き（無い県は自動集計）
    const { commissionByLabel, total } = resolveEffectiveCommission({
      branchLabels: labels,
      autoByLabel,
      autoTotal,
      overrides: ov,
    });

    const monthExempt = monthExemptByPartner.has(p.id);
    const rev = revenueMap.get(`${p.id}:${month}`);
    const evald = evaluatePartnerRoyalty({
      branchLabels: p.branchLabels,
      commissionByLabel,
      totalCommissionExclTax: total,
      revenueByLabel: rev?.byLabel,
      totalRevenueExclTax: rev?.total,
      minExclTax: p.royaltyMinExclTax ?? undefined,
      exempt: p.royaltyExempt || monthExempt,
    });
    const inv = invoiceByPartner.get(p.id);
    return {
      groupCompanyId: p.id,
      name: p.name,
      ownerName: p.ownerName,
      units: evald.units,
      minRoyaltyExclTax: evald.minRoyaltyExclTax,
      revenueExclTax: evald.revenueExclTax,
      selfRevenueExclTax: rev?.selfTotal ?? 0,
      hqRevenueExclTax: rev?.hqTotal ?? 0,
      royaltyExclTax: evald.royaltyExclTax,
      commissionTotalExclTax: evald.commissionTotalExclTax,
      shortfallExclTax: evald.shortfallExclTax,
      isCovered: evald.isCovered,
      isExempt: evald.isExempt,
      isExemptPermanent: p.royaltyExempt,
      isMonthExempt: monthExempt,
      branches: evald.branches.map((b) => ({ label: b.label, revenueExclTax: b.revenueExclTax, royaltyExclTax: b.royaltyExclTax, commissionExclTax: b.commissionExclTax, shortfallExclTax: b.shortfallExclTax, isCovered: b.isCovered })),
      untaggedCommissionExclTax: evald.untaggedCommissionExclTax,
      branchLabels: labels,
      manualOverrides: ov,
      invoice: inv
        ? { id: inv.id, invoiceNo: inv.invoiceNo, status: inv.status, totalInclTax: Number(inv.totalInclTax) }
        : null,
      paymentLink: (() => { const l = linkByPartner.get(p.id); return l ? { url: l.url, amountInclTax: l.amountInclTax } : null; })(),
      mfBilling: (() => { const b = mfByPartner.get(p.id); return b ? { mfBillingId: b.mfBillingId, billingNumber: b.billingNumber, pdfUrl: b.pdfUrl, totalInclTax: b.totalInclTax, paymentStatus: b.paymentStatus } : null; })(),
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
  if (row.isExempt) return { error: "この代表はロイヤリティ免除のため請求書は不要です" };
  if (row.isCovered || row.shortfallExclTax <= 0) {
    return { error: "相殺済み（最低保証クリア）のため請求書は不要です" };
  }

  const totals = invoiceTotals(row.shortfallExclTax);
  const [y, m] = month.split("-");
  const mLabel = parseInt(m, 10);
  const isMulti = row.branches.length > 0;
  const unitsSuffix = row.units > 1 ? `（${row.units}拠点）` : "";
  const title = `${y}年${mLabel}月分 ロイヤリティ${unitsSuffix}`;

  // 県別なら不足のある県ごとに明細行、単一拠点なら1行
  const shortBranches = row.branches.filter((b) => b.shortfallExclTax > 0);
  const itemsCreate = isMulti
    ? shortBranches.map((b, i) => ({
        name: `月額ロイヤリティ（${b.label}・${y}年${mLabel}月分）`,
        detail: `ロイヤリティ ¥${b.royaltyExclTax.toLocaleString()}（最低保証 ¥${row.minRoyaltyExclTax > 0 ? Math.round(row.minRoyaltyExclTax / row.units).toLocaleString() : MIN_ROYALTY_EXCL_TAX.toLocaleString()} と売上 ¥${b.revenueExclTax.toLocaleString()}×${HQ_COMMISSION_RATE}% の大きい方）− ${b.label}の本部請求分（クライアント入金時に控除済み）¥${b.commissionExclTax.toLocaleString()}`,
        quantity: 1,
        unitPrice: b.shortfallExclTax,
        amount: b.shortfallExclTax,
        sortOrder: i,
      }))
    : [{
        name: `月額ロイヤリティ（${y}年${mLabel}月分）`,
        detail: `ロイヤリティ ¥${row.royaltyExclTax.toLocaleString()}（最低保証 ¥${row.minRoyaltyExclTax.toLocaleString()} と売上 ¥${row.revenueExclTax.toLocaleString()}×${HQ_COMMISSION_RATE}% の大きい方）− 本部請求分（クライアント入金時に控除済み）¥${row.commissionTotalExclTax.toLocaleString()}`,
        quantity: 1,
        unitPrice: totals.subtotalExclTax,
        amount: totals.subtotalExclTax,
        sortOrder: 0,
      }];
  const description = isMulti
    ? `県ごとに ロイヤリティ＝max(最低保証, 月次報告の売上×${HQ_COMMISSION_RATE}%)（税抜）を独立判定し、本部が代理請求で控除済みの案件手数料を差し引いた不足分を合算しています。${shortBranches.map((b) => `${b.label}: ロイヤリティ¥${b.royaltyExclTax.toLocaleString()}−手数料¥${b.commissionExclTax.toLocaleString()}→差額¥${b.shortfallExclTax.toLocaleString()}`).join(" / ")}`
    : `当月ロイヤリティ ¥${row.royaltyExclTax.toLocaleString()}（税抜・最低保証 ¥${row.minRoyaltyExclTax.toLocaleString()} と月次報告の売上 ¥${row.revenueExclTax.toLocaleString()}×${HQ_COMMISSION_RATE}% の大きい方）から、本部請求分としてクライアント入金時に控除済みの ¥${row.commissionTotalExclTax.toLocaleString()}（税抜）を差し引いた額です。自社請求分の売上 ¥${row.selfRevenueExclTax.toLocaleString()}（税抜）に対するロイヤリティは本請求書でお支払いください。`;

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
          description,
          subtotalExclTax: totals.subtotalExclTax,
          taxAmount: totals.taxAmount,
          totalInclTax: totals.totalInclTax,
          createdById: info.userId,
          items: { create: itemsCreate },
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

// ---------------------------------------------------------------
// ロイヤリティ相殺の手入力調整（ADMIN）。
//   amount=null/空 → 削除（自動集計に戻す）。branchLabel="" は単一拠点。
// ---------------------------------------------------------------
export async function setRoyaltyAdjustment(
  groupCompanyId: string,
  month: string,
  branchLabel: string,
  amount: number | null,
): Promise<{ error?: string }> {
  const info = await getSessionInfo();
  if (!info || info.role !== "ADMIN") return { error: "権限がありません" };
  if (!/^\d{4}-\d{2}$/.test(month)) return { error: "対象月が不正です" };

  const label = (branchLabel ?? "").trim();
  try {
    if (amount == null || amount < 0) {
      // 免除フラグが立つ行は消さず金額のみ0に。それ以外は行ごと削除（自動集計へ戻す）。
      const existing = await db.royaltyAdjustment.findUnique({
        where: { groupCompanyId_month_branchLabel: { groupCompanyId, month, branchLabel: label } },
        select: { exempt: true },
      });
      if (existing?.exempt) {
        await db.royaltyAdjustment.update({
          where: { groupCompanyId_month_branchLabel: { groupCompanyId, month, branchLabel: label } },
          data: { commissionExclTax: 0 },
        });
      } else {
        await db.royaltyAdjustment.deleteMany({ where: { groupCompanyId, month, branchLabel: label } });
      }
    } else {
      const value = Math.round(amount);
      await db.royaltyAdjustment.upsert({
        where: { groupCompanyId_month_branchLabel: { groupCompanyId, month, branchLabel: label } },
        create: { groupCompanyId, month, branchLabel: label, commissionExclTax: value, createdById: info.userId },
        update: { commissionExclTax: value, createdById: info.userId },
      });
    }
    logAudit({
      action: "royalty_adjustment_set",
      email: info.email,
      name: info.staffName,
      entity: "royalty_adjustment",
      entityId: `${groupCompanyId}:${month}:${label || "(単一)"}`,
      detail: amount == null ? "相殺手入力を削除（自動集計へ）" : `相殺手入力 ¥${Math.round(amount).toLocaleString()}${label ? `（${label}）` : ""}`,
    });
  } catch (e) {
    console.error("[setRoyaltyAdjustment] DB error:", e instanceof Error ? e.message : e);
    return { error: "保存に失敗しました" };
  }

  revalidatePath("/dashboard/admin/royalty");
  return {};
}

// ---------------------------------------------------------------
// ロイヤリティ 当月免除のワンボタン（ADMIN）。事情免除をその月だけ反映。
// ---------------------------------------------------------------
export async function toggleRoyaltyMonthExempt(
  groupCompanyId: string,
  month: string,
  exempt: boolean,
): Promise<{ error?: string }> {
  const info = await getSessionInfo();
  if (!info || info.role !== "ADMIN") return { error: "権限がありません" };
  if (!/^\d{4}-\d{2}$/.test(month)) return { error: "対象月が不正です" };

  const key = { groupCompanyId_month_branchLabel: { groupCompanyId, month, branchLabel: "" } };
  try {
    if (exempt) {
      await db.royaltyAdjustment.upsert({
        where: key,
        create: { groupCompanyId, month, branchLabel: "", commissionExclTax: 0, exempt: true, createdById: info.userId },
        update: { exempt: true },
      });
    } else {
      const existing = await db.royaltyAdjustment.findUnique({ where: key, select: { commissionExclTax: true } });
      if (existing) {
        if (existing.commissionExclTax > 0) {
          await db.royaltyAdjustment.update({ where: key, data: { exempt: false } });
        } else {
          await db.royaltyAdjustment.deleteMany({ where: { groupCompanyId, month, branchLabel: "" } });
        }
      }
    }
    logAudit({
      action: "royalty_month_exempt",
      email: info.email,
      name: info.staffName,
      entity: "royalty_adjustment",
      entityId: `${groupCompanyId}:${month}`,
      detail: exempt ? `当月免除ON（${month}）` : `当月免除OFF（${month}）`,
    });
  } catch (e) {
    console.error("[toggleRoyaltyMonthExempt] DB error:", e instanceof Error ? e.message : e);
    return { error: "保存に失敗しました" };
  }

  revalidatePath("/dashboard/admin/royalty");
  return {};
}
