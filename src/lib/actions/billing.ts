"use server";

import { redirect, notFound } from "next/navigation";
import { revalidatePath } from "next/cache";
import { after } from "next/server";
import { db } from "@/lib/db";
import { getSessionInfo, getBranchFilter } from "@/lib/session";
import { sendInvoiceNotification } from "@/lib/notifications";
import { uploadBillingFile } from "@/lib/storage";
import type { UserRole } from "@/types/roles";
import type { Prisma } from "@/generated/prisma/client";
import { logAudit } from "@/lib/audit";
import { HQ_COMMISSION_RATE, commissionBaseOf, commissionOf } from "@/lib/royalty-monthly";
import type { InvoiceRequestKind } from "@/generated/prisma/client";

// ---------------------------------------------------------------
// 閲覧権限スコープ
// ADMIN: 全件 / その他: 自分が作成したもののみ
// ---------------------------------------------------------------
function buildWhereScope(
  role: UserRole,
  userId: string
): Prisma.InvoiceRequestWhereInput {
  if (role === "ADMIN") return {};
  // ADMIN 以外: 自分が作成したもの OR 自分のメールで作成したもの（両方検索）
  return { createdById: userId };
}

// ---------------------------------------------------------------
// フォームデータを解析 + バリデーション
// ---------------------------------------------------------------
async function parseFormData(formData: FormData): Promise<
  | {
      ok: true;
      data: {
        subject: string;
        kind: InvoiceRequestKind;
        medias: { name: string; costExclTax: number }[];
        branchLabel: string | null;
        customerId: string | null;
        contactName: string | null;
        contactEmail: string;
        billingDate: Date;
        dueDate: Date | null;
        details: string | null;
        amountExclTax: number;
        taxAmount: number;
        amountInclTax: number;
        commissionRate: number;
        commissionExclTax: number;
        mediaExpense: number | null;
        productionExpense: number | null;
        reimbursementExclTax: number | null;
        withholdingTaxAmount: number | null;
        nonDeductibleTaxAmount: number | null;
        netPaymentAmount: number | null;
        inspectionStatus: string | null;
        fileUrl: string | null;
        notes: string | null;
        projectId: string | null;
      };
    }
  | { ok: false; error: string }
