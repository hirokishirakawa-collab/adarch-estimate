"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { getSessionInfo } from "@/lib/session";
import { createInAppNotification } from "@/lib/notifications";

// ---------------------------------------------------------------
// 通知ヘルパー: プロジェクトの全メンバー（自分以外）に通知
// ---------------------------------------------------------------
async function notifyProjectMembers(
  projectId: string,
  excludeUserId: string,
  params: { type: string; title: string; message?: string; linkUrl: string }
) {
  const members = await db.reviewProjectMember.findMany({
    where: { projectId, userId: { not: excludeUserId } },
    select: { userId: true },
  });
  await Promise.all(
    members.map((m) =>
      createInAppNotification({ userId: m.userId, ...params })
    )
  );
}

// ---------------------------------------------------------------
// 通知ヘルパー: 特定ユーザーに通知
// ---------------------------------------------------------------
async function notifyUser(
  userId: string,
  params: { type: string; title: string; message?: string; linkUrl: string }
) {
  await createInAppNotification({ userId, ...params });
}

// ---------------------------------------------------------------
// チェック項目の追加
// ---------------------------------------------------------------
export async function addCheckItem(
  _prev: { error?: string } | null,
  formData: FormData
): Promise<{ error?: string }> {
  const info = await getSessionInfo();
  if (!info) return { error: "ログインが必要です" };

  const reviewId = formData.get("reviewId") as string;
  const description = (formData.get("description") as string)?.trim();
  const timecodeStr = formData.get("timecode") as string;

  if (!reviewId || !description) return { error: "修正内容を入力してください" };

  const timecode = timecodeStr ? parseFloat(timecodeStr) || null : null;

  // アクセス権チェック
  const review = await db.videoReview.findUnique({
    where: { id: reviewId },
    select: { projectId: true, project: { select: { title: true } } },
  });
  if (!review?.projectId) return { error: "レビューが見つかりません" };

  const hasAccess = await checkProjectAccess(review.projectId, info.userId, info.role);
  if (!hasAccess) return { error: "アクセス権がありません" };

  // 最大sortOrderを取得
  const maxSort = await db.reviewCheckItem.aggregate({
    where: { reviewId },
    _max: { sortOrder: true },
  });

  await db.reviewCheckItem.create({
    data: {
      reviewId,
      description,
      timecode,
      sortOrder: (maxSort._max.sortOrder ?? 0) + 1,
      createdBy: info.staffName,
    },
  });

  revalidatePath(`/review/${review.projectId}`);
  return {};
}

// ---------------------------------------------------------------
// 反映チェック（編集者が「反映しました」を押す）
// ---------------------------------------------------------------
export async function applyCheckItem(checkItemId: string): Promise<{ error?: string }> {
  const info = await getSessionInfo();
  if (!info) return { error: "ログインが必要です" };

  const item = await db.reviewCheckItem.findUnique({
    where: { id: checkItemId },
    select: {
      description: true,
      reviewId: true,
      review: { select: { projectId: true, project: { select: { title: true } } } },
    },
  });
  if (!item?.review.projectId) return { error: "見つかりません" };

  const hasAccess = await checkProjectAccess(item.review.projectId, info.userId, info.role);
  if (!hasAccess) return { error: "アクセス権がありません" };

  await db.reviewCheckItem.update({
    where: { id: checkItemId },
    data: {
      appliedAt: new Date(),
      appliedBy: info.staffName,
      appliedById: info.userId,
    },
  });

  const projectTitle = item.review.project?.title ?? "映像チェック";
  const linkUrl = `/review/${item.review.projectId}`;

  // 全メンバーに通知（反映されたことを知らせる → 確認チェック待ち）
  await notifyProjectMembers(item.review.projectId, info.userId, {
    type: "REVIEW_CHECK_APPLIED",
    title: `${projectTitle}: 修正反映`,
    message: `${info.staffName}が「${truncate(item.description, 40)}」を反映しました。確認チェックをお願いします。`,
    linkUrl,
  });

  revalidatePath(`/review/${item.review.projectId}`);
  return {};
}

