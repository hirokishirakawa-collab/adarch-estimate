"use server";

import { redirect, notFound } from "next/navigation";
import { revalidatePath } from "next/cache";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { getMockBranchId } from "@/lib/data/customers";
import {
  sendAdvertiserReviewCreatedNotification,
  sendAdvertiserReviewResultNotification,
} from "@/lib/notifications";
import { validateCorporateNumber } from "@/lib/constants/advertiser-review";
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
// 業態考査申請を作成する
// ---------------------------------------------------------------
export async function createAdvertiserReview(
  _prev: { error?: string } | null,
  formData: FormData
): Promise<{ error?: string }> {
  const info = await getSessionInfo();
  if (!info) return { error: "ログインが必要です" };

  const name                 = (formData.get("name")                 as string)?.trim();
  const websiteUrl           = (formData.get("websiteUrl")           as string)?.trim();
  const corporateNumber      = (formData.get("corporateNumber")      as string)?.trim() || null;
  const hasNoCorporateNumber = formData.get("hasNoCorporateNumber") === "on";
  const productUrl           = (formData.get("productUrl")           as string)?.trim();
  const desiredStartDateRaw  = (formData.get("desiredStartDate")     as string)?.trim() || null;
  const remarks              = (formData.get("remarks")              as string)?.trim() || null;

  // バリデーション
  if (!name)       return { error: "広告主様名を入力してください" };
  if (!websiteUrl) return { error: "企業ページURLを入力してください" };
  if (!productUrl) return { error: "商材サイトURLを入力してください" };

  const corpValidation = validateCorporateNumber(corporateNumber ?? undefined, hasNoCorporateNumber);
  if (corpValidation !== true) return { error: corpValidation };

  const desiredStartDate = desiredStartDateRaw ? new Date(desiredStartDateRaw) : null;
  if (desiredStartDate && isNaN(desiredStartDate.getTime()))
    return { error: "広告展開希望日の形式が正しくありません" };

  let createdId: string;
  try {
    const created = await db.advertiserReview.create({
      data: {
        name,
        websiteUrl,
        corporateNumber:      hasNoCorporateNumber ? null : corporateNumber,
        hasNoCorporateNumber,
        productUrl,
        desiredStartDate,
        remarks,
        createdById:  info.userId,
        creatorEmail: info.email,
        branchId:     info.branchId,
      },
    });
    createdId = created.id;
  } catch (e) {
    console.error("[createAdvertiserReview] DB error:", e instanceof Error ? e.message : e);
    return { error: "保存に失敗しました" };
  }

  // 管理者へ通知
  sendAdvertiserReviewCreatedNotification({
    reviewId:    createdId,
    advertiserName: name,
    staffName:   info.staffName,
    productUrl,
  }).catch((e) => console.error("[createAdvertiserReview] notification error:", e));

  revalidatePath("/dashboard/tver-review");
  redirect("/dashboard/tver-review");
}

// ---------------------------------------------------------------
// ステータスを更新する（管理者のみ）
// ---------------------------------------------------------------
export async function updateAdvertiserReviewStatus(
  reviewId: string,
  _prev: { error?: string } | null,
  formData: FormData
): Promise<{ error?: string }> {
  const info = await getSessionInfo();
  if (!info) return { error: "ログインが必要です" };
  if (info.role !== "ADMIN") return { error: "管理者のみ操作できます" };

  const status    = (formData.get("status")     as string)?.trim();
  const reviewNote = (formData.get("reviewNote") as string)?.trim() || null;

  if (!status) return { error: "ステータスを選択してください" };

  const existing = await db.advertiserReview.findUnique({
    where: { id: reviewId },
    select: { id: true, name: true, creatorEmail: true, status: true },
  });
  if (!existing) return { error: "対象の申請が見つかりません" };

  try {
    await db.advertiserReview.update({
      where: { id: reviewId },
      data: {
        status:      status as Prisma.AdvertiserReviewUpdateInput["status"],
        reviewNote,
        reviewedAt:  new Date(),
        reviewedById: info.userId,
      },
    });
  } catch (e) {
    console.error("[updateAdvertiserReviewStatus] DB error:", e instanceof Error ? e.message : e);
    return { error: "更新に失敗しました" };
  }

  // 申請者へ結果通知（ステータスが変わった場合のみ）
  if (status !== existing.status && (status === "APPROVED" || status === "REJECTED")) {
    sendAdvertiserReviewResultNotification({
      reviewId,
      advertiserName: existing.name,
      status:         status as "APPROVED" | "REJECTED",
      reviewNote,
      creatorEmail:   existing.creatorEmail,
    }).catch((e) => console.error("[updateAdvertiserReviewStatus] notification error:", e));
  }

  revalidatePath(`/dashboard/tver-review/${reviewId}`);
  revalidatePath("/dashboard/tver-review");
  redirect(`/dashboard/tver-review/${reviewId}`);
}