> {
  // 媒体請求も手数料は発生するが、取引媒体によって条件が変わるため申請時点では決まらない。
  // 本部が許可する段階で打ち込むので、ここでは自動計算しない。
  // 想定外の値が来たら通常請求として扱う（手数料を取り損ねる側に倒さない）。
  const kind: InvoiceRequestKind =
    (formData.get("kind") as string)?.trim() === "MEDIA" ? "MEDIA" : "NORMAL";
  // 媒体の内訳。1件の請求で複数媒体を回すことがあるため行で受ける。
  // フォームからは JSON 文字列1つで届く（行数が可変のため）。通常請求では持たない。
  const medias: { name: string; costExclTax: number }[] = [];
  if (kind === "MEDIA") {
    const raw = (formData.get("medias") as string)?.trim();
    if (raw) {
      try {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) {
          for (const row of parsed) {
            const name = String(row?.name ?? "").trim();
            if (!name) continue;
            const cost = Math.max(0, Math.round(Number(row?.costExclTax) || 0));
            medias.push({ name: name.slice(0, 100), costExclTax: cost });
          }
        }
      } catch {
        return { ok: false, error: "媒体の内訳を読み取れませんでした" };
      }
    }
  }

  const subject        = (formData.get("subject")           as string)?.trim();
  const branchLabel    = (formData.get("branchLabel")        as string)?.trim() || null;
  const customerId     = (formData.get("customerId")         as string)?.trim() || null;
  const contactName    = (formData.get("contactName")        as string)?.trim() || null;
  const contactEmail   = (formData.get("contactEmail")       as string)?.trim() || "";
  const billingDateRaw = (formData.get("billingDate")        as string)?.trim();
  const dueDateRaw     = (formData.get("dueDate")            as string)?.trim() || null;
  const details        = (formData.get("details")            as string)?.trim() || null;
  const amountRaw      = (formData.get("amountExclTax")      as string)?.replace(/,/g, "").trim();
  const inspectionStatus = (formData.get("inspectionStatus") as string)?.trim() || null;
  const notes          = (formData.get("notes")              as string)?.trim() || null;
  const projectId      = (formData.get("projectId")          as string)?.trim() || null;
  const fileUrlInput   = (formData.get("fileUrl")            as string)?.trim() || null;
  const file           = formData.get("file") as File | null;

  if (!subject)       return { ok: false, error: "件名を入力してください" };
  if (kind === "MEDIA" && medias.length === 0)
    return { ok: false, error: "媒体請求では媒体を1つ以上入力してください" };
  if (!contactEmail)  return { ok: false, error: "メールアドレスを入力してください" };
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(contactEmail))
    return { ok: false, error: "メールアドレスの形式が正しくありません" };
  if (!billingDateRaw) return { ok: false, error: "請求日を入力してください" };

  const billingDate = new Date(billingDateRaw);
  if (isNaN(billingDate.getTime())) return { ok: false, error: "請求日の形式が正しくありません" };

  const dueDate = dueDateRaw ? new Date(dueDateRaw) : null;
  if (dueDate && isNaN(dueDate.getTime())) return { ok: false, error: "支払期限の形式が正しくありません" };

  const amountExclTax = amountRaw ? parseInt(amountRaw, 10) : NaN;
  if (!amountRaw || isNaN(amountExclTax) || amountExclTax < 0)
    return { ok: false, error: "税抜金額は0以上の整数で入力してください" };

  const taxAmount     = Math.round(amountExclTax * 0.1);
  const amountInclTax = amountExclTax + taxAmount;

  // ── 媒体費 / 制作費 内訳
  const mediaExpenseRaw      = (formData.get("mediaExpense")      as string)?.replace(/,/g, "").trim() || null;
  const productionExpenseRaw = (formData.get("productionExpense") as string)?.replace(/,/g, "").trim() || null;
  const mediaExpense      = mediaExpenseRaw ? parseInt(mediaExpenseRaw, 10) : null;
  const productionExpense = productionExpenseRaw ? parseInt(productionExpenseRaw, 10) : null;

  // ── 立替実費（税抜・本部手数料の対象外）。税抜金額を上限にクランプする。
  const reimbursementRaw = (formData.get("reimbursementExclTax") as string)?.replace(/,/g, "").trim() || null;
  const reimbursementInput = reimbursementRaw ? parseInt(reimbursementRaw, 10) : NaN;
  if (reimbursementRaw && (isNaN(reimbursementInput) || reimbursementInput < 0))
    return { ok: false, error: "立替実費は0以上の整数で入力してください" };
  const reimbursementExclTax = reimbursementRaw
    ? Math.min(Math.max(0, reimbursementInput), amountExclTax)
    : null;

  // ── 本部手数料（ロイヤリティ相殺の原資）。クライアント送信値は使わずサーバーで計算する。
  // 計算基礎は「税抜金額 − 立替実費」（契約 別紙2-4）。
  //
  // 媒体請求は、取引媒体に応じて媒体側へ支払う額が変わるため申請時点では率が決まらない。
  // ここでは0で置き、本部が許可する段階で setInvoiceCommission() で打ち込む。
  const isMedia = kind === "MEDIA";
  const commissionRate    = isMedia ? 0 : HQ_COMMISSION_RATE;
  const commissionExclTax = isMedia
    ? 0
    : commissionOf(commissionBaseOf(amountExclTax, reimbursementExclTax ?? 0), commissionRate);
  const commissionTax     = Math.floor(commissionExclTax * 0.1);

  // ── 源泉徴収・控除不可消費税（hidden fields）
  const withholdingRaw       = (formData.get("withholdingTaxAmount")   as string)?.trim() || null;
  const nonDeductibleRaw     = (formData.get("nonDeductibleTaxAmount") as string)?.trim() || null;
  const withholdingTaxAmount   = withholdingRaw ? parseInt(withholdingRaw, 10) : null;
  const nonDeductibleTaxAmount = nonDeductibleRaw ? parseInt(nonDeductibleRaw, 10) : null;

  // 差引支払額は支払明細と同じ式で再計算する（本部手数料＋その消費税も控除）。
  const netPaymentAmount =
    amountInclTax - commissionExclTax - commissionTax
    - (withholdingTaxAmount ?? 0) - (nonDeductibleTaxAmount ?? 0);

  // ファイルアップロード（あれば）
  let fileUrl = fileUrlInput;
  if (file && file.size > 0) {
    const uploaded = await uploadBillingFile(file);
    if (uploaded) fileUrl = uploaded;
  }

  return {
    ok: true,
    data: {
      kind, medias,
      subject, branchLabel, customerId, contactName, contactEmail, billingDate, dueDate,
      details, amountExclTax, taxAmount, amountInclTax,
      commissionRate, commissionExclTax,
      mediaExpense, productionExpense, reimbursementExclTax,
      withholdingTaxAmount, nonDeductibleTaxAmount, netPaymentAmount,
      inspectionStatus, fileUrl, notes,
      projectId: projectId || null,
    },
  };
}

