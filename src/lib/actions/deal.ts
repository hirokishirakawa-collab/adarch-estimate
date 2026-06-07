"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { after } from "next/server";
import { db } from "@/lib/db";
import { getSessionInfo, getBranchFilter } from "@/lib/session";
import { getMockBranchId } from "@/lib/data/customers";
import type { DealStatus } from "@/generated/prisma/client";
import type { UserRole } from "@/types/roles";
import { sendDealNotification, notifyAdmins, createInAppNotification } from "@/lib/notifications";
import { DEAL_STATUS_OPTIONS } from "@/lib/constants/deals";
import { logAudit } from "@/lib/audit";

// ---------------------------------------------------------------
// 受注時にプロジェクトを自動作成する（内部ヘルパー）
// ---------------------------------------------------------------
async function createProjectFromDeal(dealId: string, staffName: string) {
  try {
    // 既にプロジェクトが紐づいていれば何もしない
    const existing = await db.project.findFirst({ where: { dealId } });
    if (existing) return;

    const deal = await db.deal.findUnique({
      where: { id: dealId },
      include: {
        customer: { select: { id: true, name: true } },
        assignedTo: { select: { name: true } },
      },
    });
    if (!deal) return;

    const project = await db.project.create({
      data: {
        title: deal.title,
        status: "ORDERED",
        budget: deal.amount,
        customerId: deal.customerId,
        branchId: deal.branchId,
        staffName: deal.assignedTo?.name ?? staffName,
        dealId: deal.id,
        description: `商談「${deal.title}」から自動作成`,
      },
    });

    // ログ
    await db.projectLog.create({
      data: {
        projectId: project.id,
        type: "SYSTEM",
        content: `商談「${deal.title}」の受注により自動作成`,
        staffName: "SYSTEM",
      },
    });

    console.log(`[createProjectFromDeal] Created project ${project.id} from deal ${dealId}`);

    // Notify assignee
    if (deal.assignedTo) {
      const assignee = await db.user.findFirst({ where: { name: deal.assignedTo.name }, select: { id: true } });
      if (assignee) {
        createInAppNotification({
          userId: assignee.id,
          type: "PROJECT_CREATED",
          title: `プロジェクト自動作成: ${project.title}`,
          linkUrl: `/dashboard/projects/${project.id}`,
        }).catch(() => {});
      }
    }

    notifyAdmins({
      type: "PROJECT_CREATED",
      title: `プロジェクト自動作成: ${project.title}`,
      message: `商談「${deal.title}」から`,
      linkUrl: `/dashboard/projects/${project.id}`,
    }).catch(() => {});
  } catch (e) {
    console.error("[createProjectFromDeal]", e);
  }
}

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

  // 受注時にプロジェクトを自動作成
  if (status === "CLOSED_WON") {
    const capturedDealId = dealId;
    const capturedStaff = info.staffName;
    after(async () => {
      await createProjectFromDeal(capturedDealId, capturedStaff);
    });
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

      // In-app: 受注通知
      if (status === "CLOSED_WON") {
        notifyAdmins({
          type: "DEAL_WON",
          title: `商談受注: ${captured.title}`,
          message: `${captured.customer.name}`,
          linkUrl: `/dashboard/deals/${dealId}`,
        }).catch(() => {});
      }
    });
  }

  revalidatePath("/dashboard/deals");
  return {};
}

// ---------------------------------------------------------------
// 商談ステータスを一括更新する（停滞商談の休眠移行など）
// 拠点スコープ厳守（非ADMINは自拠点の商談のみ更新可）。
// 受注(CLOSED_WON)への一括変更はプロジェクト自動作成などの副作用が
// 大きいため許可しない。通知も出さない（一括の仕分け作業のため静かに処理）。
// ---------------------------------------------------------------
export async function bulkUpdateDealStatus(
  dealIds: string[],
  status: DealStatus
): Promise<{ error?: string; updated?: number }> {
  const info = await getSessionInfo();
  if (!info) return { error: "ログインが必要です" };
  if (info.role === "USER") return { error: "権限がありません" };
  if (dealIds.length === 0) return { updated: 0 };
  if (status === "CLOSED_WON") {
    return { error: "受注への一括変更はできません（個別に処理してください）" };
  }

  const branchFilter = getBranchFilter(info);
  try {
    const result = await db.deal.updateMany({
      where: { id: { in: dealIds }, ...branchFilter },
      data: { status },
    });
    logAudit({
      action: "deal_status_bulk_updated",
      email: info.email,
      name: info.staffName,
      entity: "deal",
      entityId: dealIds.slice(0, 50).join(","),
      detail: `${result.count}件を${status}へ一括変更`,
    });
    revalidatePath("/dashboard/deals");
    return { updated: result.count };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error("[bulkUpdateDealStatus] DB error:", msg);
    return { error: "一括更新に失敗しました" };
  }
}

