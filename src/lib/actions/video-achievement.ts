"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { getSessionInfo } from "@/lib/session";
import { logAudit } from "@/lib/audit";
import type { LeadSource } from "@/generated/prisma/client";

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
    const created = await db.videoAchievement.create({
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
    logAudit({ action: "video_achievement_created", email: info.email, name: info.staffName, entity: "video_achievement", entityId: created.id, detail: companyName });
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
    logAudit({ action: "video_achievement_deleted", email: info.email, name: info.staffName, entity: "video_achievement", entityId: id });
  } catch (e) {
    console.error("[deleteVideoAchievement]", e);
    return { error: "削除に失敗しました" };
  }

  revalidatePath("/dashboard/video-achievements");
  return {};
}

// ---------------------------------------------------------------
// 動画実績を一括削除する（ADMIN限定）
// ---------------------------------------------------------------
export async function bulkDeleteVideoAchievements(
  ids: string[]
): Promise<{ deleted: number; error?: string }> {
  const info = await getSessionInfo();
  if (!info) return { deleted: 0, error: "ログインが必要です" };
  if (info.role !== "ADMIN") return { deleted: 0, error: "ADMIN権限が必要です" };

  if (ids.length === 0) return { deleted: 0 };

  try {
    const result = await db.videoAchievement.deleteMany({
      where: { id: { in: ids } },
    });
    logAudit({
      action: "video_achievement_bulk_deleted",
      email: info.email,
      name: info.staffName,
      entity: "video_achievement",
      entityId: ids.join(","),
      detail: `${result.count}件削除`,
    });
    revalidatePath("/dashboard/video-achievements");
    return { deleted: result.count };
  } catch (e) {
    console.error("[bulkDeleteVideoAchievements]", e);
    return { deleted: 0, error: "一括削除に失敗しました" };
  }
}

// ---------------------------------------------------------------
// 動画実績から攻略を開始する → リード管理に登録
// ---------------------------------------------------------------
export async function startAttackFromAchievement(
  achievementId: string
): Promise<{
  leadId?: string;
  isNewLead?: boolean;
  error?: string;
}> {
  const info = await getSessionInfo();
  if (!info) return { error: "ログインが必要です" };
  const { userId } = info;

  const achievement = await db.videoAchievement.findUnique({
    where: { id: achievementId },
  });
  if (!achievement) return { error: "実績データが見つかりません" };

  // リードを名前で検索（重複防止）
  const existing = await db.lead.findFirst({
    where: { name: achievement.companyName },
  });

  let leadId: string;
  let isNewLead = false;

  if (existing) {
    leadId = existing.id;
  } else {
    const newLead = await db.lead.create({
      data: {
        name:        achievement.companyName,
        address:     achievement.prefecture,
        industry:    achievement.industry,
        source:      "MANUAL" as LeadSource,
        memo:        achievement.contentSummary
          ? `【競合実績から攻略】${achievement.contentSummary}`
          : "【競合実績から攻略】",
        websiteUrl:  achievement.referenceUrl ?? null,
        createdById: userId,
      },
    });
    leadId = newLead.id;
    isNewLead = true;
  }

  // 実績を処理済みにする
  await db.videoAchievement.update({
    where: { id: achievementId },
    data:  { isProcessed: true },
  });

  revalidatePath("/dashboard/video-achievements");
  revalidatePath("/dashboard/leads/list");

  return { leadId, isNewLead };
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
  publishedAt:       string | null;
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
          publishedAt:       item.publishedAt,
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
