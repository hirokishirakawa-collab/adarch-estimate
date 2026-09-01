// ==============================================================
// POST /api/office/knock — 個別の「ひとこと」を送る
//   相手が在席なら beat のトーストで届く。離席中なら既存の通知（ベル・Chat転送・
//   メール設定）に載せる＝見落とさない。
// ==============================================================

import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { createInAppNotification } from "@/lib/notifications";
import { officeGuard, toKnockDTO, ONLINE_WINDOW_MS, BOT_EMAIL } from "@/lib/office/presence";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MAX_LEN = 300;

export async function POST(req: NextRequest) {
  const me = await officeGuard();
  if (me instanceof NextResponse) return me;

  let toId = "";
  let message = "";
  try {
    const body = (await req.json()) as { toId?: string; message?: string };
    toId = typeof body.toId === "string" ? body.toId : "";
    message = typeof body.message === "string" ? body.message.trim() : "";
  } catch {
    return NextResponse.json({ error: "本文が読めません" }, { status: 400 });
  }
  if (!toId || toId === me.id) return NextResponse.json({ error: "相手を選んでください" }, { status: 400 });
  if (!message) return NextResponse.json({ error: "ひとことを入力してください" }, { status: 400 });
  if (message.length > MAX_LEN) {
    return NextResponse.json({ error: `ひとことは${MAX_LEN}文字までです` }, { status: 400 });
  }

  const peer = await db.user.findUnique({
    where: { id: toId },
    select: { id: true, isActive: true, email: true, lastSeenAt: true },
  });
  if (!peer || !peer.isActive || peer.email === "demo@adarch.co.jp" || peer.email === BOT_EMAIL) {
    return NextResponse.json({ error: "相手が見つかりません" }, { status: 404 });
  }

  const knock = await db.officeKnock.create({
    data: { fromId: me.id, toId: peer.id, message },
    include: { from: { select: { name: true, email: true } } },
  });

  // 離席中だけベルに載せる（在席中はトーストで届くので二重にしない）
  const online = !!peer.lastSeenAt && Date.now() - peer.lastSeenAt.getTime() < ONLINE_WINDOW_MS;
  if (!online) {
    createInAppNotification({
      userId: peer.id,
      type: "OFFICE_KNOCK",
      title: `${me.name ?? me.email.split("@")[0]} さんからひとこと`,
      message,
      linkUrl: `/dashboard/live?with=${me.id}`,
    }).catch((e) => console.error("[office:knock:notify]", e));
  }

  return NextResponse.json({ item: toKnockDTO(knock) });
}
