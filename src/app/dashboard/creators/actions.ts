"use server";
import { db } from "@/lib/db";
import { auth } from "@/lib/auth";
import { revalidatePath } from "next/cache";

export async function toggleCreatorFavorite(creatorId: string) {
  const session = await auth();
  if (!session?.user?.id) return;

  const existing = await db.creatorFavorite.findUnique({
    where: { userId_creatorId: { userId: session.user.id, creatorId } },
  });

  if (existing) {
    await db.creatorFavorite.delete({ where: { id: existing.id } });
  } else {
    await db.creatorFavorite.create({
      data: { userId: session.user.id, creatorId },
    });
  }

  revalidatePath("/dashboard/creators");
}
