// ==============================================================
// GET /api/office/who — いま動いている人（在席者）。/live の地図に灯す
//   在席＝beat が ONLINE_WINDOW_MS 以内。デモ・停止中は出さない／見せない
// ==============================================================

import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { officeGuard, meSelect, toOfficeUser, ONLINE_WINDOW_MS, voiceConfigured } from "@/lib/office/presence";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const me = await officeGuard();
  if (me instanceof NextResponse) return me;

  const since = new Date(Date.now() - ONLINE_WINDOW_MS);
  const users = await db.user.findMany({
    where: {
      isActive: true,
      lastSeenAt: { gte: since },
      email: { not: "demo@adarch.co.jp" },
    },
    select: meSelect,
    orderBy: { lastSeenAt: "desc" },
    take: 100,
  });

  return NextResponse.json({
    meId: me.id,
    voice: voiceConfigured(),
    users: users.map(toOfficeUser),
    generatedAt: new Date().toISOString(),
  });
}
