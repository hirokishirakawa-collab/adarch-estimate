"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { after } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { getMockBranchId } from "@/lib/data/customers";
import type { DealStatus } from "@/generated/prisma/client";
import type { UserRole } from "@/types/roles";
import { sendDealNotification } from "@/lib/notifications";
import { DEAL_STATUS_OPTIONS } from "@/lib/constants/deals";

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
// 商談を新規作成する
// ---------------------------------------------------------------
export async function createDeal(
  _prev: { error?: string } | null,
  formData: FormData
): Promise<{ error?: string }> {
  const info = await getSessionInfo();
  if (!info) return { error: "ログインが必要です" };
  const { staffName, branchId } = info;

  const title = (formData.get("title") as string)?.trim();
  if (!title) return { error: "商談タイトルは必須です" };
  if (title.length > 100) return { error: "商談タイトルは100文字以内で入力してください" };

  const customerId = (formData.get("customerId") as string)?.trim();
  if (!customerId) return { error: "顧客を選択してください" };

  const status        = (formData.get("status") as string) || "PROSPECTING";
  const amountRaw     = (formData.get("amount") as string)?.trim();
  const amount        = amountRaw ? parseInt(amountRaw.replace(/,/g, ""), 10) : null;
  const probabilityRaw = (formData.get("probability") as string)?.trim();
  const probability   = probabilityRaw ? parseInt(probabilityRaw, 10) : null;
  const expectedCloseDate = (formData.get("expectedCloseDate") as string) || null;
  const notes         = (formData.get("notes") as string)?.trim() || null;

  if (amount !== null && (isNaN(amount) || amount < 0)) {
    return { error: "金額は0以上の整数で入力してください" };
  }
  if (probability !== null && (isNaN(probability) || probability < 0 || probability > 100)) {
    return { error: "受注確度は0〜100で入力してください" };
  }

  let dealId: string;
  let customerName: string;
  try {
    const [deal, customer] = await Promise.all([
      db.deal.create({
        data: {
          title,
          status: status as DealStatus,
          amount: amount ?? null,
          probability,
          expectedCloseDate: expectedCloseDate ? new Date(expectedCloseDate) : null,
          notes,
          customerId,
          branchId,
          createdById: null,
          assignedToId: null,
        },
      }),
      db.customer.findUnique({ where: { id: customerId }, select: { name: true } }),
    ]);
    dealId = deal.id;
    customerName = customer?.name ?? "不明";
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error("[createDeal] DB error:", msg);
    return { error: process.env.NODE_ENV !== "production" ? `保存失敗: ${msg}` : "保存に失敗しました" };
  }

  // 通知（after: レスポンス送信後に非同期実行）
  const capturedDealId     = dealId;
  const capturedCustomer   = customerName;
  const capturedTitle      = title;
  const capturedAmount     = amount;
  const capturedStatus     = status;
  const capturedStaffName  = info.staffName;
  after(async () => {
    const statusLabel =
      DEAL_STATUS_OPTIONS.find((o) => o.value === capturedStatus)?.label ?? capturedStatus;
    await sendDealNotification(
      {
        eventType: "DEAL_CREATED",
        dealId:       capturedDealId,
        customerName: capturedCustomer,
        dealTitle:    capturedTitle,
        statusLabel,
        amount:       capturedAmount,
        staffName:    capturedStaffName,
      }
    );
  });

  revalidatePath("/dashboard/deals");
  redirect(`/dashboard/deals`);
}

