"use server";

import { redirect, notFound } from "next/navigation";
import { revalidatePath } from "next/cache";
import { after } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { getMockBranchId } from "@/lib/data/customers";
import { uploadGroupSyncFile } from "@/lib/storage";
import { sendCollaborationNotification } from "@/lib/notifications";
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
// グループ連携依頼を作成する
// ---------------------------------------------------------------
export async function createCollaborationRequest(
  _prev: { error?: string } | null,
  formData: FormData
): Promise<{ error?: string }> {
  const info = await getSessionInfo();
  if (!info) return { error: "ログインが必要です" };

  const counterpartName = (formData.get("counterpartName") as string)?.trim();
  const requestType     = (formData.get("requestType")     as string)?.trim();
  const budget          = (formData.get("budget")          as string)?.trim() || null;
  const description     = (formData.get("description")     as string)?.trim();
  const desiredDateRaw  = (formData.get("desiredDate")     as string)?.trim() || null;
  const projectId       = (formData.get("projectId")       as string)?.trim() || null;
  const file            = formData.get("file") as File | null;

  if (!counterpartName) return { error: "連携先代表を入力してください" };
  if (!requestType)     return { error: "依頼種別を選択してください" };
  if (!description)     return { error: "依頼内容を入力してください" };

  const desiredDate = desiredDateRaw ? new Date(desiredDateRaw) : null;
  if (desiredDate && isNaN(desiredDate.getTime()))
    return { error: "希望日の形式が正しくありません" };

  // ファイルアップロード（あれば）
  let attachmentUrl: string | null = null;
  if (file && file.size > 0) {
    attachmentUrl = await uploadGroupSyncFile(file);
  }

  let requestId: string;
  let branchName: string | null = null;
  try {
    const [request, branch] = await Promise.all([
      db.groupCollaborationRequest.create({
        data: {
          counterpartName,
          requestType:  requestType as Prisma.GroupCollaborationRequestCreateInput["requestType"],
          budget,
          description,
          desiredDate,
          attachmentUrl,
          projectId:    projectId || null,
          branchId:     info.branchId || null,
          createdById:  info.userId,
        },
      }),
      info.branchId
        ? db.branch.findUnique({ where: { id: info.branchId }, select: { name: true } })
        : Promise.resolve(null),
    ]);
    requestId = request.id;
    branchName = branch?.name ?? null;
  } catch (e) {
    console.error("[createCollaborationRequest] DB error:", e instanceof Error ? e.message : e);
    return { error: "保存に失敗しました" };
  }

  // 通知（after: レスポンス送信後に非同期実行）
  const capturedId            = requestId;
  const capturedCounterpart   = counterpartName;
  const capturedType          = requestType;
  const capturedDesc          = description;
  const capturedStaff         = info.staffName;
  const capturedBranch        = branchName;
  after(async () => {
    await sendCollaborationNotification({
      eventType:       "COLLABORATION_CREATED",
      requestId:       capturedId,
      counterpartName: capturedCounterpart,
      requestType:     capturedType,
      description:     capturedDesc,
      staffName:       capturedStaff,
      branchName:      capturedBranch,
    });
  });

  revalidatePath("/dashboard/group-sync");
  redirect("/dashboard/group-sync");
}

// ---------------------------------------------------------------
// ステータスと回答を更新する
// ---------------------------------------------------------------
export async function updateCollaborationStatus(
  requestId: string,
  _prev: { error?: string } | null,
  formData: FormData
): Promise<{ error?: string }> {
  const info = await getSessionInfo();
  if (!info) return { error: "ログインが必要です" };

  const status    = (formData.get("status")    as string)?.trim();
  const replyNote = (formData.get("replyNote") as string)?.trim() || null;

  if (!status) return { error: "ステータスを選択してください" };

  const existing = await db.groupCollaborationRequest.findUnique({
    where: { id: requestId },
  });
  if (!existing) return { error: "対象の依頼が見つかりません" };

  try {
    await db.groupCollaborationRequest.update({
      where: { id: requestId },
      data: {
        status:    status as Prisma.GroupCollaborationRequestUpdateInput["status"],
        replyNote,
      },
    });
  } catch (e) {
    console.error("[updateCollaborationStatus] DB error:", e instanceof Error ? e.message : e);
    return { error: "更新に失敗しました" };
  }

  revalidatePath(`/dashboard/group-sync/${requestId}`);
  revalidatePath("/dashboard/group-sync");
  redirect(`/dashboard/group-sync/${requestId}`);
}

// ---------------------------------------------------------------
// 一覧取得
// ---------------------------------------------------------------
export async function getCollaborationRequestList() {
  const info = await getSessionInfo();
  if (!info) return { requests: [] as Awaited<ReturnType<typeof fetchList>>, role: "USER" as UserRole };

  const where: Prisma.GroupCollaborationRequestWhereInput =
    info.role === "ADMIN" ? {} : { branchId: info.branchId };

  const requests = await fetchList(where);
  return { requests, role: info.role };
}

async function fetchList(where: Prisma.GroupCollaborationRequestWhereInput) {
  return db.groupCollaborationRequest.findMany({
    where,
    orderBy: { createdAt: "desc" },
    include: {
      project:   { select: { id: true, title: true } },
      createdBy: { select: { name: true } },
      branch:    { select: { name: true } },
    },
  });
}

// ---------------------------------------------------------------
// 単件取得
// ---------------------------------------------------------------
export async function getCollaborationRequestById(requestId: string) {
  const info = await getSessionInfo();
  if (!info) notFound();

  const where: Prisma.GroupCollaborationRequestWhereInput =
    info.role === "ADMIN" ? { id: requestId } : { id: requestId, branchId: info.branchId };

  const request = await db.groupCollaborationRequest.findFirst({
    where,
    include: {
      project:   { select: { id: true, title: true } },
      createdBy: { select: { name: true, email: true } },
      branch:    { select: { name: true } },
    },
  });

  if (!request) notFound();
  return { request, role: info.role };
}

// ---------------------------------------------------------------
// プロジェクト一覧（フォーム用）
// ---------------------------------------------------------------
export async function getProjectsForGroupSync() {
  const info = await getSessionInfo();
  if (!info) return [];

  const where: Prisma.ProjectWhereInput =
    info.role === "ADMIN" ? {} : { branchId: info.branchId };

  return db.project.findMany({
    where,
    orderBy: { createdAt: "desc" },
    select: { id: true, title: true },
  });
}
