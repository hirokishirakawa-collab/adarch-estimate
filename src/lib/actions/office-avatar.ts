"use server";
// 設定画面: グループオフィスの顔アイコンを選ぶ（null＝Googleの写真に戻す）

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { getSessionInfo } from "@/lib/session";
import { isAvatarId } from "@/lib/office/presence";

export async function updateOfficeAvatar(avatar: string | null): Promise<{ error?: string; success?: boolean }> {
  const info = await getSessionInfo();
  if (!info) return { error: "ログインが必要です" };
  if (avatar !== null && !isAvatarId(avatar)) return { error: "アイコンの指定が不正です" };

  await db.user.update({ where: { id: info.userId }, data: { officeAvatar: avatar } });
  revalidatePath("/dashboard/settings");
  revalidatePath("/dashboard/live");
  return { success: true };
}