// ---------------------------------------------------------------
// 受注の決め手を記録する（アーチくんのナレッジ学習用）
// ---------------------------------------------------------------
export async function updateDealClosingFactor(
  dealId: string,
  closingFactor: string
): Promise<{ error?: string; success?: boolean }> {
  const info = await getSessionInfo();
  if (!info) return { error: "ログインが必要です" };
  if (info.role === "USER") return { error: "権限がありません" };

  try {
    await db.deal.update({
      where: { id: dealId },
      data: { closingFactor: closingFactor.trim() || null },
    });
    logAudit({
      action: "deal_closing_factor_updated",
      email: info.email,
      name: info.staffName,
      entity: "deal",
      entityId: dealId,
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error("[updateDealClosingFactor] DB error:", msg);
    return { error: "保存に失敗しました" };
  }

  revalidatePath(`/dashboard/deals/${dealId}`);
  return { success: true };
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

  // 受注時にプロジェクトを自動作成
  if (status === "CLOSED_WON") {
    const capturedDealIdForProject = dealId;
    const capturedStaffForProject = info.staffName;
    after(async () => {
      await createProjectFromDeal(capturedDealIdForProject, capturedStaffForProject);
    });
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

    // In-app: 受注通知
    if (capturedStatus === "CLOSED_WON") {
      notifyAdmins({
        type: "DEAL_WON",
        title: `商談受注: ${capturedTitle}`,
        message: `${capturedCustomer}`,
        linkUrl: `/dashboard/deals/${capturedDealId}`,
      }).catch(() => {});
    }
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
// 活動ログを削除する（ADMIN のみ）
// ---------------------------------------------------------------
export async function deleteDealLog(
  logId: string
): Promise<{ error?: string }> {
  const info = await getSessionInfo();
  if (!info) return { error: "ログインが必要です" };
  if (info.role !== "ADMIN") return { error: "管理者のみ削除できます" };

  try {
    const log = await db.dealLog.delete({ where: { id: logId } });
    logAudit({ action: "deal_log_deleted", email: info.email, name: info.staffName, entity: "dealLog", entityId: logId, detail: `dealId=${log.dealId}` });
    revalidatePath(`/dashboard/deals/${log.dealId}`);
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error("[deleteDealLog] DB error:", msg);
    return { error: "削除に失敗しました" };
  }

  return {};
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

  const trimmed = notes.trim();

  try {
    const deal = await db.deal.update({
      where: { id: dealId },
      data: { notes: trimmed || null },
      select: {
        title: true,
        customer: { select: { name: true } },
      },
    });

    // メモが空でなければ Google Chat に通知
    if (trimmed) {
      const snippet = trimmed.length > 60 ? trimmed.slice(0, 60) + "…" : trimmed;
      after(() =>
        sendDealNotification({
          eventType: "NOTES_UPDATED",
          dealId,
          customerName: deal.customer.name,
          dealTitle: deal.title,
          notesSnippet: snippet,
          staffName: info.staffName,
        })
      );
    }
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

// ---------------------------------------------------------------
// レギュラー（継続）案件の設定
// ---------------------------------------------------------------
export async function setDealRegular(
  dealId: string,
  data: {
    isRegular: boolean;
    monthlyAmount: number | null;
    startDate: string | null;
    renewalDate: string | null;
    endedAt: string | null;
  },
): Promise<{ error?: string }> {
  const info = await getSessionInfo();
  if (!info) return { error: "ログインが必要です" };
  if (info.role === "USER") return { error: "権限がありません" };

  // 拠点スコープ: ADMIN以外は自拠点の商談のみ編集可（IDOR防止）
  const target = await db.deal.findUnique({ where: { id: dealId }, select: { branchId: true } });
  if (!target) return { error: "商談が見つかりません" };
  if (info.role !== "ADMIN") {
    const userBranchId = getMockBranchId(info.email, info.role);
    if (userBranchId && target.branchId !== userBranchId) return { error: "権限がありません" };
  }

  try {
    await db.deal.update({
      where: { id: dealId },
      data: {
        isRegular: data.isRegular,
        regularMonthlyAmount: data.monthlyAmount != null ? Math.max(0, Math.round(data.monthlyAmount)) : null,
        regularStartDate: data.startDate ? new Date(data.startDate) : null,
        regularRenewalDate: data.renewalDate ? new Date(data.renewalDate) : null,
        regularEndedAt: data.endedAt ? new Date(data.endedAt) : null,
      },
    });
    logAudit({
      action: "deal_regular_set",
      email: info.email,
      name: info.staffName,
      entity: "deal",
      entityId: dealId,
      detail: data.isRegular
        ? `レギュラー設定 月額¥${(data.monthlyAmount ?? 0).toLocaleString()}${data.endedAt ? "・解約" : "・継続中"}`
        : "レギュラー解除",
    });
  } catch (e) {
    console.error("[setDealRegular] DB error:", e instanceof Error ? e.message : e);
    return { error: "保存に失敗しました" };
  }

  revalidatePath("/dashboard/deals/list");
  revalidatePath(`/dashboard/deals/${dealId}`);
  revalidatePath("/dashboard/regulars");
  return {};
}
