// ==============================================================
// POST /api/office/call/[id] — 呼びかけへの応答
//   body.action = "accept" | "decline" | "end"
//   accept : 受け手が「入る」→ トークンを返す
//   decline: 受け手が「いま無理」
//   end    : どちらかが終了／時間切れ → 部屋を閉じ、両者の officeRoom を外す
// ==============================================================

import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { officeGuard, makeCallToken, closeLiveKitRoom, callIsLive } from "@/lib/office/presence";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const me = await officeGuard();
  if (me instanceof NextResponse) return me;
  const { id } = await params;

  let action = "";
  try {
    const body = (await req.json()) as { action?: string };
    action = typeof body.action === "string" ? body.action : "";
  } catch {
    return NextResponse.json({ error: "本文が読めません" }, { status: 400 });
  }

  const call = await db.officeKnock.findUnique({
    where: { id },
    include: { from: { select: { id: true, name: true, email: true, role: true, groupCompanyId: true } } },
  });
  if (!call || call.kind !== "CALL") return NextResponse.json({ error: "呼びかけが見つかりません" }, { status: 404 });
  const isParty = call.fromId === me.id || call.toId === me.id;
  if (!isParty) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  if (action === "accept") {
    if (call.toId !== me.id) return NextResponse.json({ error: "受け手だけが入れます" }, { status: 403 });
    if (!callIsLive(call) || !call.expiresAt) {
      return NextResponse.json({ error: "この呼びかけは終わっています" }, { status: 410 });
    }
    const tk = await makeCallToken({
      room: call.id,
      userId: me.id,
      name: me.name ?? me.email.split("@")[0],
      expiresAt: call.expiresAt,
    });
    if (!tk) return NextResponse.json({ error: "音声の準備に失敗しました" }, { status: 500 });
    await Promise.all([
      db.officeKnock.update({ where: { id }, data: { acceptedAt: call.acceptedAt ?? new Date(), readAt: call.readAt ?? new Date() } }),
      db.user.update({ where: { id: me.id }, data: { officeRoom: call.id } }),
    ]);
    return NextResponse.json({
      call: {
        room: call.id,
        url: tk.url,
        token: tk.token,
        expiresAt: call.expiresAt.toISOString(),
        peerName: call.from.name ?? call.from.email.split("@")[0],
        peerId: call.from.id,
        peerIsHq: call.from.role === "ADMIN" && !call.from.groupCompanyId,
      },
    });
  }

  if (action === "decline") {
    if (call.toId !== me.id) return NextResponse.json({ error: "受け手だけが断れます" }, { status: 403 });
    await Promise.all([
      db.officeKnock.update({ where: { id }, data: { declinedAt: new Date(), readAt: call.readAt ?? new Date() } }),
      db.user.updateMany({ where: { id: call.fromId, officeRoom: call.id }, data: { officeRoom: null } }),
    ]);
    closeLiveKitRoom(call.id).catch(() => {});
    return NextResponse.json({ ok: true });
  }

  if (action === "end") {
    await Promise.all([
      db.officeKnock.update({ where: { id }, data: { endedAt: call.endedAt ?? new Date() } }),
      db.user.updateMany({ where: { id: { in: [call.fromId, call.toId] }, officeRoom: call.id }, data: { officeRoom: null } }),
    ]);
    closeLiveKitRoom(call.id).catch(() => {});
    return NextResponse.json({ ok: true });
  }

  return NextResponse.json({ error: "action が不正です" }, { status: 400 });
}