// ---------------------------------------------------------------
// 一覧取得
// ---------------------------------------------------------------
export async function getAdvertiserReviewList() {
  try {
    const info = await getSessionInfo();
    if (!info) return { reviews: [] as Awaited<ReturnType<typeof fetchList>>, role: "USER" as UserRole };

    const where: Prisma.AdvertiserReviewWhereInput =
      info.role === "ADMIN" ? {} : { branchId: info.branchId };

    const reviews = await fetchList(where);
    return { reviews, role: info.role };
  } catch (e) {
    console.error("[getAdvertiserReviewList] error:", e instanceof Error ? e.message : e);
    return { reviews: [] as Awaited<ReturnType<typeof fetchList>>, role: "USER" as UserRole };
  }
}

async function fetchList(where: Prisma.AdvertiserReviewWhereInput) {
  return db.advertiserReview.findMany({
    where,
    orderBy: { createdAt: "desc" },
    include: {
      createdBy: { select: { name: true } },
      branch:    { select: { name: true } },
    },
  });
}

// ---------------------------------------------------------------
// 単件取得
// ---------------------------------------------------------------
export async function getAdvertiserReviewById(reviewId: string) {
  try {
    const info = await getSessionInfo();
    if (!info) notFound();

    const where: Prisma.AdvertiserReviewWhereInput =
      info.role === "ADMIN"
        ? { id: reviewId }
        : { id: reviewId, branchId: info.branchId };

    const review = await db.advertiserReview.findFirst({
      where,
      include: {
        createdBy:  { select: { name: true, email: true } },
        reviewedBy: { select: { name: true } },
        branch:     { select: { name: true } },
      },
    });

    if (!review) notFound();
    return { review, role: info.role };
  } catch (e) {
    if (typeof e === "object" && e !== null && "digest" in e) throw e;
    console.error("[getAdvertiserReviewById] error:", e instanceof Error ? e.message : e);
    notFound();
  }
}

// ---------------------------------------------------------------
// 削除（管理者のみ）
// ---------------------------------------------------------------
export async function deleteAdvertiserReview(reviewId: string): Promise<{ error?: string }> {
  const info = await getSessionInfo();
  if (!info) return { error: "ログインが必要です" };
  if (info.role !== "ADMIN") return { error: "管理者のみ操作できます" };

  try {
    await db.advertiserReview.delete({ where: { id: reviewId } });
  } catch (e) {
    console.error("[deleteAdvertiserReview] DB error:", e instanceof Error ? e.message : e);
    return { error: "削除に失敗しました" };
  }

  revalidatePath("/dashboard/tver-review");
  redirect("/dashboard/tver-review");
}

// ---------------------------------------------------------------
// APPROVED 広告主一覧（TVer配信申請フォーム用）
// ---------------------------------------------------------------
export async function getApprovedAdvertisers() {
  try {
    const info = await getSessionInfo();
    if (!info) return [];

    const where: Prisma.AdvertiserReviewWhereInput =
      info.role === "ADMIN"
        ? { status: "APPROVED" }
        : { status: "APPROVED", branchId: info.branchId };

    return db.advertiserReview.findMany({
      where,
      orderBy: { name: "asc" },
      select: { id: true, name: true, productUrl: true },
    });
  } catch (e) {
    console.error("[getApprovedAdvertisers] error:", e instanceof Error ? e.message : e);
    return [];
  }
}

// ---------------------------------------------------------------
// APPROVED 広告主の詳細取得（「取得」ボタン用）
// ---------------------------------------------------------------
export async function getApprovedAdvertiserById(id: string) {
  try {
    return await db.advertiserReview.findFirst({
      where: { id, status: "APPROVED" },
      select: {
        id: true,
        name: true,
        websiteUrl: true,
        productUrl: true,
        corporateNumber: true,
        hasNoCorporateNumber: true,
      },
    });
  } catch (e) {
    console.error("[getApprovedAdvertiserById] error:", e instanceof Error ? e.message : e);
    return null;
  }
}