// ---------------------------------------------------------------
// 商談ステータスを更新する（カンバン DnD）
// ---------------------------------------------------------------
export async function updateDealStatus(
  dealId: string,
  status: DealStatus
): Promise<{ error?: string }> {
  const info = await getSessionInfo();
  if (!info) return { error: "ログインが必要です" };

  let deal: { title: string; customer: { name: string }; assignedTo: { name: string | null } | null } | null = null;
  try {
    deal = await db.deal.update({
      where: { id: dealId },
      data: { status },
      select: {
        title: true,
        customer: { select: { name: true } },
        assignedTo: { select: { name: true } },
      },
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error("[updateDealStatus] DB error:", msg);
    return { error: "ステータス更新に失敗しました" };
  }

  // 通知（after: レスポンス送信後に確実に実行される）
  if (deal) {
    const statusLabel =
      DEAL_STATUS_OPTIONS.find((o) => o.value === status)?.label ?? status;
    const captured = deal;
    const capturedInfo = info;
    after(async () => {
      await sendDealNotification({
        eventType: "STATUS_CHANGED",
        dealId,
        customerName: captured.customer.name,
        dealTitle: captured.title,
        assigneeName: captured.assignedTo?.name ?? null,
        statusLabel,
        staffName: capturedInfo.staffName,
      });
    });
  }

  revalidatePath("/dashboard/deals");
  return {};
}

// ---------------------------------------------------------------
// 商談を更新する
// ---------------------------------------------------------------
export async function updateDeal(
  dealId: string,
  _prev: { error?: string } | null,
  formData: FormData
): Promise<{ error?: string }> {
  const info = await getSessionInfo();
  if (!info) return { error: "ログインが必要です" };

  const title = (formData.get("title") as string)?.trim();
  if (!title) return { error: "商談タイトルは必須です" };
  if (title.length > 200) return { error: "商談タイトルは200文字以内で入力してください" };

  const status          = (formData.get("status") as string) || "PROSPECTING";
  const amountRaw       = (formData.get("amount") as string)?.trim();
  const amount          = amountRaw ? parseInt(amountRaw.replace(/,/g, ""), 10) : null;
  const probabilityRaw  = (formData.get("probability") as string)?.trim();
  const probability     = probabilityRaw ? parseInt(probabilityRaw, 10) : null;
  const expectedCloseDate = (formData.get("expectedCloseDate") as string) || null;
  const notes           = (formData.get("notes") as string)?.trim() || null;

  if (amount !== null && (isNaN(amount) || amount < 0))
    return { error: "金額は0以上の整数で入力してください" };
  if (probability !== null && (isNaN(probability) || probability < 0 || probability > 100))
    return { error: "受注確度は0〜100で入力してください" };

  let customerName: string;
  try {
    const updated = await db.deal.update({
      where: { id: dealId },
      data: {
        title,
        status: status as DealStatus,
        amount: amount ?? null,
        probability,
        expectedCloseDate: expectedCloseDate ? new Date(expectedCloseDate) : null,
        notes,
      },
      select: { customer: { select: { name: true } } },
    });
    customerName = updated.customer.name;
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error("[updateDeal] DB error:", msg);
    return { error: process.env.NODE_ENV !== "production" ? `保存失敗: ${msg}` : "保存に失敗しました" };
  }

  // 通知（after: レスポンス送信後に非同期実行）
  const capturedDealId    = dealId;
  const capturedCustomer  = customerName;
  const capturedTitle     = title;
  const capturedStatus    = status;
  const capturedStaffName = info.staffName;
  after(async () => {
    const statusLabel =
      DEAL_STATUS_OPTIONS.find((o) => o.value === capturedStatus)?.label ?? capturedStatus;
    await sendDealNotification(
      {
        eventType: "DEAL_UPDATED",
        dealId:       capturedDealId,
        customerName: capturedCustomer,
        dealTitle:    capturedTitle,
        statusLabel,
        staffName:    capturedStaffName,
      }
    );
  });

  revalidatePath("/dashboard/deals");
  revalidatePath(`/dashboard/deals/${dealId}`);
  redirect(`/dashboard/deals/${dealId}`);
}

// ---------------------------------------------------------------
// 商談活動ログを追加する
// ---------------------------------------------------------------
export async function createDealLog(
  _prev: { error?: string } | null,
  formData: FormData
): Promise<{ error?: string; success?: boolean }> {
  const info = await getSessionInfo();
  if (!info) return { error: "ログインが必要です" };
  const { staffName } = info;

  const dealId  = (formData.get("dealId") as string)?.trim();
  const type    = (formData.get("type") as string) || "OTHER";
  const content = (formData.get("content") as string)?.trim();

  if (!dealId)  return { error: "商談IDが不正です" };
  if (!content) return { error: "活動内容を入力してください" };
  if (content.length > 2000) return { error: "活動内容は2000文字以内で入力してください" };

  try {
    await db.dealLog.create({
      data: {
        dealId,
        type: type as import("@/generated/prisma/client").ActivityType,
        content,
        staffName,
      },
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error("[createDealLog] DB error:", msg);
    return { error: "記録に失敗しました" };
  }

  // 通知（after: レスポンス送信後に確実に実行される）
  const capturedContent = content;
  const capturedType = type;
  const capturedStaffName = staffName;
  after(async () => {
    const deal = await db.deal.findUnique({
      where: { id: dealId },
      select: {
        title: true,
        customer: { select: { name: true } },
        assignedTo: { select: { name: true } },
      },
    });
    if (!deal) return;
    await sendDealNotification({
      eventType: "LOG_ADDED",
      dealId,
      customerName: deal.customer.name,
      dealTitle: deal.title,
      assigneeName: deal.assignedTo?.name ?? null,
      logContent: capturedContent,
      logType: capturedType,
      staffName: capturedStaffName,
    });
  });

  revalidatePath(`/dashboard/deals/${dealId}`);
  return { success: true };
}

// ---------------------------------------------------------------
// 商談メモ（notes）だけをインライン更新する
// ---------------------------------------------------------------
export async function updateDealNotes(
  dealId: string,
  notes: string
): Promise<{ error?: string }> {
  const info = await getSessionInfo();
  if (!info) return { error: "ログインが必要です" };

  try {
    await db.deal.update({
      where: { id: dealId },
      data: { notes: notes.trim() || null },
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error("[updateDealNotes] DB error:", msg);
    return { error: "保存に失敗しました" };
  }

  revalidatePath("/dashboard/deals/list");
  revalidatePath(`/dashboard/deals/${dealId}`);
  return {};
}

// ---------------------------------------------------------------
// 商談を削除する
// ---------------------------------------------------------------
export async function deleteDeal(dealId: string): Promise<{ error?: string }> {
  const info = await getSessionInfo();
  if (!info) return { error: "ログインが必要です" };

  try {
    await db.deal.delete({ where: { id: dealId } });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error("[deleteDeal] DB error:", msg);
    return { error: "削除に失敗しました" };
  }

  revalidatePath("/dashboard/deals");
  redirect("/dashboard/deals");
}
