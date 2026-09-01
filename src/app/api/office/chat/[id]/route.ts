// ==============================================================
// /api/office/chat/[id] — 投稿を消す（本部=ADMIN のみ）
//   指定した1件を物理削除する。紐づけの履歴（案件ページの会話）からも消える
// ==============================================================

import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { officeGuard } from "@/lib/office/presence";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function DELETE(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const me = await officeGuard();
  if (me instanceof NextResponse) return me;
  if (me.role !== "ADMIN") return NextResponse.json({ error: "本部のみ消せます" }, { status: 403 });

  const { id } = await ctx.params;
  if (!id || id.length > 64) return NextResponse.json({ error: "対象が不正です" }, { status: 400 });

  const r = await db.officeChatMessage.deleteMany({ where: { id } });
  if (r.count === 0) return NextResponse.json({ error: "見つかりませんでした（すでに消えています）" }, { status: 404 });
  return NextResponse.json({ ok: true, id });
}
