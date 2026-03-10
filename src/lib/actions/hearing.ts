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

// ----------------------------------------------------------------
// ヒアリングシート取得
// ----------------------------------------------------------------
export async function getHearingSheet(leadId: string) {
  await requireAuth();
  return db.hearingSheet.findUnique({ where: { leadId } });
}

// ----------------------------------------------------------------
// ヒアリングシート保存（upsert）
// ----------------------------------------------------------------
export async function saveHearingSheet(
  leadId: string,
  data: {
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
    temperature?: string | null;
    nextAction?: string | null;
    nextActionDate?: string | null;
  }
): Promise<{ error?: string }> {
  try {
    const user = await requireAuth();

    const nextActionDate = data.nextActionDate
      ? new Date(data.nextActionDate)
      : null;

    await db.hearingSheet.upsert({
      where: { leadId },
      create: {
        leadId,
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
        temperature: data.temperature ?? null,
        nextAction: data.nextAction ?? null,
        nextActionDate,
      },
      update: {
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
        temperature: data.temperature ?? null,
        nextAction: data.nextAction ?? null,
        nextActionDate,
      },
    });

    // 活動ログに記録
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
