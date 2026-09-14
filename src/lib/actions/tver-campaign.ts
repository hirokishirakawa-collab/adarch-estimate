"use server";

import { redirect, notFound } from "next/navigation";
import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import type { Prisma } from "@/generated/prisma/client";
import { getSessionInfo, getBranchFilter } from "@/lib/session";
import { logAudit } from "@/lib/audit";
import { createTverCampaignRecord } from "@/lib/tver-campaign/submit";

// ---------------------------------------------------------------
// TVer配信申請を作成する
// ---------------------------------------------------------------
export async function createTverCampaign(
  _prev: { error?: string } | null,
  formData: FormData
): Promise<{ error?: string }> {
  const info = await getSessionInfo();
  if (!info) return { error: "ログインが必要です" };

  // フォームデータ取得
  const advertiserId      = (formData.get("advertiserId")     as string)?.trim();
  const campaignName      = (formData.get("campaignName")     as string)?.trim();
  const budgetRaw         = (formData.get("budget")           as string)?.trim();
  const startDateRaw      = (formData.get("startDate")        as string)?.trim();
  const endDateRaw        = (formData.get("endDate")          as string)?.trim();
  const budgetType        = (formData.get("budgetType")        as string)?.trim();
  const freqCapUnit       = (formData.get("freqCapUnit")       as string)?.trim() || null;
  const freqCapCountRaw   = (formData.get("freqCapCount")      as string)?.trim() || null;
  const companionMobile   = (formData.get("companionMobile")   as string)?.trim() || "NONE";
  const companionPc       = (formData.get("companionPc")       as string)?.trim() || "NONE";
  const landingPageUrl    = (formData.get("landingPageUrl")    as string)?.trim() || null;
  const genderTarget      = (formData.get("genderTarget")      as string)?.trim() || "ALL";
  const areas             = formData.getAll("areas").map((v) => (v as string).trim()).filter(Boolean);
  const settingsRaw       = (formData.get("settings") as string)?.trim() || null;
  let settingsJson: Prisma.InputJsonValue | null = null;
  if (settingsRaw) {
    try { settingsJson = JSON.parse(settingsRaw); } catch { /* ignore invalid JSON */ }
  }

  // 必須項目（形式・承認済み広告主・エリアのチェックと保存・通知は AI連携と共通の createTverCampaignRecord）
  if (!advertiserId)   return { error: "広告主を選択してください" };
  if (!campaignName)   return { error: "キャンペーン名を入力してください" };
  if (!budgetRaw || isNaN(Number(budgetRaw)) || Number(budgetRaw) <= 0)
    return { error: "広告予算を正しく入力してください" };
  if (!startDateRaw)   return { error: "配信開始日を入力してください" };
  if (!endDateRaw)     return { error: "配信終了日を入力してください" };
  if (!budgetType)     return { error: "予算タイプを選択してください" };

  const freqCapCount = freqCapCountRaw ? parseInt(freqCapCountRaw, 10) : null;
  if (freqCapCountRaw && (isNaN(freqCapCount!) || freqCapCount! <= 0))
    return { error: "フリークエンシーキャップの回数を正しく入力してください" };

  const result = await createTverCampaignRecord(
    { userId: info.userId, email: info.email, staffName: info.staffName, branchId: info.branchId as string },
    {
      advertiserId,
      campaignName,
      budget: Number(budgetRaw),
      startDate: new Date(startDateRaw),
      endDate: new Date(endDateRaw),
      budgetType,
      freqCapUnit,
      freqCapCount,
      companionMobile,
      companionPc,
      genderTarget,
      areas,
      landingPageUrl,
      settings: settingsJson,
    }
  );
  if (!result.ok) return { error: result.error };

  revalidatePath("/dashboard/tver-campaign");
  redirect("/dashboard/tver-campaign");
}

