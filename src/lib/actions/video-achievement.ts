"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { getSessionInfo } from "@/lib/session";
import type { DealStatus, CustomerStatus } from "@/generated/prisma/client";

// ---------------------------------------------------------------
// 手動で動画実績を登録する
// ---------------------------------------------------------------
export async function createVideoAchievement(
  _prev: { error?: string } | null,
  formData: FormData
): Promise<{ error?: string }> {
  const info = await getSessionInfo();
  if (!info) return { error: "ログインが必要です" };
  const { userId } = info;

  const companyName       = (formData.get("companyName") as string)?.trim();
  const prefecture        = (formData.get("prefecture") as string)?.trim();
  const productionCompany = (formData.get("productionCompany") as string)?.trim();

  if (!companyName)       return { error: "企業名は必須です" };
  if (!prefecture)        return { error: "都道府県は必須です" };
  if (!productionCompany) return { error: "制作会社名は必須です" };

  const industry       = (formData.get("industry") as string)?.trim() || "その他";
  const videoType      = (formData.get("videoType") as string)?.trim() || "OTHER";
  const referenceUrl   = (formData.get("referenceUrl") as string)?.trim() || null;
  const contentSummary = (formData.get("contentSummary") as string)?.trim() || null;

  try {
    await db.videoAchievement.create({
      data: {
        companyName,
        prefecture,
        industry,
        productionCompany,
        videoType,
        referenceUrl,
        contentSummary,
        createdById: userId,
      },
    });
  } catch (e: unknown) {
    const err = e as { code?: string };
    if (err.code === "P2002") {
      return { error: "この組み合わせ（企業名＋制作会社）は既に登録済みです" };
    }
    console.error("[createVideoAchievement]", e);
    return { error: "保存に失敗しました。しばらく経ってから再試行してください" };
  }

  revalidatePath("/dashboard/video-achievements");
  redirect("/dashboard/video-achievements");
}

// ---------------------------------------------------------------
// 動画実績を削除する（ADMIN限定）
// ---------------------------------------------------------------
export async function deleteVideoAchievement(
  id: string
): Promise<{ error?: string }> {
  const info = await getSessionInfo();
  if (!info) return { error: "ログインが必要です" };
  if (info.role !== "ADMIN") return { error: "ADMIN権限が必要です" };

  try {
    await db.videoAchievement.delete({ where: { id } });
  } catch (e) {
    console.error("[deleteVideoAchievement]", e);
    return { error: "削除に失敗しました" };
  }

  revalidatePath("/dashboard/video-achievements");
  return {};
}

// ---------------------------------------------------------------
// 動画実績から攻略商談を開始する（核心）
// ---------------------------------------------------------------
export async function startAttackFromAchievement(
  achievementId: string
): Promise<{
  dealId?: string;
  customerId?: string;
  isNewCustomer?: boolean;
  error?: string;
}> {
  const info = await getSessionInfo();
  if (!info) return { error: "ログインが必要です" };
  const { branchId, userId } = info;

  const achievement = await db.videoAchievement.findUnique({
    where: { id: achievementId },
  });
  if (!achievement) return { error: "実績データが見つかりません" };

  // 顧客を名前で検索（拠点スコープ内）
  const existing = await db.customer.findFirst({
    where: {
      name: achievement.companyName,
      branchId,
    },
  });

  let customerId: string;
  let isNewCustomer = false;

  if (existing) {
    customerId = existing.id;
  } else {
    // 新規顧客として登録
    const newCustomer = await db.customer.create({
      data: {
        name:       achievement.companyName,
        prefecture: achievement.prefecture,
        industry:   achievement.industry,
        status:     "PROSPECT" as CustomerStatus,
        branchId,
      },
    });
    customerId = newCustomer.id;
    isNewCustomer = true;
  }

  // 攻略商談を作成
  const deal = await db.deal.create({
    data: {
      title:      `【動画実績攻略】${achievement.companyName}`,
      status:     "PROSPECTING" as DealStatus,
      notes:      achievement.contentSummary ?? null,
      customerId,
      branchId,
      createdById: userId,
    },
  });

  // 実績を処理済みにする
  await db.videoAchievement.update({
    where: { id: achievementId },
    data:  { isProcessed: true },
  });

  revalidatePath("/dashboard/video-achievements");
  revalidatePath("/dashboard/deals");

  return { dealId: deal.id, customerId, isNewCustomer };
}

// ---------------------------------------------------------------
// スクレイピング結果を一括保存する
// ---------------------------------------------------------------
export interface AchievementInput {
  companyName:       string;
  prefecture:        string;
  industry:          string;
  productionCompany: string;
  videoType:         string;
  referenceUrl:      string | null;
  contentSummary:    string | null;
}

export async function bulkSaveAchievements(
  items: AchievementInput[]
): Promise<{ saved: number; skipped: number; error?: string }> {
  const info = await getSessionInfo();
  if (!info) return { saved: 0, skipped: 0, error: "ログインが必要です" };
  const { userId } = info;

  let saved = 0;
  let skipped = 0;

  for (const item of items) {
    try {
      await db.videoAchievement.upsert({
        where: {
          companyName_productionCompany: {
            companyName:       item.companyName,
            productionCompany: item.productionCompany,
          },
        },
        update: {
          contentSummary: item.contentSummary,
          referenceUrl:   item.referenceUrl,
        },
        create: {
          companyName:       item.companyName,
          prefecture:        item.prefecture,
          industry:          item.industry,
          productionCompany: item.productionCompany,
          videoType:         item.videoType,
          referenceUrl:      item.referenceUrl,
          contentSummary:    item.contentSummary,
          createdById:       userId,
        },
      });
      saved++;
    } catch {
      skipped++;
    }
  }

  revalidatePath("/dashboard/video-achievements");
  return { saved, skipped };
}
