// ==============================================================
// GET /api/office/thread?userId= — 相手との「ひとこと」スレッド（直近30件）
//   開いた時点で自分宛の未読を既読にする
// ==============================================================

import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { officeGuard, meSelect, toOfficeUser, toKnockDTO } from "@/lib/office/presence";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const me = await officeGuard();
  if (me instanceof NextResponse) return me;

  const userId = req.nextUrl.searchParams.get("userId") ?? "";
  if (!userId || userId === me.id) {
    return NextResponse.json({ error: "userId が必要です" }, { status: 400 });
  }
  const peer = await db.user.findUnique({ where: { id: userId }, select: meSelect });
  if (!peer || !peer.isActive || peer.email === "demo@adarch.co.jp") {
    return NextResponse.json({ error: "相手が見つかりません" }, { status: 404 });
  }

  const [items] = await Promise.all([
    db.officeKnock.findMany({
      where: {
        OR: [
          { fromId: me.id, toId: peer.id },
          { fromId: peer.id, toId: me.id },
        ],
      },
      include: { from: { select: { name: true, email: true } } },
      orderBy: { createdAt: "desc" },
      take: 30,
    }),
    db.officeKnock.updateMany({
      where: { fromId: peer.id, toId: me.id, readAt: null },
      data: { readAt: new Date() },
    }),
  ]);

  return NextResponse.json({
    peer: toOfficeUser(peer),
    items: items.reverse().map(toKnockDTO),
  });
}