// ---------------------------------------------------------------
// ステータス更新（管理者のみ）
// ---------------------------------------------------------------
export async function updateTverCampaignStatus(
  campaignId: string,
  _prev: { error?: string } | null,
  formData: FormData
): Promise<{ error?: string }> {
  const info = await getSessionInfo();
  if (!info) return { error: "ログインが必要です" };
  if (info.role !== "ADMIN") return { error: "管理者のみ操作できます" };

  const status     = (formData.get("status")     as string)?.trim();
  const reviewNote = (formData.get("reviewNote") as string)?.trim() || null;

  if (!status) return { error: "ステータスを選択してください" };

  const existing = await db.tverCampaign.findUnique({
    where: { id: campaignId },
    select: { id: true, campaignName: true, status: true },
  });
  if (!existing) return { error: "対象の申請が見つかりません" };

  try {
    await db.tverCampaign.update({
      where: { id: campaignId },
      data: {
        status:     status as Prisma.TverCampaignUpdateInput["status"],
        reviewNote,
      },
    });
    logAudit({ action: "tver_campaign_status_updated", email: info.email, name: info.staffName, entity: "tver_campaign", entityId: campaignId, detail: `${existing.campaignName}: ${status}` });
  } catch (e) {
    console.error("[updateTverCampaignStatus] DB error:", e instanceof Error ? e.message : e);
    return { error: "更新に失敗しました" };
  }

  revalidatePath(`/dashboard/tver-campaign/${campaignId}`);
  revalidatePath("/dashboard/tver-campaign");
  redirect(`/dashboard/tver-campaign/${campaignId}`);
}

// ---------------------------------------------------------------
// 削除（管理者のみ）
// ---------------------------------------------------------------
export async function deleteTverCampaign(campaignId: string): Promise<void> {
  const info = await getSessionInfo();
  if (!info || info.role !== "ADMIN") return;

  try {
    await db.tverCampaign.delete({ where: { id: campaignId } });
    logAudit({ action: "tver_campaign_deleted", email: info.email, name: info.staffName, entity: "tver_campaign", entityId: campaignId });
  } catch (e) {
    console.error("[deleteTverCampaign] DB error:", e instanceof Error ? e.message : e);
    return;
  }

  revalidatePath("/dashboard/tver-campaign");
  redirect("/dashboard/tver-campaign");
}

// ---------------------------------------------------------------
// 一覧取得
// ---------------------------------------------------------------
export async function getTverCampaignList() {
  try {
    const info = await getSessionInfo();
    if (!info) return { campaigns: [] as Awaited<ReturnType<typeof fetchList>>, role: "USER" as import("@/types/roles").UserRole };

    const where: Prisma.TverCampaignWhereInput = getBranchFilter(info);

    const campaigns = await fetchList(where);
    return { campaigns, role: info.role };
  } catch (e) {
    console.error("[getTverCampaignList] error:", e instanceof Error ? e.message : e);
    return { campaigns: [] as Awaited<ReturnType<typeof fetchList>>, role: "USER" as import("@/types/roles").UserRole };
  }
}

async function fetchList(where: Prisma.TverCampaignWhereInput) {
  return db.tverCampaign.findMany({
    where,
    orderBy: { createdAt: "desc" },
    include: {
      advertiser: { select: { name: true } },
      createdBy:  { select: { name: true } },
      branch:     { select: { name: true } },
    },
  });
}

// ---------------------------------------------------------------
// 単件取得
// ---------------------------------------------------------------
export async function getTverCampaignById(campaignId: string) {
  try {
    const info = await getSessionInfo();
    if (!info) notFound();

    const where: Prisma.TverCampaignWhereInput = { id: campaignId, ...getBranchFilter(info) };

    const campaign = await db.tverCampaign.findFirst({
      where,
      include: {
        advertiser: { select: { id: true, name: true, websiteUrl: true, productUrl: true } },
        createdBy:  { select: { name: true, email: true } },
        branch:     { select: { name: true } },
      },
    });

    if (!campaign) notFound();
    return { campaign, role: info.role };
  } catch (e) {
    if (typeof e === "object" && e !== null && "digest" in e) throw e;
    console.error("[getTverCampaignById] error:", e instanceof Error ? e.message : e);
    notFound();
  }
}
