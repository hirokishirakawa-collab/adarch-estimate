"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { after } from "next/server";
import { db } from "@/lib/db";
import { getSessionInfo } from "@/lib/session";
import type { DealStatus } from "@/generated/prisma/client";
import type { UserRole } from "@/types/roles";
import { sendDealNotification } from "@/lib/notifications";
import { DEAL_STATUS_OPTIONS } from "@/lib/constants/deals";
import { logAudit } from "@/lib/audit";

// ---------------------------------------------------------------
// 商談を新規作成する
// ---------------------------------------------------------------
export async function createDeal(
  _prev: { error?: string; duplicate?: boolean } | null,
  formData: FormData
): Promise<{ error?: string; duplicate?: boolean }> {
  const info = await getSessionInfo();
  if (!info) return { error: "ログインが必要です" };
  if (!info.branchId) return { error: "拠点が割り当てられていません。管理者にお問い合わせください。" };
  const { staffName, branchId, userId } = info;

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

  // ヒアリングシートデータの取得（h_ プレフィックス付き）
  const hStr = (key: string) => (formData.get(`h_${key}`) as string)?.trim() || null;
  const hArr = (key: string) => formData.getAll(`h_${key}`).map((v) => String(v).trim()).filter(Boolean);

  const hearingData = {
    businessDescription: hStr("businessDescription"),
    targetCustomers: hArr("targetCustomers"),
    tradeArea: hStr("tradeArea"),
    annualRevenue: hStr("annualRevenue"),
    employeeCount: hStr("employeeCount"),
    currentChannels: hArr("currentChannels"),
    monthlyAdBudget: hStr("monthlyAdBudget"),
    pastEfforts: hStr("pastEfforts"),
    competitors: hStr("competitors"),
    primaryChallenge: hStr("primaryChallenge"),
    challengeDetail: hStr("challengeDetail"),
    interestedServices: hArr("interestedServices"),
    desiredTimeline: hStr("desiredTimeline"),
    decisionMaker: hStr("decisionMaker"),
    decisionProcess: hStr("decisionProcess"),
    budgetStatus: hStr("budgetStatus"),
    competingVendors: hStr("competingVendors"),
    videoPurposes: hArr("videoPurposes"),
    videoDuration: hStr("videoDuration"),
    videoShootingType: hStr("videoShootingType"),
    videoCast: hStr("videoCast"),
    videoReference: hStr("videoReference"),
    videoDeadline: hStr("videoDeadline") ? new Date(hStr("videoDeadline")!) : null,
    videoPublishTo: hArr("videoPublishTo"),
    videoBudget: hStr("videoBudget"),
    temperature: hStr("temperature"),
    nextAction: hStr("nextAction"),
    nextActionDate: hStr("nextActionDate") ? new Date(hStr("nextActionDate")!) : null,
    hearingRound: hStr("hearingRound") ? parseInt(hStr("hearingRound")!, 10) : null,
    freeNotes: hStr("freeNotes"),
  };

  // ヒアリングデータが1つでも入力されているか判定
  const hasHearingData = Object.values(hearingData).some((v) =>
    Array.isArray(v) ? v.length > 0 : v !== null
  );

  // 同じ顧客にアクティブな商談があるか確認（重複防止）
  const confirmDuplicate = formData.get("confirmDuplicate") === "true";
  if (!confirmDuplicate) {
    const existingActive = await db.deal.findFirst({
      where: {
        customerId,
        status: { notIn: ["CLOSED_WON", "CLOSED_LOST"] },
      },
      select: { id: true, title: true, status: true },
    });
    if (existingActive) {
      const statusLabel = DEAL_STATUS_OPTIONS.find((o) => o.value === existingActive.status)?.label ?? existingActive.status;
      return {
        error: `この顧客には既にアクティブな商談「${existingActive.title}」（${statusLabel}）があります。既存の商談のステータスを変更するか、重複を承知の上で作成してください。`,
        duplicate: true,
      } as { error: string; duplicate?: boolean };
    }
  }

  let dealId: string;
  let customerName: string;
  try {
    const customer = await db.customer.findUnique({ where: { id: customerId }, select: { name: true } });
    customerName = customer?.name ?? "不明";

    const deal = await db.$transaction(async (tx) => {
      const newDeal = await tx.deal.create({
        data: {
          title,
          status: status as DealStatus,
          amount: amount ?? null,
          probability,
          expectedCloseDate: expectedCloseDate ? new Date(expectedCloseDate) : null,
          notes,
          customerId,
          branchId,
          createdById: userId,
          assignedToId: (formData.get("assignedToId") as string)?.trim() || null,
        },
      });

      // ヒアリングデータがあれば同時に作成
      if (hasHearingData) {
        await tx.hearingSheet.create({
          data: {
            dealId: newDeal.id,
            customerId,
            ...hearingData,
          },
        });
      }

      return newDeal;
    });

    dealId = deal.id;
    logAudit({ action: "deal_created", email: info.email, name: staffName, entity: "deal", entityId: deal.id, detail: title });
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
  if (info.role === "USER") return { error: "権限がありません" };

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
    logAudit({ action: "deal_status_updated", email: info.email, name: info.staffName, entity: "deal", entityId: dealId, detail: status });
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
  if (info.role === "USER") return { error: "権限がありません" };

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
        assignedToId: (formData.get("assignedToId") as string)?.trim() || null,
      },
      select: { customer: { select: { name: true } } },
    });
    customerName = updated.customer.name;
    logAudit({ action: "deal_updated", email: info.email, name: info.staffName, entity: "deal", entityId: dealId, detail: title });
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
  if (info.role === "USER") return { error: "権限がありません" };
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
  if (info.role === "USER") return { error: "権限がありません" };

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
  if (info.role !== "ADMIN") return { error: "管理者のみ削除できます" };

  try {
    await db.deal.delete({ where: { id: dealId } });
    logAudit({ action: "deal_deleted", email: info.email, name: info.staffName, entity: "deal", entityId: dealId });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error("[deleteDeal] DB error:", msg);
    return { error: "削除に失敗しました" };
  }

  revalidatePath("/dashboard/deals");
  return {};
}
