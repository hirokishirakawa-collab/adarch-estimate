"use server";

import { redirect, notFound } from "next/navigation";
import { revalidatePath } from "next/cache";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { getMockBranchId } from "@/lib/data/customers";
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
    await db.tverCreativeReview.create({
      data: {
        advertiserId,
        projectName,
        numberOfAssets: parseInt(numberOfRaw, 10),
        driveUrl,
        remarks,
        createdById:  info.userId,
        creatorEmail: info.email,
        branchId:     info.branchId,
      },
    });
  } catch (e) {
    console.error("[createTverCreativeReview] DB error:", e instanceof Error ? e.message : e);
    return { error: "保存に失敗しました" };
  }

  revalidatePath("/dashboard/tver-creative-review");
  redirect("/dashboard/tver-creative-review");
}

// ---------------------------------------------------------------
// 一覧取得
// ---------------------------------------------------------------
export async function getTverCreativeReviewList() {
  try {
    const info = await getSessionInfo();
    if (!info) return { reviews: [] as Awaited<ReturnType<typeof fetchList>>, role: "USER" as UserRole };

    const where: Prisma.TverCreativeReviewWhereInput =
      info.role === "ADMIN" ? {} : { branchId: info.branchId };

    return { reviews: await fetchList(where), role: info.role };
  } catch (e) {
    console.error("[getTverCreativeReviewList] error:", e instanceof Error ? e.message : e);
    return { reviews: [] as Awaited<ReturnType<typeof fetchList>>, role: "USER" as UserRole };
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

    const where: Prisma.TverCreativeReviewWhereInput =
      info.role === "ADMIN"
        ? { id }
        : { id, branchId: info.branchId };

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
  } catch (e) {
    console.error("[deleteTverCreativeReview] DB error:", e instanceof Error ? e.message : e);
    return;
  }

  revalidatePath("/dashboard/tver-creative-review");
  redirect("/dashboard/tver-creative-review");
}
