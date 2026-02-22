"use server";

import { redirect, notFound } from "next/navigation";
import { revalidatePath } from "next/cache";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { getMockBranchId } from "@/lib/data/customers";
import { uploadMediaFile } from "@/lib/storage";
import type { UserRole } from "@/types/roles";
import type { Prisma } from "@/generated/prisma/client";

// ---------------------------------------------------------------
// 共通: セッション情報取得（MANAGER以上のみ）
// ---------------------------------------------------------------
async function getSessionInfo() {
  const session = await auth();
  if (!session?.user) return null;

  const role     = (session.user.role ?? "MANAGER") as UserRole;
  const email    = session.user.email ?? "";
  const branchId = getMockBranchId(email, role) ?? "branch_hq";

  // MANAGER未満は拒否
  if (role === "USER") return { error: "権限がありません" } as const;

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
// 媒体依頼を作成する
// ---------------------------------------------------------------
export async function createMediaRequest(
  _prev: { error?: string } | null,
  formData: FormData
): Promise<{ error?: string }> {
  const info = await getSessionInfo();
  if (!info) return { error: "ログインが必要です" };
  if ("error" in info) return { error: info.error };

  const mediaType   = (formData.get("mediaType")   as string)?.trim();
  const mediaName   = (formData.get("mediaName")   as string)?.trim();
  const customerId  = (formData.get("customerId")  as string)?.trim() || null;
  const startDateRaw = (formData.get("startDate")  as string)?.trim() || null;
  const endDateRaw   = (formData.get("endDate")    as string)?.trim() || null;
  const budget      = (formData.get("budget")      as string)?.trim() || null;
  const description = (formData.get("description") as string)?.trim() || null;
  const file        = formData.get("file") as File | null;

  if (!mediaType) return { error: "媒体種別を選択してください" };
  if (!mediaName) return { error: "媒体名を入力してください" };

  const startDate = startDateRaw ? new Date(startDateRaw) : null;
  if (startDate && isNaN(startDate.getTime()))
    return { error: "掲載開始日の形式が正しくありません" };

  const endDate = endDateRaw ? new Date(endDateRaw) : null;
  if (endDate && isNaN(endDate.getTime()))
    return { error: "掲載終了日の形式が正しくありません" };

  let attachmentUrl: string | null = null;
  if (file && file.size > 0) {
    attachmentUrl = await uploadMediaFile(file);
  }

  try {
    await db.mediaRequest.create({
      data: {
        mediaType:    mediaType as Prisma.MediaRequestCreateInput["mediaType"],
        mediaName,
        customerId:   customerId || null,
        startDate,
        endDate,
        budget,
        description,
        attachmentUrl,
        branchId:     info.branchId || null,
        createdById:  info.userId,
      },
    });
  } catch (e) {
    console.error("[createMediaRequest] DB error:", e instanceof Error ? e.message : e);
    return { error: "保存に失敗しました" };
  }

  revalidatePath("/dashboard/media");
  redirect("/dashboard/media");
}

// ---------------------------------------------------------------
// ステータスを更新する
// ---------------------------------------------------------------
export async function updateMediaRequestStatus(
  requestId: string,
  _prev: { error?: string } | null,
  formData: FormData
): Promise<{ error?: string }> {
  const info = await getSessionInfo();
  if (!info) return { error: "ログインが必要です" };
  if ("error" in info) return { error: info.error };

  const status    = (formData.get("status")    as string)?.trim();
  const replyNote = (formData.get("replyNote") as string)?.trim() || null;

  if (!status) return { error: "ステータスを選択してください" };

  const existing = await db.mediaRequest.findUnique({ where: { id: requestId } });
  if (!existing) return { error: "対象の依頼が見つかりません" };

  try {
    await db.mediaRequest.update({
      where: { id: requestId },
      data: {
        status:    status as Prisma.MediaRequestUpdateInput["status"],
        replyNote,
      },
    });
  } catch (e) {
    console.error("[updateMediaRequestStatus] DB error:", e instanceof Error ? e.message : e);
    return { error: "更新に失敗しました" };
  }

  revalidatePath(`/dashboard/media/${requestId}`);
  revalidatePath("/dashboard/media");
  redirect(`/dashboard/media/${requestId}`);
}

// ---------------------------------------------------------------
// 一覧取得
// ---------------------------------------------------------------
export async function getMediaRequestList() {
  try {
    const info = await getSessionInfo();
    if (!info || "error" in info)
      return { requests: [] as Awaited<ReturnType<typeof fetchList>>, role: "USER" as UserRole };

    const where: Prisma.MediaRequestWhereInput =
      info.role === "ADMIN" ? {} : { branchId: info.branchId };

    const requests = await fetchList(where);
    return { requests, role: info.role };
  } catch (e) {
    console.error("[getMediaRequestList] error:", e instanceof Error ? e.message : e);
    return { requests: [] as Awaited<ReturnType<typeof fetchList>>, role: "USER" as UserRole };
  }
}

async function fetchList(where: Prisma.MediaRequestWhereInput) {
  return db.mediaRequest.findMany({
    where,
    orderBy: { createdAt: "desc" },
    include: {
      customer:  { select: { id: true, name: true } },
      createdBy: { select: { name: true } },
      branch:    { select: { name: true } },
    },
  });
}

// ---------------------------------------------------------------
// 単件取得
// ---------------------------------------------------------------
export async function getMediaRequestById(requestId: string) {
  try {
    const info = await getSessionInfo();
    if (!info || "error" in info) notFound();

    const where: Prisma.MediaRequestWhereInput =
      info.role === "ADMIN"
        ? { id: requestId }
        : { id: requestId, branchId: info.branchId };

    const request = await db.mediaRequest.findFirst({
      where,
      include: {
        customer:  { select: { id: true, name: true } },
        createdBy: { select: { name: true, email: true } },
        branch:    { select: { name: true } },
      },
    });

    if (!request) notFound();
    return { request, role: info.role };
  } catch (e) {
    // notFound() / redirect() は digest プロパティを持つ特殊オブジェクトを throw するので再スロー
    if (typeof e === "object" && e !== null && "digest" in e) throw e;
    console.error("[getMediaRequestById] error:", e instanceof Error ? e.message : e);
    notFound();
  }
}

// ---------------------------------------------------------------
// 顧客マスタ取得（フォーム用）
// ---------------------------------------------------------------
export async function getCustomersForMedia() {
  try {
    const info = await getSessionInfo();
    if (!info || "error" in info) return [];

    const where: Prisma.CustomerWhereInput =
      info.role === "ADMIN" ? {} : { branchId: info.branchId };

    return db.customer.findMany({
      where,
      orderBy: { name: "asc" },
      select: { id: true, name: true },
    });
  } catch (e) {
    console.error("[getCustomersForMedia] error:", e instanceof Error ? e.message : e);
    return [];
  }
}
