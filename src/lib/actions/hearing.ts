"use server";

import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { logAudit } from "@/lib/audit";
import { revalidatePath } from "next/cache";
import { after } from "next/server";
import { getSessionInfo } from "@/lib/session";
import { sendDealNotification } from "@/lib/notifications";
import type { DealStatus } from "@/generated/prisma/client";
import {
  INTERESTED_SERVICE_OPTIONS,
  MONTHLY_BUDGET_TO_AMOUNT,
  VIDEO_BUDGET_TO_AMOUNT,
  TEMPERATURE_TO_PROBABILITY,
  TIMELINE_TO_DAYS,
  PRIMARY_CHALLENGE_OPTIONS,
} from "@/lib/constants/hearing";
import { DEAL_STATUS_OPTIONS } from "@/lib/constants/deals";

async function requireAuth() {
  const session = await auth();
  if (!session?.user?.email) throw new Error("Unauthorized");
  return { email: session.user.email, name: session.user.name ?? "" };
}

// ヒアリングデータ型
type HearingData = {
  businessDescription?: string | null;
  targetCustomers?: string[];
  tradeArea?: string | null;
  annualRevenue?: string | null;
  employeeCount?: string | null;
  currentChannels?: string[];
  monthlyAdBudget?: string | null;
  pastEfforts?: string | null;
  competitors?: string | null;
  primaryChallenge?: string | null;
  challengeDetail?: string | null;
  interestedServices?: string[];
  desiredTimeline?: string | null;
  decisionMaker?: string | null;
  decisionProcess?: string | null;
  budgetStatus?: string | null;
  competingVendors?: string | null;
  videoPurposes?: string[];
  videoDuration?: string | null;
  videoShootingType?: string | null;
  videoCast?: string | null;
  videoReference?: string | null;
  videoDeadline?: string | null;
  videoPublishTo?: string[];
  videoBudget?: string | null;
  temperature?: string | null;
  nextAction?: string | null;
  nextActionDate?: string | null;
};

function toFields(data: HearingData) {
  return {
    businessDescription: data.businessDescription ?? null,
    targetCustomers: data.targetCustomers ?? [],
    tradeArea: data.tradeArea ?? null,
    annualRevenue: data.annualRevenue ?? null,
    employeeCount: data.employeeCount ?? null,
    currentChannels: data.currentChannels ?? [],
    monthlyAdBudget: data.monthlyAdBudget ?? null,
    pastEfforts: data.pastEfforts ?? null,
    competitors: data.competitors ?? null,
    primaryChallenge: data.primaryChallenge ?? null,
    challengeDetail: data.challengeDetail ?? null,
    interestedServices: data.interestedServices ?? [],
    desiredTimeline: data.desiredTimeline ?? null,
    decisionMaker: data.decisionMaker ?? null,
    decisionProcess: data.decisionProcess ?? null,
    budgetStatus: data.budgetStatus ?? null,
    competingVendors: data.competingVendors ?? null,
    videoPurposes: data.videoPurposes ?? [],
    videoDuration: data.videoDuration ?? null,
    videoShootingType: data.videoShootingType ?? null,
    videoCast: data.videoCast ?? null,
    videoReference: data.videoReference ?? null,
    videoDeadline: data.videoDeadline ? new Date(data.videoDeadline) : null,
    videoPublishTo: data.videoPublishTo ?? [],
    videoBudget: data.videoBudget ?? null,
    temperature: data.temperature ?? null,
    nextAction: data.nextAction ?? null,
    nextActionDate: data.nextActionDate ? new Date(data.nextActionDate) : null,
  };
}

// ----------------------------------------------------------------
// リード用：ヒアリングシート取得
// ----------------------------------------------------------------
export async function getHearingSheet(leadId: string) {
  await requireAuth();
  return db.hearingSheet.findUnique({ where: { leadId } });
}

// ----------------------------------------------------------------
// 顧客用：ヒアリングシート一覧取得
// ----------------------------------------------------------------
export async function getCustomerHearingSheets(customerId: string) {
  await requireAuth();
  return db.hearingSheet.findMany({
    where: { customerId },
    orderBy: { updatedAt: "desc" },
  });
}

