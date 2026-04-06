"use server";

import { db } from "@/lib/db";
import { auth } from "@/lib/auth";
import type { UserRole } from "@/types/roles";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";

export async function updateCreatorStatus(
  creatorId: string,
  status: string
): Promise<{ success: boolean; error?: string }> {
  const session = await auth();
  const role = (session?.user?.role ?? "USER") as UserRole;
  if (role !== "ADMIN") return { success: false, error: "権限がありません" };

  try {
    await db.creator.update({
      where: { id: creatorId },
      data: { status: status as "ACTIVE" | "BANNED" | "SHADOW_BANNED" | "INACTIVE" },
    });
    revalidatePath("/dashboard/creators");
    return { success: true };
  } catch (e) {
    console.error("Update creator status error:", e);
    return { success: false, error: "ステータスの更新に失敗しました" };
  }
}

export async function upsertCreatorRating(data: {
  creatorId: string;
  ratedById: string;
  personality: number;
  actualSkill: number;
  responseSpeed: number;
  deadlineCompliance: number;
  repeatIntention: string;
  videoInterviewed: boolean;
  notes: string;
}): Promise<{ success: boolean; error?: string }> {
  const session = await auth();
  const role = (session?.user?.role ?? "USER") as UserRole;
  if (role !== "ADMIN") return { success: false, error: "権限がありません" };

  try {
    await db.creatorRating.create({
      data: {
        creatorId: data.creatorId,
        ratedById: data.ratedById,
        personality: data.personality,
        actualSkill: data.actualSkill,
        responseSpeed: data.responseSpeed,
        deadlineCompliance: data.deadlineCompliance,
        repeatIntention: data.repeatIntention as "EXCELLENT" | "GOOD" | "FAIR" | "POOR",
        videoInterviewed: data.videoInterviewed,
        notes: data.notes || null,
      },
    });
    revalidatePath("/dashboard/creators");
    return { success: true };
  } catch (e) {
    console.error("Upsert creator rating error:", e);
    return { success: false, error: "評価の保存に失敗しました" };
  }
}
