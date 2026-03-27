"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { getSessionInfo } from "@/lib/session";

// ---------------------------------------------------------------
// プロジェクト作成 + 初回バージョン（v1）
// ---------------------------------------------------------------
export async function createReview(
  _prev: { error?: string; reviewId?: string } | null,
  formData: FormData
): Promise<{ error?: string; reviewId?: string }> {
  const info = await getSessionInfo();
  if (!info) return { error: "ログインが必要です" };

  const title            = (formData.get("title") as string)?.trim();
  const description      = (formData.get("description") as string)?.trim() || null;
  const beforePath       = (formData.get("beforePath") as string)?.trim();
  const afterPath        = (formData.get("afterPath") as string)?.trim();
  const beforeFileName   = (formData.get("beforeFileName") as string)?.trim();
  const afterFileName    = (formData.get("afterFileName") as string)?.trim();
  const linkedProjectId  = (formData.get("linkedProjectId") as string)?.trim() || null;

  if (!title) return { error: "タイトルは必須です" };
  if (!linkedProjectId) return { error: "プロジェクトを選択してください" };
  if (!beforePath || !afterPath) return { error: "動画をアップロードしてください" };

  // プロジェクトが存在するか確認
  const linkedProject = await db.project.findUnique({ where: { id: linkedProjectId } });
  if (!linkedProject) return { error: "選択されたプロジェクトが見つかりません" };

  // レビュープロジェクトとv1レビューを同時作成
  const project = await db.reviewProject.create({
    data: {
      title,
      description,
      linkedProjectId,
      branchId:  info.branchId,
      createdBy: info.email,
      staffName: info.staffName,
      reviews: {
        create: {
          title: `${title} v1`,
          description,
          version: 1,
          status: "UPLOADING",
          beforeVideoPath: beforePath,
          beforeFileName:  beforeFileName || "before.mp4",
          afterVideoPath:  afterPath,
          afterFileName:   afterFileName || "after.mp4",
          branchId:  info.branchId,
          createdBy: info.email,
          staffName: info.staffName,
        },
      },
    },
    include: { reviews: true },
  });

  revalidatePath("/review");
  revalidatePath("/dashboard/review");
  redirect(`/review/${project.id}`);
}

// ---------------------------------------------------------------
// 新しいバージョンを追加
// ---------------------------------------------------------------
export async function addVersion(
  _prev: { error?: string } | null,
  formData: FormData
): Promise<{ error?: string }> {
  const info = await getSessionInfo();
  if (!info) return { error: "ログインが必要です" };

  const projectId    = (formData.get("projectId") as string)?.trim();
  const description  = (formData.get("description") as string)?.trim() || null;
  const afterPath    = (formData.get("afterPath") as string)?.trim();
  const afterFileName = (formData.get("afterFileName") as string)?.trim();

  if (!projectId || !afterPath) return { error: "動画をアップロードしてください" };

  // 前バージョンの情報を取得
  const prevReview = await db.videoReview.findFirst({
    where: { projectId },
    orderBy: { version: "desc" },
  });

  if (!prevReview) return { error: "プロジェクトが見つかりません" };

  const project = await db.reviewProject.findUnique({ where: { id: projectId } });
  if (!project) return { error: "プロジェクトが見つかりません" };

  const newVersion = prevReview.version + 1;

  // 前バージョンの修正後動画 = 新バージョンの修正前動画
  await db.videoReview.create({
    data: {
      title: `${project.title} v${newVersion}`,
      description,
      version: newVersion,
      projectId,
      status: "UPLOADING",
      beforeVideoPath: prevReview.afterVideoPath,
      beforeFileName:  prevReview.afterFileName,
      afterVideoPath:  afterPath,
      afterFileName:   afterFileName || "after.mp4",
      branchId:  info.branchId,
      createdBy: info.email,
      staffName: info.staffName,
    },
  });

  revalidatePath(`/dashboard/review/${projectId}`);
  return {};
}

// ---------------------------------------------------------------
// プロジェクト削除
// ---------------------------------------------------------------
export async function deleteProject(projectId: string): Promise<{ error?: string }> {
  const info = await getSessionInfo();
  if (!info) return { error: "ログインが必要です" };

  const project = await db.reviewProject.findUnique({ where: { id: projectId } });
  if (!project) return { error: "プロジェクトが見つかりません" };
  if (info.role !== "ADMIN" && project.createdBy !== info.email) {
    return { error: "削除権限がありません" };
  }

  await db.reviewProject.delete({ where: { id: projectId } });
  revalidatePath("/review");
  revalidatePath("/dashboard/review");
  redirect("/review");
}

