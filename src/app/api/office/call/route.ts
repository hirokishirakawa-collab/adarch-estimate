// ==============================================================
// POST /api/office/call — 「いま話せる（5分）」＝音声の呼びかけを開く
//   ・相手が在席していないと開けない（呼び出しではなく、いる人への声かけ）
//   ・どちらかが通話中なら開けない
//   ・expiresAt = 作成+5分。延長はしない（代表決定 2026-09-01）
// ==============================================================

import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import {
  officeGuard,
  toKnockDTO,
  makeCallToken,
  voiceConfigured,
  ONLINE_WINDOW_MS,
  CALL_MINUTES,
} from "@/lib/office/presence";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  const me = await officeGuard();
  if (me instanceof NextResponse) return me;
  if (!voiceConfigured()) {
    return NextResponse.json({ error: "音声はまだ設定されていません（本部で設定中）" }, { status: 503 });
  }

  let toId = "";
  try {
    const body = (await req.json()) as { toId?: string };
    toId = typeof body.toId === "string" ? body.toId : "";
  } catch {
    return NextResponse.json({ error: "本文が読めません" }, { status: 400 });
  }
  if (!toId || toId === me.id) return NextResponse.json({ error: "相手を選んでください" }, { status: 400 });

  const peer = await db.user.findUnique({
    where: { id: toId },
    select: { id: true, isActive: true, email: true, name: true, role: true, groupCompanyId: true, lastSeenAt: true, officeRoom: true },
  });
  if (!peer || !peer.isActive || peer.email === "demo@adarch.co.jp") {
    return NextResponse.json({ error: "相手が見つかりません" }, { status: 404 });
  }
  const online = !!peer.lastSeenAt && Date.now() - peer.lastSeenAt.getTime() < ONLINE_WINDOW_MS;
  if (!online) {
    return NextResponse.json({ error: "いま離席中のようです。ひとことを残しておきましょう" }, { status: 409 });
  }
  if (peer.officeRoom) {
    return NextResponse.json({ error: "いま別の方と話し中です" }, { status: 409 });
  }
  if (me.officeRoom) {
    return NextResponse.json({ error: "先に今の通話を終えてください" }, { status: 409 });
  }

  const now = new Date();
  const expiresAt = new Date(now.getTime() + CALL_MINUTES * 60_000);
  const knock = await db.officeKnock.create({
    data: {
      kind: "CALL",
      fromId: me.id,
      toId: peer.id,
      message: `🎙 いま話せます（${CALL_MINUTES}分）`,
      expiresAt,
    },
    include: { from: { select: { name: true, email: true } } },
  });
  await db.user.update({ where: { id: me.id }, data: { officeRoom: knock.id } });

  const tk = await makeCallToken({
    room: knock.id,
    userId: me.id,
    name: me.name ?? me.email.split("@")[0],
    expiresAt,
  });
  if (!tk) {
    await db.user.update({ where: { id: me.id }, data: { officeRoom: null } });
    return NextResponse.json({ error: "音声の準備に失敗しました" }, { status: 500 });
  }

  return NextResponse.json({
    item: toKnockDTO(knock),
    call: { room: knock.id, url: tk.url, token: tk.token, expiresAt: expiresAt.toISOString(), peerName: peer.name ?? "", peerId: peer.id, peerIsHq: peer.role === "ADMIN" && !peer.groupCompanyId },
  });
}