// ----------------------------------------------------------------
// 商談用：ヒアリングシート取得
// ----------------------------------------------------------------
export async function getDealHearingSheet(dealId: string) {
  await requireAuth();
  return db.hearingSheet.findUnique({ where: { dealId } });
}

// ----------------------------------------------------------------
// リード用：ヒアリングシート保存（upsert）
// ----------------------------------------------------------------
export async function saveHearingSheet(
  leadId: string,
  data: HearingData
): Promise<{ error?: string }> {
  try {
    const user = await requireAuth();
    const fields = toFields(data);

    await db.hearingSheet.upsert({
      where: { leadId },
      create: { leadId, ...fields },
      update: fields,
    });

    await db.leadLog.create({
      data: {
        leadId,
        action: "HEARING_SAVED",
        detail: "ヒアリングシートを更新",
        staffName: user.name || user.email,
      },
    });

    logAudit({
      action: "hearing_sheet_saved",
      email: user.email,
      name: user.name,
      entity: "hearing_sheet",
      entityId: leadId,
    });

    revalidatePath("/dashboard/leads/list");
    return {};
  } catch (e) {
    console.error("[hearing] Save error:", e);
    return { error: "保存に失敗しました" };
  }
}

// ----------------------------------------------------------------
// 顧客用：ヒアリングシート保存（新規作成 or IDで更新）
// ----------------------------------------------------------------
export async function saveCustomerHearingSheet(
  customerId: string,
  data: HearingData,
  sheetId?: string
): Promise<{ error?: string }> {
  try {
    const user = await requireAuth();
    const fields = toFields(data);

    if (sheetId) {
      await db.hearingSheet.update({
        where: { id: sheetId },
        data: fields,
      });
    } else {
      await db.hearingSheet.create({
        data: { customerId, ...fields },
      });
    }

    logAudit({
      action: "hearing_sheet_saved",
      email: user.email,
      name: user.name,
      entity: "customer_hearing",
      entityId: customerId,
    });

    revalidatePath(`/dashboard/customers/${customerId}`);
    return {};
  } catch (e) {
    console.error("[hearing] Customer save error:", e);
    return { error: "保存に失敗しました" };
  }
}

// ----------------------------------------------------------------
// 商談用：ヒアリングシート保存（upsert）
// ----------------------------------------------------------------
export async function saveDealHearingSheet(
  dealId: string,
  data: HearingData
): Promise<{ error?: string }> {
  try {
    const user = await requireAuth();
    const fields = toFields(data);

    await db.hearingSheet.upsert({
      where: { dealId },
      create: { dealId, ...fields },
      update: fields,
    });

    logAudit({
      action: "hearing_sheet_saved",
      email: user.email,
      name: user.name,
      entity: "deal_hearing",
      entityId: dealId,
    });

    revalidatePath(`/dashboard/deals/${dealId}`);
    return {};
  } catch (e) {
    console.error("[hearing] Deal save error:", e);
    return { error: "保存に失敗しました" };
  }
}

// ----------------------------------------------------------------
// リード→顧客転換時にヒアリングを引き継ぐ
// ----------------------------------------------------------------
export async function copyHearingToCustomer(
  leadId: string,
  customerId: string
): Promise<void> {
  const existing = await db.hearingSheet.findUnique({ where: { leadId } });
  if (!existing) return;

  const { id: _, leadId: __, customerId: ___, dealId: ____, createdAt: _____, updatedAt: ______, ...fields } = existing;
  await db.hearingSheet.create({
    data: { customerId, ...fields },
  });
}

