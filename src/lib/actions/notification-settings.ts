"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { getSessionInfo } from "@/lib/session";

export async function updateNotificationSettings(
  _prev: { error?: string; success?: boolean } | null,
  formData: FormData
): Promise<{ error?: string; success?: boolean }> {
  const info = await getSessionInfo();
  if (!info) return { error: "ログインが必要です" };

  const notifyViaChat = formData.get("notifyViaChat") === "on";
  const notifyViaEmail = formData.get("notifyViaEmail") === "on";

  await db.user.update({
    where: { id: info.userId },
    data: { notifyViaChat, notifyViaEmail },
  });

  revalidatePath("/dashboard/settings");
  return { success: true };
}
