"use server";

import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { logAudit } from "@/lib/audit";
import { revalidatePath } from "next/cache";

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