// ----------------------------------------------------------------
// ヒアリングシートから商談を作成する
// ----------------------------------------------------------------
export async function convertHearingToDeal(
  hearingSheetId: string
): Promise<{ dealId?: string; error?: string }> {
  const info = await getSessionInfo();
  if (!info) return { error: "ログインが必要です" };
  if (!info.branchId) return { error: "拠点が割り当てられていません" };
  if (info.role === "USER") return { error: "権限がありません" };

  try {
    // ヒアリングシート取得
    const sheet = await db.hearingSheet.findUnique({
      where: { id: hearingSheetId },
    });
    if (!sheet) return { error: "ヒアリングシートが見つかりません" };
    if (sheet.dealId) return { error: "このヒアリングシートは既に商談化されています" };
    if (!sheet.customerId) return { error: "顧客に紐づいていないヒアリングシートです" };

    // 顧客名を取得
    const customer = await db.customer.findUnique({
      where: { id: sheet.customerId },
      select: { name: true },
    });
    if (!customer) return { error: "顧客が見つかりません" };

    // タイトル生成: 顧客名 + 興味のあるサービス
    const serviceLabels = (sheet.interestedServices ?? [])
      .map((v) => INTERESTED_SERVICE_OPTIONS.find((o) => o.value === v)?.label)
      .filter(Boolean);
    const title = serviceLabels.length > 0
      ? `${customer.name} ${serviceLabels.join(" / ")}`
      : customer.name;

    // 見積金額: 動画制作が含まれていればvideoBudget、なければmonthlyAdBudget
    const hasVideo = (sheet.interestedServices ?? []).includes("video_production");
    let amount: number | null = null;
    if (hasVideo && sheet.videoBudget) {
      amount = VIDEO_BUDGET_TO_AMOUNT[sheet.videoBudget] ?? null;
    } else if (sheet.monthlyAdBudget) {
      amount = MONTHLY_BUDGET_TO_AMOUNT[sheet.monthlyAdBudget] ?? null;
    }

    // 受注確度
    const probability = sheet.temperature
      ? TEMPERATURE_TO_PROBABILITY[sheet.temperature] ?? null
      : null;

    // 受注予定日
    let expectedCloseDate: Date | null = null;
    if (sheet.desiredTimeline) {
      const days = TIMELINE_TO_DAYS[sheet.desiredTimeline];
      if (days !== null && days !== undefined) {
        expectedCloseDate = new Date();
        expectedCloseDate.setDate(expectedCloseDate.getDate() + days);
      }
    }

    // 課題ラベル
    const challengeLabel = sheet.primaryChallenge
      ? PRIMARY_CHALLENGE_OPTIONS.find((o) => o.value === sheet.primaryChallenge)?.label
      : null;

    // メモ生成
    const notesParts: string[] = ["ヒアリングシートから商談化"];
    if (challengeLabel) notesParts.push(`課題: ${challengeLabel}`);
    if (sheet.challengeDetail) notesParts.push(sheet.challengeDetail);

    // トランザクションで商談作成 + ヒアリングシート紐づけ
    const deal = await db.$transaction(async (tx) => {
      const newDeal = await tx.deal.create({
        data: {
          title: title.slice(0, 100),
          status: "QUALIFYING" as DealStatus,
          amount,
          probability,
          expectedCloseDate,
          notes: notesParts.join("。"),
          customerId: sheet.customerId!,
          branchId: info.branchId!,
          createdById: info.userId,
        },
      });

      await tx.hearingSheet.update({
        where: { id: hearingSheetId },
        data: { dealId: newDeal.id },
      });

      return newDeal;
    });

    logAudit({
      action: "deal_created_from_hearing",
      email: info.email,
      name: info.staffName,
      entity: "deal",
      entityId: deal.id,
      detail: `ヒアリングシートから商談化: ${title}`,
    });

    // 通知
    const capturedDealId = deal.id;
    const capturedCustomer = customer.name;
    const capturedTitle = title.slice(0, 100);
    const capturedStaffName = info.staffName;
    after(async () => {
      const statusLabel =
        DEAL_STATUS_OPTIONS.find((o) => o.value === "QUALIFYING")?.label ?? "検討中";
      await sendDealNotification({
        eventType: "DEAL_CREATED",
        dealId: capturedDealId,
        customerName: capturedCustomer,
        dealTitle: capturedTitle,
        statusLabel,
        amount,
        staffName: capturedStaffName,
      });
    });

    revalidatePath(`/dashboard/customers/${sheet.customerId}`);
    revalidatePath("/dashboard/deals");

    return { dealId: deal.id };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error("[convertHearingToDeal] Error:", msg);
    return { error: "商談化に失敗しました" };
  }
}
