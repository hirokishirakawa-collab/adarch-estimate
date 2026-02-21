"use server";

import { revalidatePath } from "next/cache";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import type { ActivityType, DealStatus } from "@/generated/prisma/client";

// ---------------------------------------------------------------
// 活動履歴を記録する
// ---------------------------------------------------------------
export async function createActivityLog(
  _prev: { error?: string; success?: boolean } | null,
  formData: FormData
): Promise<{ error?: string; success?: boolean }> {
  const customerId = formData.get("customerId") as string;
  const type = formData.get("type") as string;
  const content = (formData.get("content") as string)?.trim();

  if (!customerId) return { error: "顧客IDが不正です" };
  if (!content) return { error: "活動内容を入力してください" };

  const session = await auth();
  const staffName =
    session?.user?.name ?? session?.user?.email ?? "不明";

  await db.activityLog.create({
    data: {
      customerId,
      type: type as ActivityType,
      content,
      staffName,
    },
  });

  revalidatePath(`/dashboard/customers/${customerId}`);
  return { success: true };
}

// ---------------------------------------------------------------
// 商談ステータスを更新する
// ---------------------------------------------------------------
export async function updateDealStatus(
  dealId: string,
  customerId: string,
  status: string
): Promise<void> {
  await db.deal.update({
    where: { id: dealId },
    data: { status: status as DealStatus },
  });
  revalidatePath(`/dashboard/customers/${customerId}`);
}
