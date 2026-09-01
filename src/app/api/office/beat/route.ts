// ==============================================================
// POST /api/office/beat — 在席の心拍（15秒ごと・全ダッシュボード画面から）
//   ・lastSeenAt / officeRoom を更新
//   ・自分宛の「未読ひとこと」と「生きている呼びかけ」を同じ1本で返す
//   → WebSocket を持たずに着信を届ける（Railway 構成は変えない）
// ==============================================================

import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import {
  officeGuard,
  toKnockDTO,
  callIsLive,
  voiceConfigured,
  ONLINE_WINDOW_MS,
  CALL_MINUTES,
  BOOKING_URL,
} from "@/lib/office/presence";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  const me = await officeGuard();
  if (me instanceof NextResponse) return me;

  let room: string | null = null;
  try {
    const body = (await req.json()) as { room?: string | null };
    room = typeof body.room === "string" && body.room.length < 64 ? body.room : null;
  } catch {
    /* 本文なしでもよい */
  }

  const now = new Date();
  const [, inbox, online] = await Promise.all([
    db.user.update({
      where: { id: me.id },
      data: { lastSeenAt: now, officeRoom: room },
      select: { id: true },
    }),
    db.officeKnock.findMany({
      where: {
        toId: me.id,
        OR: [
          { kind: "TEXT", readAt: null },
          { kind: "CALL", acceptedAt: null, declinedAt: null, endedAt: null, expiresAt: { gt: now } },
        ],
      },
      include: { from: { select: { name: true, email: true } } },
      orderBy: { createdAt: "desc" },
      take: 20,
    }),
    db.user.count({
      where: {
        isActive: true,
        lastSeenAt: { gte: new Date(now.getTime() - ONLINE_WINDOW_MS) },
        email: { not: "demo@adarch.co.jp" },
      },
    }),
  ]);

  return NextResponse.json({
    me: { id: me.id, isHq: me.role === "ADMIN" && !me.groupCompany },
    online,
    inbox: inbox.filter((k) => k.kind === "TEXT" || callIsLive(k)).map(toKnockDTO),
    voice: voiceConfigured(),
    callMinutes: CALL_MINUTES,
    bookingUrl: BOOKING_URL,
    at: now.toISOString(),
  });
}
