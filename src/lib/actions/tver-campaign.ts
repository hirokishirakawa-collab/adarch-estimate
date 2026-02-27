"use server";

import { redirect, notFound } from "next/navigation";
import { revalidatePath } from "next/cache";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { getMockBranchId } from "@/lib/data/customers";
import { sendTverCampaignCreatedEmail } from "@/lib/resend";
import type { UserRole } from "@/types/roles";
import type { Prisma } from "@/generated/prisma/client";

// ---------------------------------------------------------------
// 共通: セッション情報取得
// ---------------------------------------------------------------
async function getSessionInfo() {
  const session = await auth();
  if (!session?.user) return null;

  const role     = (session.user.role ?? "MANAGER") as UserRole;
  const email    = session.user.email ?? "";
  const branchId = getMockBranchId(email, role) ?? "branch_hq";

  const dbRole: "ADMIN" | "MANAGER" | "USER" =
    role === "ADMIN" ? "ADMIN" : role === "MANAGER" ? "MANAGER" : "USER";

  const user = await db.user.upsert({
    where:  { email },
    update: {},
    create: {
      email,
      name:     session.user.name ?? email,
      role:     dbRole,
      branchId: getMockBranchId(email, role),
    },
    select: { id: true, name: true },
  });

  return { role, email, branchId, userId: user.id, staffName: user.name ?? email };
}

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

  // バリデーション
  if (!advertiserId)   return { error: "広告主を選択してください" };
  if (!campaignName)   return { error: "キャンペーン名を入力してください" };
  if (!budgetRaw || isNaN(Number(budgetRaw)) || Number(budgetRaw) <= 0)
    return { error: "広告予算を正しく入力してください" };
  if (!startDateRaw)   return { error: "配信開始日を入力してください" };
  if (!endDateRaw)     return { error: "配信終了日を入力してください" };
  if (!budgetType)     return { error: "予算タイプを選択してください" };

  const startDate = new Date(startDateRaw);
  const endDate   = new Date(endDateRaw);
  if (isNaN(startDate.getTime())) return { error: "配信開始日の形式が正しくありません" };
  if (isNaN(endDate.getTime()))   return { error: "配信終了日の形式が正しくありません" };
  if (endDate <= startDate)       return { error: "配信終了日は開始日より後に設定してください" };

  if (landingPageUrl) {
    try { new URL(landingPageUrl); }
    catch { return { error: "リンク先LP URLの形式が正しくありません" }; }
  }

  // APPROVED 広告主かどうかを DB で再確認（二重ガード）
  const advertiser = await db.advertiserReview.findFirst({
    where: { id: advertiserId, status: "APPROVED" },
    select: { id: true, name: true },
  });
  if (!advertiser) return { error: "選択された広告主は承認済みではありません" };

  const freqCapCount = freqCapCountRaw ? parseInt(freqCapCountRaw, 10) : null;
  if (freqCapCountRaw && (isNaN(freqCapCount!) || freqCapCount! <= 0))
    return { error: "フリークエンシーキャップの回数を正しく入力してください" };

  let createdId: string;
  try {
    const created = await db.tverCampaign.create({
      data: {
        advertiserId,
        campaignName,
        budget:       budgetRaw,
        startDate,
        endDate,
        budgetType:   budgetType     as Prisma.TverCampaignCreateInput["budgetType"],
        freqCapUnit:  freqCapUnit    as Prisma.TverCampaignCreateInput["freqCapUnit"] ?? null,
        freqCapCount: freqCapCount   ?? null,
        companionMobile: companionMobile as Prisma.TverCampaignCreateInput["companionMobile"],
        companionPc:     companionPc     as Prisma.TverCampaignCreateInput["companionPc"],
        landingPageUrl:  landingPageUrl  ?? null,
        status:       "SUBMITTED",
        createdById:  info.userId,
        creatorEmail: info.email,
        branchId:     info.branchId,
      },
    });
    createdId = created.id;
  } catch (e) {
    console.error("[createTverCampaign] DB error:", e instanceof Error ? e.message : e);
    return { error: "保存に失敗しました" };
  }

  // Resend で管理者へ通知
  const fmtDate = (d: Date) =>
    new Intl.DateTimeFormat("ja-JP", { dateStyle: "long" }).format(d);
  const budget = `¥${Number(budgetRaw).toLocaleString("ja-JP")}`;

  sendTverCampaignCreatedEmail({
    campaignId:     createdId,
    campaignName,
    advertiserName: advertiser.name,
    budget,
    startDate:      fmtDate(startDate),
    endDate:        fmtDate(endDate),
    staffName:      info.staffName,
  }).catch((e) => console.error("[createTverCampaign] email error:", e));

  revalidatePath("/dashboard/tver-campaign");
  redirect("/dashboard/tver-campaign");
}

// ---------------------------------------------------------------
// 削除（管理者のみ）
// ---------------------------------------------------------------
export async function deleteTverCampaign(campaignId: string): Promise<void> {
  const info = await getSessionInfo();
  if (!info || info.role !== "ADMIN") return;

  try {
    await db.tverCampaign.delete({ where: { id: campaignId } });
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
    if (!info) return { campaigns: [] as Awaited<ReturnType<typeof fetchList>>, role: "USER" as UserRole };

    const where: Prisma.TverCampaignWhereInput =
      info.role === "ADMIN" ? {} : { branchId: info.branchId };

    const campaigns = await fetchList(where);
    return { campaigns, role: info.role };
  } catch (e) {
    console.error("[getTverCampaignList] error:", e instanceof Error ? e.message : e);
    return { campaigns: [] as Awaited<ReturnType<typeof fetchList>>, role: "USER" as UserRole };
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

    const where: Prisma.TverCampaignWhereInput =
      info.role === "ADMIN"
        ? { id: campaignId }
        : { id: campaignId, branchId: info.branchId };

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
