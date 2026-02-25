"use server";

import { redirect, notFound } from "next/navigation";
import { revalidatePath } from "next/cache";
import { after } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { getMockBranchId } from "@/lib/data/customers";
import { sendInvoiceNotification } from "@/lib/notifications";
import { uploadBillingFile } from "@/lib/storage";
import type { UserRole } from "@/types/roles";
import type { Prisma } from "@/generated/prisma/client";

// ---------------------------------------------------------------
// 共通: セッション情報取得
// ログイン済みユーザーを DB に自動 upsert して userId を確実に確保する
// ---------------------------------------------------------------
async function getSessionInfo() {
  const session = await auth();
  if (!session?.user) return null;

  const role     = (session.user.role ?? "MANAGER") as UserRole;
  const email    = session.user.email ?? "";
  const branchId = getMockBranchId(email, role) ?? "branch_hq";

  // DB ロール変換
  const dbRole: "ADMIN" | "MANAGER" | "USER" =
    role === "ADMIN" ? "ADMIN" : role === "MANAGER" ? "MANAGER" : "USER";

  // Google OAuth ログイン時に users テーブルへの自動登録は行われないため、
  // ここで upsert して userId を必ず確保する
  const user = await db.user.upsert({
    where:  { email },
    update: {},  // 既存レコードは変更しない
    create: {
      email,
      name:     session.user.name ?? email,
      role:     dbRole,
      branchId: getMockBranchId(email, role),  // ADMIN は null
    },
    select: { id: true, name: true },
  });

  return { role, email, branchId, userId: user.id, staffName: user.name ?? email };
}

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
        customerId: string | null;
        contactName: string | null;
        contactEmail: string;
        billingDate: Date;
        dueDate: Date | null;
        details: string | null;
        amountExclTax: number;
        taxAmount: number;
        amountInclTax: number;
        inspectionStatus: string | null;
        fileUrl: string | null;
        notes: string | null;
        projectId: string | null;
      };
    }
  | { ok: false; error: string }
> {
  const subject        = (formData.get("subject")           as string)?.trim();
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

  // ファイルアップロード（あれば）
  let fileUrl = fileUrlInput;
  if (file && file.size > 0) {
    const uploaded = await uploadBillingFile(file);
    if (uploaded) fileUrl = uploaded;
  }

  return {
    ok: true,
    data: {
      subject, customerId, contactName, contactEmail, billingDate, dueDate,
      details, amountExclTax, taxAmount, amountInclTax,
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

  const parsed = await parseFormData(formData);
  if (!parsed.ok) return { error: parsed.error };
  const d = parsed.data;

  let requestId = "";
  try {
    const created = await db.invoiceRequest.create({
      data: {
        subject:          d.subject,
        customerId:       d.customerId,
        contactName:      d.contactName,
        contactEmail:     d.contactEmail,
        billingDate:      d.billingDate,
        dueDate:          d.dueDate,
        details:          d.details,
        amountExclTax:    d.amountExclTax,
        taxAmount:        d.taxAmount,
        amountInclTax:    d.amountInclTax,
        inspectionStatus: d.inspectionStatus,
        fileUrl:          d.fileUrl,
        notes:            d.notes,
        projectId:        d.projectId,
        createdById:      info.userId,
        creatorEmail:     info.email,
        branchId:         info.branchId,
      },
    });
    requestId = created.id;
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
        subject:          d.subject,
        customerId:       d.customerId,
        contactName:      d.contactName,
        contactEmail:     d.contactEmail,
        billingDate:      d.billingDate,
        dueDate:          d.dueDate,
        details:          d.details,
        amountExclTax:    d.amountExclTax,
        taxAmount:        d.taxAmount,
        amountInclTax:    d.amountInclTax,
        inspectionStatus: d.inspectionStatus,
        fileUrl,
        notes:            d.notes,
        projectId:        d.projectId,
      },
    });
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
    include: {
      customer:  { select: { id: true, name: true } },
      createdBy: { select: { name: true } },
      project:   { select: { id: true, title: true } },
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

  const where: Prisma.ProjectWhereInput =
    info.role === "ADMIN" ? {} : { branchId: info.branchId };

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

  const where: Prisma.CustomerWhereInput =
    info.role === "ADMIN" ? {} : { branchId: info.branchId };

  return db.customer.findMany({
    where,
    orderBy: { name: "asc" },
    select: { id: true, name: true, email: true },
  });
}