// ---------------------------------------------------------------
// 反映チェック解除
// ---------------------------------------------------------------
export async function unapplyCheckItem(checkItemId: string): Promise<{ error?: string }> {
  const info = await getSessionInfo();
  if (!info) return { error: "ログインが必要です" };

  const item = await db.reviewCheckItem.findUnique({
    where: { id: checkItemId },
    select: { reviewId: true, review: { select: { projectId: true } } },
  });
  if (!item?.review.projectId) return { error: "見つかりません" };

  await db.reviewCheckItem.update({
    where: { id: checkItemId },
    data: {
      appliedAt: null, appliedBy: null, appliedById: null,
      // 反映取消したら確認も取消
      confirmedAt: null, confirmedBy: null, confirmedById: null,
    },
  });

  revalidatePath(`/review/${item.review.projectId}`);
  return {};
}

// ---------------------------------------------------------------
// 確認チェック（別の人がダブルチェック）
// ---------------------------------------------------------------
export async function confirmCheckItem(checkItemId: string): Promise<{ error?: string }> {
  const info = await getSessionInfo();
  if (!info) return { error: "ログインが必要です" };

  const item = await db.reviewCheckItem.findUnique({
    where: { id: checkItemId },
    select: {
      appliedAt: true,
      appliedById: true,
      description: true,
      reviewId: true,
      review: { select: { projectId: true, project: { select: { title: true } } } },
    },
  });
  if (!item?.review.projectId) return { error: "見つかりません" };

  if (!item.appliedAt) return { error: "先に反映チェックが必要です" };

  // 反映者と確認者は別人でなければならない
  if (item.appliedById === info.userId) {
    return { error: "反映者と確認者は別の人にしてください" };
  }

  const hasAccess = await checkProjectAccess(item.review.projectId, info.userId, info.role);
  if (!hasAccess) return { error: "アクセス権がありません" };

  await db.reviewCheckItem.update({
    where: { id: checkItemId },
    data: {
      confirmedAt: new Date(),
      confirmedBy: info.staffName,
      confirmedById: info.userId,
    },
  });

  const projectTitle = item.review.project?.title ?? "映像チェック";
  const linkUrl = `/review/${item.review.projectId}`;

  // 反映者に「確認されました」と通知
  if (item.appliedById) {
    await notifyUser(item.appliedById, {
      type: "REVIEW_CHECK_CONFIRMED",
      title: `${projectTitle}: 確認OK`,
      message: `${info.staffName}が「${truncate(item.description, 40)}」を確認しました。`,
      linkUrl,
    });
  }

  // 全チェック項目が完了したか確認
  const remaining = await db.reviewCheckItem.count({
    where: { reviewId: item.reviewId, confirmedAt: null },
  });

  if (remaining === 0) {
    // 全項目完了 → 全メンバーに通知
    await notifyProjectMembers(item.review.projectId, info.userId, {
      type: "REVIEW_ALL_CHECKED",
      title: `${projectTitle}: 全チェック完了`,
      message: "全修正項目の確認が完了しました。承認可能です。",
      linkUrl,
    });
  }

  revalidatePath(`/review/${item.review.projectId}`);
  return {};
}

// ---------------------------------------------------------------
// 確認チェック解除
// ---------------------------------------------------------------
export async function unconfirmCheckItem(checkItemId: string): Promise<{ error?: string }> {
  const info = await getSessionInfo();
  if (!info) return { error: "ログインが必要です" };

  const item = await db.reviewCheckItem.findUnique({
    where: { id: checkItemId },
    select: { reviewId: true, review: { select: { projectId: true } } },
  });
  if (!item?.review.projectId) return { error: "見つかりません" };

  await db.reviewCheckItem.update({
    where: { id: checkItemId },
    data: { confirmedAt: null, confirmedBy: null, confirmedById: null },
  });

  revalidatePath(`/review/${item.review.projectId}`);
  return {};
}

