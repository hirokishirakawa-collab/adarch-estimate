// ==============================================================
// /api/office/chat/[id]/react — 投稿に絵文字リアクションを付ける／外す（トグル）
//   POST { emoji }  … 固定セット（👍❤️🔥👏😂🙏）のみ。自分が既に押していれば外す
//   返り値: その投稿の最新のリアクション集計
//   通知は出さない（声かけの場を騒がしくしない）
// ==============================================================

import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { officeGuard } from "@/lib/office/presence";
import { isReactionEmoji, reactionsForMessages } from "@/lib/office/reactions";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const me = await officeGuard();
  if (me instanceof NextResponse) return me;

  const { id } = await ctx.params;
  if (!id || id.length > 64) return NextResponse.json({ error: "対象が不正です" }, { status: 400 });

  let emoji: unknown = null;
  try {
    emoji = ((await req.json()) as { emoji?: unknown }).emoji;
  } catch {
    return NextResponse.json({ error: "本文が読めません" }, { status: 400 });
  }
  if (!isReactionEmoji(emoji)) return NextResponse.json({ error: "その絵文字は使えません" }, { status: 400 });

  const msg = await db.officeChatMessage.findUnique({ where: { id }, select: { id: true } });
  if (!msg) return NextResponse.json({ error: "投稿が見つかりませんでした（すでに消えています）" }, { status: 404 });

  // トグル: 消せたら「外した」・消せなければ「付ける」
  const removed = await db.officeChatReaction.deleteMany({ where: { messageId: id, userId: me.id, emoji } });
  let active = false;
  if (removed.count === 0) {
    try {
      await db.officeChatReaction.create({ data: { messageId: id, userId: me.id, emoji } });
      active = true;
    } catch (e) {
      // 二重押し（同時リクエスト）は unique 違反＝既に付いている扱い
      if ((e as { code?: string }).code !== "P2002") throw e;
      active = true;
    }
  }

  const reactions = (await reactionsForMessages([id], me.id))[id] ?? [];
  return NextResponse.json({ ok: true, id, emoji, active, reactions });
}
