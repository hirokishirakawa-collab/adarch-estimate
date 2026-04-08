"use server";

import { db } from "@/lib/db";

export async function markPartnershipInterest(creatorId: string) {
  try {
    await db.creator.update({
      where: { id: creatorId },
      data: { interestedInPartnership: true },
    });
  } catch (e) {
    console.error("Mark partnership interest error:", e);
  }
}