// ---------------------------------------------------------------
// チェック項目の削除
// ---------------------------------------------------------------
export async function deleteCheckItem(checkItemId: string): Promise<{ error?: string }> {
  const info = await getSessionInfo();
  if (!info) return { error: "ログインが必要です" };

  const item = await db.reviewCheckItem.findUnique({
    where: { id: checkItemId },
    select: { reviewId: true, review: { select: { projectId: true } } },
  });
  if (!item?.review.projectId) return { error: "見つかりません" };

  await db.reviewCheckItem.delete({ where: { id: checkItemId } });

  revalidatePath(`/review/${item.review.projectId}`);
  return {};
}

// ---------------------------------------------------------------
// メンバー追加
// ---------------------------------------------------------------
export async function addProjectMember(
  projectId: string,
  userId: string,
  role: "OWNER" | "EDITOR" | "CHECKER" = "CHECKER"
): Promise<{ error?: string }> {
  const info = await getSessionInfo();
  if (!info) return { error: "ログインが必要です" };

  // ADMIN or プロジェクトOWNERのみ追加可能
  if (info.role !== "ADMIN") {
    const membership = await db.reviewProjectMember.findUnique({
      where: { projectId_userId: { projectId, userId: info.userId } },
    });
    if (!membership || membership.role !== "OWNER") {
      return { error: "メンバー追加権限がありません" };
    }
  }

  await db.reviewProjectMember.upsert({
    where: { projectId_userId: { projectId, userId } },
    update: { role },
    create: { projectId, userId, role },
  });

  // 追加されたメンバーに通知
  const project = await db.reviewProject.findUnique({
    where: { id: projectId },
    select: { title: true },
  });

  await notifyUser(userId, {
    type: "REVIEW_MEMBER_ADDED",
    title: `映像チェッカーに追加されました`,
    message: `「${project?.title ?? "映像チェック"}」のチェックメンバーに追加されました。`,
    linkUrl: `/review/${projectId}`,
  });

  revalidatePath(`/review/${projectId}`);
  return {};
}

// ---------------------------------------------------------------
// メンバー削除
// ---------------------------------------------------------------
export async function removeProjectMember(
  projectId: string,
  userId: string
): Promise<{ error?: string }> {
  const info = await getSessionInfo();
  if (!info) return { error: "ログインが必要です" };

  if (info.role !== "ADMIN") {
    const membership = await db.reviewProjectMember.findUnique({
      where: { projectId_userId: { projectId, userId: info.userId } },
    });
    if (!membership || membership.role !== "OWNER") {
      return { error: "メンバー削除権限がありません" };
    }
  }

  await db.reviewProjectMember.deleteMany({
    where: { projectId, userId },
  });

  revalidatePath(`/review/${projectId}`);
  return {};
}

// ---------------------------------------------------------------
// アクセス権チェック ヘルパー
// ---------------------------------------------------------------
export async function checkProjectAccess(
  projectId: string,
  userId: string,
  role: string
): Promise<boolean> {
  // ADMINは全アクセス可
  if (role === "ADMIN") return true;

  // プロジェクト作成者もアクセス可
  const project = await db.reviewProject.findUnique({
    where: { id: projectId },
    select: { createdBy: true },
  });

  const user = await db.user.findUnique({
    where: { id: userId },
    select: { email: true },
  });

  if (project?.createdBy === user?.email) return true;

  // メンバーに登録されているか
  const membership = await db.reviewProjectMember.findUnique({
    where: { projectId_userId: { projectId, userId } },
  });

  return !!membership;
}

// ---------------------------------------------------------------
// ユーティリティ
// ---------------------------------------------------------------
function truncate(str: string, max: number): string {
  return str.length > max ? str.slice(0, max) + "..." : str;
}
