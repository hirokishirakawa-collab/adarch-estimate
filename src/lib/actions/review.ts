"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { getSessionInfo } from "@/lib/session";

// ---------------------------------------------------------------
// レビュー新規作成（動画は事前にAPI Routeでアップロード済み）
// ---------------------------------------------------------------
export async function createReview(
  _prev: { error?: string; reviewId?: string } | null,
  formData: FormData
): Promise<{ error?: string; reviewId?: string }> {
  const info = await getSessionInfo();
  if (!info) return { error: "ログインが必要です" };

  const title       = (formData.get("title") as string)?.trim();
  const description = (formData.get("description") as string)?.trim() || null;
  const beforePath  = (formData.get("beforePath") as string)?.trim();
  const afterPath   = (formData.get("afterPath") as string)?.trim();
  const beforeFileName = (formData.get("beforeFileName") as string)?.trim();
  const afterFileName  = (formData.get("afterFileName") as string)?.trim();

  if (!title) return { error: "タイトルは必須です" };
  if (!beforePath || !afterPath) return { error: "動画をアップロードしてください" };

  const review = await db.videoReview.create({
    data: {
      title,
      description,
      status: "UPLOADING",
      beforeVideoPath: beforePath,
      beforeFileName:  beforeFileName || "before.mp4",
      afterVideoPath:  afterPath,
      afterFileName:   afterFileName || "after.mp4",
      branchId:  info.branchId,
      createdBy: info.email,
      staffName: info.staffName,
    },
  });

  revalidatePath("/dashboard/review");
  redirect(`/dashboard/review/${review.id}`);
}

// ---------------------------------------------------------------
// レビュー削除
// ---------------------------------------------------------------
export async function deleteReview(reviewId: string): Promise<{ error?: string }> {
  const info = await getSessionInfo();
  if (!info) return { error: "ログインが必要です" };

  const review = await db.videoReview.findUnique({ where: { id: reviewId } });
  if (!review) return { error: "レビューが見つかりません" };
  if (info.role !== "ADMIN" && review.createdBy !== info.email) {
    return { error: "削除権限がありません" };
  }

  await db.videoReview.delete({ where: { id: reviewId } });
  revalidatePath("/dashboard/review");
  redirect("/dashboard/review");
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
    data: {
      reviewId,
      timecode,
      text,
      author: info.staffName,
    },
  });

  revalidatePath(`/dashboard/review/${reviewId}`);
  return {};
}

// ---------------------------------------------------------------
// メモ削除
// ---------------------------------------------------------------
export async function deleteNote(noteId: string, reviewId: string): Promise<{ error?: string }> {
  const info = await getSessionInfo();
  if (!info) return { error: "ログインが必要です" };

  await db.videoReviewNote.delete({ where: { id: noteId } });
  revalidatePath(`/dashboard/review/${reviewId}`);
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
      rejectedAt: null,
      rejectedBy: null,
      rejectionNote: null,
    },
  });

  revalidatePath(`/dashboard/review/${reviewId}`);
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
      rejectedAt: new Date(),
      rejectedBy: info.staffName,
      rejectionNote: note,
      approvedAt: null,
      approvedBy: null,
    },
  });

  revalidatePath(`/dashboard/review/${reviewId}`);
  revalidatePath("/dashboard/review");
  return {};
}