// ---------------------------------------------------------------
// メモ追加
// ---------------------------------------------------------------
export async function addNote(
  _prev: { error?: string } | null,
  formData: FormData
): Promise<{ error?: string }> {
  const info = await getSessionInfo();
  if (!info) return { error: "ログインが必要です" };

  const reviewId = formData.get("reviewId") as string;
  const timecodeStr = formData.get("timecode") as string;
  const text = (formData.get("text") as string)?.trim();

  if (!reviewId || !text) return { error: "メモ内容を入力してください" };
  const timecode = parseFloat(timecodeStr) || 0;

  await db.videoReviewNote.create({
    data: { reviewId, timecode, text, author: info.staffName },
  });

  const review = await db.videoReview.findUnique({ where: { id: reviewId }, select: { projectId: true } });
  revalidatePath(`/dashboard/review/${review?.projectId ?? reviewId}`);
  return {};
}

// ---------------------------------------------------------------
// メモ削除
// ---------------------------------------------------------------
export async function deleteNote(noteId: string, reviewId: string): Promise<{ error?: string }> {
  const info = await getSessionInfo();
  if (!info) return { error: "ログインが必要です" };

  await db.videoReviewNote.delete({ where: { id: noteId } });
  const review = await db.videoReview.findUnique({ where: { id: reviewId }, select: { projectId: true } });
  revalidatePath(`/dashboard/review/${review?.projectId ?? reviewId}`);
  return {};
}

// ---------------------------------------------------------------
// 変更検出の編集
// ---------------------------------------------------------------
export async function updateChange(
  changeId: string,
  description: string,
  type?: string
): Promise<{ error?: string }> {
  const info = await getSessionInfo();
  if (!info) return { error: "ログインが必要です" };

  const change = await db.videoReviewChange.findUnique({
    where: { id: changeId },
    select: { reviewId: true, review: { select: { projectId: true } } },
  });
  if (!change) return { error: "見つかりません" };

  const data: { description: string; type?: "TELOP" | "CUT_REPLACE" | "COLOR" | "DURATION" | "ANIMATION" | "OTHER" } = { description };
  if (type) data.type = type as typeof data.type;

  await db.videoReviewChange.update({ where: { id: changeId }, data });

  revalidatePath(`/review/${change.review.projectId ?? change.reviewId}`);
  revalidatePath(`/dashboard/review/${change.review.projectId ?? change.reviewId}`);
  return {};
}

// ---------------------------------------------------------------
// 変更検出の削除
// ---------------------------------------------------------------
export async function deleteChange(changeId: string): Promise<{ error?: string }> {
  const info = await getSessionInfo();
  if (!info) return { error: "ログインが必要です" };

  const change = await db.videoReviewChange.findUnique({
    where: { id: changeId },
    select: { reviewId: true, review: { select: { projectId: true } } },
  });
  if (!change) return { error: "見つかりません" };

  await db.videoReviewChange.delete({ where: { id: changeId } });

  // totalChanges を更新
  const count = await db.videoReviewChange.count({ where: { reviewId: change.reviewId } });
  await db.videoReview.update({ where: { id: change.reviewId }, data: { totalChanges: count } });

  revalidatePath(`/review/${change.review.projectId ?? change.reviewId}`);
  revalidatePath(`/dashboard/review/${change.review.projectId ?? change.reviewId}`);
  return {};
}

// ---------------------------------------------------------------
// 承認
// ---------------------------------------------------------------
export async function approveReview(reviewId: string): Promise<{ error?: string }> {
  const info = await getSessionInfo();
  if (!info) return { error: "ログインが必要です" };

  await db.videoReview.update({
    where: { id: reviewId },
    data: {
      status: "APPROVED",
      approvedAt: new Date(),
      approvedBy: info.staffName,
      rejectedAt: null, rejectedBy: null, rejectionNote: null,
    },
  });

  const review = await db.videoReview.findUnique({ where: { id: reviewId }, select: { projectId: true } });
  revalidatePath(`/dashboard/review/${review?.projectId ?? reviewId}`);
  revalidatePath("/dashboard/review");
  return {};
}

// ---------------------------------------------------------------
// 差し戻し
// ---------------------------------------------------------------
export async function rejectReview(
  _prev: { error?: string } | null,
  formData: FormData
): Promise<{ error?: string }> {
  const info = await getSessionInfo();
  if (!info) return { error: "ログインが必要です" };

  const reviewId = formData.get("reviewId") as string;
  const note = (formData.get("note") as string)?.trim() || null;

  await db.videoReview.update({
    where: { id: reviewId },
    data: {
      status: "REJECTED",
      rejectedAt: new Date(), rejectedBy: info.staffName, rejectionNote: note,
      approvedAt: null, approvedBy: null,
    },
  });

  const review = await db.videoReview.findUnique({ where: { id: reviewId }, select: { projectId: true } });
  revalidatePath(`/dashboard/review/${review?.projectId ?? reviewId}`);
  revalidatePath("/dashboard/review");
  return {};
}
