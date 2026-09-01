// ==============================================================
// POST /api/office/beat — 在席の心拍（15秒ごと・全ダッシュボード画面から）
//   ・lastSeenAt を更新
//   ・自分宛の「未読ひとこと」、在席者の顔（先頭5人）、チャットの最新時刻を1本で返す
//   → WebSocket を持たずに着信を届ける（Railway 構成は変えない）
// ==============================================================

import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { officeGuard, toKnockDTO, meSelect, toOfficeUser, ONLINE_WINDOW_MS } from "@/lib/office/presence";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST() {
  const me = await officeGuard();
  if (me instanceof NextResponse) return me;

  const now = new Date();
  const since = new Date(now.getTime() - ONLINE_WINDOW_MS);
  const [, inbox, online, latestChat] = await Promise.all([
    db.user.update({
      where: { id: me.id },
      // DBに写真が無ければ、セッションのGoogle写真を保存（顔を選ばなくても写真が出るように）
      data: { lastSeenAt: now, ...(!me.image && me.sessionImage ? { image: me.sessionImage } : {}) },
      select: { id: true },
    }),
    db.officeKnock.findMany({
      where: { toId: me.id, readAt: null },
      include: { from: { select: { name: true, email: true } } },
      orderBy: { createdAt: "desc" },
      take: 20,
    }),
    db.user.findMany({
      where: { isActive: true, lastSeenAt: { gte: since }, email: { not: "demo@adarch.co.jp" } },
      select: meSelect,
      orderBy: { lastSeenAt: "desc" },
      take: 60,
    }),
    db.officeChatMessage.findFirst({
      orderBy: { createdAt: "desc" },
      select: { createdAt: true, userId: true },
    }),
  ]);

  const users = online.map(toOfficeUser);
  return NextResponse.json({
    me: { id: me.id, isHq: me.role === "ADMIN" && !me.groupCompany },
    online: users.length,
    faces: users.slice(0, 5).map((u) => ({ id: u.id, avatar: u.avatar, initials: u.initials, name: u.name })),
    inbox: inbox.map(toKnockDTO),
    latestChatAt: latestChat?.createdAt.toISOString() ?? null,
    latestChatBy: latestChat?.userId ?? null,
    at: now.toISOString(),
  });
}
