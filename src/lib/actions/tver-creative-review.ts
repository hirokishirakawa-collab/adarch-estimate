"use server";

import { redirect, notFound } from "next/navigation";
import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import type { Prisma } from "@/generated/prisma/client";
import { getSessionInfo, getBranchFilter } from "@/lib/session";
import { logAudit } from "@/lib/audit";

// ---------------------------------------------------------------
// クリエイティブ考査申請を作成する
// ---------------------------------------------------------------
export async function createTverCreativeReview(
  _prev: { error?: string } | null,
  formData: FormData
): Promise<{ error?: string }> {
  const info = await getSessionInfo();
  if (!info) return { error: "ログインが必要です" };

  const advertiserId  = (formData.get("advertiserId")  as string)?.trim();
  const projectName   = (formData.get("projectName")   as string)?.trim();
  const numberOfRaw   = (formData.get("numberOfAssets") as string)?.trim();
  const driveUrl      = (formData.get("driveUrl")      as string)?.trim();
  const remarks       = (formData.get("remarks")       as string)?.trim() || null;

  if (!advertiserId) return { error: "広告主を選択してください" };
  if (!projectName)  return { error: "プロジェクト名を入力してください" };
  if (!numberOfRaw || isNaN(Number(numberOfRaw)) || Number(numberOfRaw) <= 0)
    return { error: "本数を正しく入力してください" };
  if (!driveUrl) return { error: "データ格納リンクを入力してください" };

  const advertiser = await db.advertiserReview.findFirst({
    where: { id: advertiserId, status: "APPROVED" },
    select: { id: true },
  });
  if (!advertiser) return { error: "選択された広告主は承認済みではありません" };

  try {
    const created = await db.tverCreativeReview.create({
      data: {
        advertiserId,
        projectName,
        numberOfAssets: parseInt(numberOfRaw, 10),
        driveUrl,
        remarks,
        createdById:  info.userId,
        creatorEmail: info.email,
        branchId:     info.branchId as string,
      },
    });
    logAudit({ action: "tver_creative_review_created", email: info.email, name: info.staffName, entity: "tver_creative_review", entityId: created.id, detail: projectName });
  } catch (e) {
    console.error("[createTverCreativeReview] DB error:", e instanceof Error ? e.message : e);
    return { error: "保存に失敗しました" };
  }

  revalidatePath("/dashboard/tver-creative-review");
  redirect("/dashboard/tver-creative-review");
}

// ---------------------------------------------------------------
// ステータス更新（管理者のみ）
// ---------------------------------------------------------------
export async function updateTverCreativeReviewStatus(
  reviewId: string,
  _prev: { error?: string } | null,
  formData: FormData
): Promise<{ error?: string }> {
  const info = await getSessionInfo();
  if (!info) return { error: "ログインが必要です" };
  if (info.role !== "ADMIN") return { error: "管理者のみ操作できます" };

  const status     = (formData.get("status")     as string)?.trim();
  const reviewNote = (formData.get("reviewNote") as string)?.trim() || null;

  if (!status) return { error: "ステータスを選択してください" };

  const existing = await db.tverCreativeReview.findUnique({
    where: { id: reviewId },
    select: { id: true, projectName: true, status: true },
  });
  if (!existing) return { error: "対象の申請が見つかりません" };

  try {
    await db.tverCreativeReview.update({
      where: { id: reviewId },
      data: {
        status:       status as Prisma.TverCreativeReviewUpdateInput["status"],
        reviewNote,
        reviewedAt:   new Date(),
        reviewedById: info.userId,
      },
    });
    logAudit({ action: "tver_creative_review_status_updated", email: info.email, name: info.staffName, entity: "tver_creative_review", entityId: reviewId, detail: `${existing.projectName}: ${status}` });
  } catch (e) {
    console.error("[updateTverCreativeReviewStatus] DB error:", e instanceof Error ? e.message : e);
    return { error: "更新に失敗しました" };
  }

  revalidatePath(`/dashboard/tver-creative-review/${reviewId}`);
  revalidatePath("/dashboard/tver-creative-review");
  redirect(`/dashboard/tver-creative-review/${reviewId}`);
}

// ---------------------------------------------------------------
// 一覧取得
// ---------------------------------------------------------------
export async function getTverCreativeReviewList() {
  try {
    const info = await getSessionInfo();
    if (!info) return { reviews: [] as Awaited<ReturnType<typeof fetchList>>, role: "USER" as import("@/types/roles").UserRole };

    const where: Prisma.TverCreativeReviewWhereInput = getBranchFilter(info);

    return { reviews: await fetchList(where), role: info.role };
  } catch (e) {
    console.error("[getTverCreativeReviewList] error:", e instanceof Error ? e.message : e);
    return { reviews: [] as Awaited<ReturnType<typeof fetchList>>, role: "USER" as import("@/types/roles").UserRole };
  }
}

async function fetchList(where: Prisma.TverCreativeReviewWhereInput) {
  return db.tverCreativeReview.findMany({
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
export async function getTverCreativeReviewById(id: string) {
  try {
    const info = await getSessionInfo();
    if (!info) notFound();

    const where: Prisma.TverCreativeReviewWhereInput = { id, ...getBranchFilter(info) };

    const review = await db.tverCreativeReview.findFirst({
      where,
      include: {
        advertiser: { select: { id: true, name: true } },
        createdBy:  { select: { name: true } },
        branch:     { select: { name: true } },
      },
    });

    if (!review) notFound();
    return { review, role: info.role };
  } catch (e) {
    if (typeof e === "object" && e !== null && "digest" in e) throw e;
    console.error("[getTverCreativeReviewById] error:", e instanceof Error ? e.message : e);
    notFound();
  }
}

// ---------------------------------------------------------------
// 削除（管理者のみ）
// ---------------------------------------------------------------
export async function deleteTverCreativeReview(id: string): Promise<void> {
  const info = await getSessionInfo();
  if (!info || info.role !== "ADMIN") return;

  try {
    await db.tverCreativeReview.delete({ where: { id } });
    logAudit({ action: "tver_creative_review_deleted", email: info.email, name: info.staffName, entity: "tver_creative_review", entityId: id });
  } catch (e) {
    console.error("[deleteTverCreativeReview] DB error:", e instanceof Error ? e.message : e);
    return;
  }

  revalidatePath("/dashboard/tver-creative-review");
  redirect("/dashboard/tver-creative-review");
}