// ---------------------------------------------------------------
// 通知用: 顧客名を解決
// ---------------------------------------------------------------
async function resolveCustomerName(customerId: string | null): Promise<string> {
  if (!customerId) return "—";
  const customer = await db.customer.findUnique({
    where: { id: customerId },
    select: { name: true },
  });
  return customer?.name ?? "—";
}

// ---------------------------------------------------------------
// 請求依頼を作成する
// ---------------------------------------------------------------
export async function createInvoiceRequest(
  _prev: { error?: string } | null,
  formData: FormData
): Promise<{ error?: string }> {
  const info = await getSessionInfo();
  if (!info) return { error: "ログインが必要です" };
  if (!info.branchId) return { error: "拠点が割り当てられていません。管理者にお問い合わせください。" };

  const parsed = await parseFormData(formData);
  if (!parsed.ok) return { error: parsed.error };
  const d = parsed.data;

  let requestId = "";
  try {
    const created = await db.invoiceRequest.create({
      data: {
        // 媒体の内訳。通常請求では空配列＝行を作らない
        medias: {
          create: d.medias.map((m, i) => ({
            name: m.name,
            costExclTax: m.costExclTax,
            sortOrder: i,
          })),
        },
        kind:             d.kind,
        subject:          d.subject,
        branchLabel:      d.branchLabel,
        customerId:       d.customerId,
        contactName:      d.contactName,
        contactEmail:     d.contactEmail,
        billingDate:      d.billingDate,
        dueDate:          d.dueDate,
        details:          d.details,
        amountExclTax:          d.amountExclTax,
        taxAmount:              d.taxAmount,
        amountInclTax:          d.amountInclTax,
        commissionRate:         d.commissionRate,
        commissionExclTax:      d.commissionExclTax,
        mediaExpense:           d.mediaExpense,
        productionExpense:      d.productionExpense,
        reimbursementExclTax:   d.reimbursementExclTax,
        withholdingTaxAmount:   d.withholdingTaxAmount,
        nonDeductibleTaxAmount: d.nonDeductibleTaxAmount,
        netPaymentAmount:       d.netPaymentAmount,
        inspectionStatus:       d.inspectionStatus,
        fileUrl:                d.fileUrl,
        notes:                  d.notes,
        projectId:              d.projectId,
        createdById:            info.userId,
        creatorEmail:           info.email,
        branchId:               info.branchId,
      },
    });
    requestId = created.id;
    logAudit({ action: "invoice_created", email: info.email, name: info.staffName, entity: "invoice", entityId: created.id, detail: d.subject });
  } catch (e) {
    console.error("[createInvoiceRequest] DB error:", e instanceof Error ? e.message : e);
    return { error: "保存に失敗しました" };
  }

  const capturedId     = requestId;
  const capturedCustId = d.customerId;
  after(async () => {
    const customerName = await resolveCustomerName(capturedCustId);
    await sendInvoiceNotification({
      eventType:     "INVOICE_CREATED",
      requestId:     capturedId,
      subject:       d.subject,
      clientName:    customerName,
      amountExclTax: d.amountExclTax,
      amountInclTax: d.amountInclTax,
      creatorName:   info.staffName,
      creatorEmail:  info.email,
    });
  });

  revalidatePath("/dashboard/billing");
  redirect("/dashboard/billing");
}

// ---------------------------------------------------------------
// 請求依頼を更新する（作成者 or ADMIN のみ）
// ---------------------------------------------------------------
export async function updateInvoiceRequest(
  requestId: string,
  _prev: { error?: string } | null,
  formData: FormData
): Promise<{ error?: string }> {
  const info = await getSessionInfo();
  if (!info) return { error: "ログインが必要です" };

  const existing = await db.invoiceRequest.findFirst({
    where: {
      id: requestId,
      ...(info.role !== "ADMIN" ? { createdById: info.userId } : {}),
    },
  });
  if (!existing) return { error: "対象の請求依頼が見つかりません" };

  const parsed = await parseFormData(formData);
  if (!parsed.ok) return { error: parsed.error };
  const d = parsed.data;

  const fileUrl = d.fileUrl ?? existing.fileUrl;

  try {
    await db.invoiceRequest.update({
      where: { id: requestId },
      data: {
        // 行数が変わるので、消してから入れ直す
        medias: {
          deleteMany: {},
          create: d.medias.map((m, i) => ({
            name: m.name,
            costExclTax: m.costExclTax,
            sortOrder: i,
          })),
        },
        kind:             d.kind,
        subject:          d.subject,
        branchLabel:      d.branchLabel,
        customerId:       d.customerId,
        contactName:      d.contactName,
        contactEmail:     d.contactEmail,
        billingDate:      d.billingDate,
        dueDate:          d.dueDate,
        details:          d.details,
        amountExclTax:          d.amountExclTax,
        taxAmount:              d.taxAmount,
        amountInclTax:          d.amountInclTax,
        commissionRate:         d.commissionRate,
        commissionExclTax:      d.commissionExclTax,
        mediaExpense:           d.mediaExpense,
        productionExpense:      d.productionExpense,
        reimbursementExclTax:   d.reimbursementExclTax,
        withholdingTaxAmount:   d.withholdingTaxAmount,
        nonDeductibleTaxAmount: d.nonDeductibleTaxAmount,
        netPaymentAmount:       d.netPaymentAmount,
        inspectionStatus:       d.inspectionStatus,
        fileUrl,
        notes:                  d.notes,
        projectId:              d.projectId,
      },
    });
    logAudit({ action: "invoice_updated", email: info.email, name: info.staffName, entity: "invoice", entityId: requestId, detail: d.subject });
  } catch (e) {
    console.error("[updateInvoiceRequest] DB error:", e instanceof Error ? e.message : e);
    return { error: "更新に失敗しました" };
  }

  const capturedCustId = d.customerId;
  after(async () => {
    const customerName = await resolveCustomerName(capturedCustId);
    await sendInvoiceNotification({
      eventType:     "INVOICE_UPDATED",
      requestId,
      subject:       d.subject,
      clientName:    customerName,
      amountExclTax: d.amountExclTax,
      amountInclTax: d.amountInclTax,
      creatorName:   info.staffName,
      creatorEmail:  existing.creatorEmail,
    });
  });

  revalidatePath("/dashboard/billing");
  redirect(`/dashboard/billing/${requestId}`);
}

// ---------------------------------------------------------------
// ステータスを「提出済」に更新する（ADMIN のみ）
// ---------------------------------------------------------------
export async function submitInvoiceRequest(requestId: string): Promise<void> {
  const info = await getSessionInfo();
  if (!info || info.role !== "ADMIN") return;

  const existing = await db.invoiceRequest.findUnique({
    where: { id: requestId },
    include: { customer: { select: { name: true } } },
  });
  if (!existing) return;

  try {
    await db.invoiceRequest.update({
      where: { id: requestId },
      data: { status: "SUBMITTED" },
    });
  } catch (e) {
    console.error("[submitInvoiceRequest] DB error:", e);
    return;
  }

  after(async () => {
    await sendInvoiceNotification({
      eventType:     "INVOICE_SUBMITTED",
      requestId,
      subject:       existing.subject,
      clientName:    existing.customer?.name ?? "—",
      amountExclTax: Number(existing.amountExclTax),
      amountInclTax: Number(existing.amountInclTax),
      creatorName:   info.staffName,
      creatorEmail:  existing.creatorEmail,
    });
  });

  revalidatePath(`/dashboard/billing/${requestId}`);
  revalidatePath("/dashboard/billing");
}

// ---------------------------------------------------------------
// 本部手数料を打ち込む（ADMIN のみ）
//
// 媒体請求は、取引媒体に応じて媒体側へ支払う額が変わるため、申請の時点では
// 手数料の率が決まらない。本部が申請を許可する段階でここから金額を入れる。
// 入れた額はそのままロイヤリティの月次集計に乗る。
// ---------------------------------------------------------------
export async function setInvoiceCommission(
  requestId: string,
  commissionExclTaxInput: number,
): Promise<{ error?: string }> {
  const info = await getSessionInfo();
  if (!info || info.role !== "ADMIN") return { error: "本部のみ入力できます" };

  const existing = await db.invoiceRequest.findUnique({
    where: { id: requestId },
    select: {
      amountExclTax: true,
      amountInclTax: true,
      withholdingTaxAmount: true,
      nonDeductibleTaxAmount: true,
    },
  });
  if (!existing) return { error: "請求依頼が見つかりません" };

  if (!Number.isFinite(commissionExclTaxInput) || commissionExclTaxInput < 0)
    return { error: "手数料は0以上の整数で入力してください" };

  // 税抜金額を超える手数料はあり得ない（打ち間違いを弾く）
  const commissionExclTax = Math.min(
    Math.round(commissionExclTaxInput),
    Number(existing.amountExclTax),
  );
  const commissionTax = Math.floor(commissionExclTax * 0.1);

  // 差引支払額は通常請求と同じ式で引き直す
  const netPaymentAmount =
    Number(existing.amountInclTax)
    - commissionExclTax
    - commissionTax
    - Number(existing.withholdingTaxAmount ?? 0)
    - Number(existing.nonDeductibleTaxAmount ?? 0);

  try {
    await db.invoiceRequest.update({
      where: { id: requestId },
      data: { commissionExclTax, netPaymentAmount },
    });
  } catch (e) {
    console.error("[setInvoiceCommission] DB error:", e);
    return { error: "手数料の保存に失敗しました" };
  }

  revalidatePath(`/dashboard/billing/${requestId}`);
  revalidatePath("/dashboard/billing");
  revalidatePath("/dashboard/admin/royalty");
  return {};
}

// ---------------------------------------------------------------
// 請求依頼を削除する（作成者 or ADMIN のみ）
// ---------------------------------------------------------------
export async function deleteInvoiceRequest(requestId: string): Promise<{ error?: string }> {
  const info = await getSessionInfo();
  if (!info) return { error: "ログインが必要です" };

  const existing = await db.invoiceRequest.findFirst({
    where: {
      id: requestId,
      ...(info.role !== "ADMIN" ? { createdById: info.userId } : {}),
    },
  });
  if (!existing) return { error: "対象の請求依頼が見つかりません" };

  try {
    await db.invoiceRequest.delete({ where: { id: requestId } });
    logAudit({ action: "invoice_deleted", email: info.email, name: info.staffName, entity: "invoice", entityId: requestId, detail: existing.subject });
  } catch (e) {
    console.error("[deleteInvoiceRequest] DB error:", e instanceof Error ? e.message : e);
    return { error: "削除に失敗しました" };
  }

  revalidatePath("/dashboard/billing");
  redirect("/dashboard/billing");
}

// ---------------------------------------------------------------
// 一覧取得（ページ用）
// ---------------------------------------------------------------
export async function getInvoiceRequestList() {
  const info = await getSessionInfo();
  if (!info) return { requests: [] as Awaited<ReturnType<typeof fetchList>>, role: "USER" as UserRole };

  const requests = await fetchList(buildWhereScope(info.role, info.userId));
  return { requests, role: info.role };
}

async function fetchList(where: Prisma.InvoiceRequestWhereInput) {
  return db.invoiceRequest.findMany({
    where,
    orderBy: { createdAt: "desc" },
    take: 500,
    include: {
      customer:  { select: { id: true, name: true } },
      createdBy: { select: { name: true } },
      project:   { select: { id: true, title: true } },
      medias:    { orderBy: { sortOrder: "asc" }, select: { name: true, costExclTax: true } },
    },
  });
}

// ---------------------------------------------------------------
// 単件取得（権限チェック付き）
// ---------------------------------------------------------------
export async function getInvoiceRequestWithAuth(requestId: string) {
  const info = await getSessionInfo();
  if (!info || !info.userId) notFound();

  const request = await db.invoiceRequest.findFirst({
    where: {
      id: requestId,
      ...buildWhereScope(info.role, info.userId),
    },
    include: {
      customer:  { select: { id: true, name: true, contactName: true } },
      createdBy: { select: { name: true, email: true } },
      project:   { select: { id: true, title: true } },
      medias:    { orderBy: { sortOrder: "asc" } },
    },
  });

  if (!request) notFound();
  return { request, role: info.role, userId: info.userId };
}

// ---------------------------------------------------------------
// ページ用: プロジェクト一覧（customerId 付き）
// ---------------------------------------------------------------
export async function getProjectsForSelect() {
  const info = await getSessionInfo();
  if (!info) return [];

  const where: Prisma.ProjectWhereInput = getBranchFilter(info);

  return db.project.findMany({
    where,
    orderBy: { createdAt: "desc" },
    select: { id: true, title: true, customerId: true },
  });
}

// ---------------------------------------------------------------
// ページ用: 顧客一覧（請求先選択ドロップダウン用）
// ---------------------------------------------------------------
export async function getCustomersForSelect() {
  const info = await getSessionInfo();
  if (!info) return [];

  const where: Prisma.CustomerWhereInput = getBranchFilter(info);

  return db.customer.findMany({
    where,
    orderBy: { name: "asc" },
    select: { id: true, name: true, email: true, contactName: true },
  });
}
