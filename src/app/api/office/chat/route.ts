// ==============================================================
// /api/office/chat — みんなのチャット（全員に見えるタイムライン）
//   GET  ?after=<ISO>  … after より新しい分だけ返す（省略時は直近80件）
//   POST { text }      … 投稿（300文字まで）
//   ⚠️ 金額は書かない前提の場（UI にも注記）。デモ・停止中は見えない
// ==============================================================

import { NextRequest, NextResponse, after } from "next/server";
import { db } from "@/lib/db";
import { officeGuard, chatUserSelect, toChatDTO, BOT_EMAIL } from "@/lib/office/presence";
import { ensureBotUser, isMention, isQuestionish, othersOnline, composeBotReply } from "@/lib/office/arch-kun";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MAX_LEN = 300;
const PAGE = 80;

export async function GET(req: NextRequest) {
  const me = await officeGuard();
  if (me instanceof NextResponse) return me;

  const afterRaw = req.nextUrl.searchParams.get("after");
  const after = afterRaw && !Number.isNaN(Date.parse(afterRaw)) ? new Date(afterRaw) : null;

  const rows = await db.officeChatMessage.findMany({
    where: after ? { createdAt: { gt: after } } : undefined,
    include: { user: { select: chatUserSelect } },
    orderBy: { createdAt: "desc" },
    take: PAGE,
  });

  return NextResponse.json({ meId: me.id, items: rows.reverse().map(toChatDTO) });
}

export async function POST(req: NextRequest) {
  const me = await officeGuard();
  if (me instanceof NextResponse) return me;

  let text = "";
  try {
    const body = (await req.json()) as { text?: string };
    text = typeof body.text === "string" ? body.text.trim() : "";
  } catch {
    return NextResponse.json({ error: "本文が読めません" }, { status: 400 });
  }
  if (!text) return NextResponse.json({ error: "本文を入力してください" }, { status: 400 });
  if (text.length > MAX_LEN) return NextResponse.json({ error: `${MAX_LEN}文字までです` }, { status: 400 });

  const row = await db.officeChatMessage.create({
    data: { userId: me.id, text },
    include: { user: { select: chatUserSelect } },
  });

  // アーチくん: 宛名があれば必ず／誰もいない時は質問だけ返す（応答を返してから動く）
  const mention = isMention(text);
  const shouldReply = mention || (isQuestionish(text) && (await othersOnline(me.id)) === 0);
  if (shouldReply) {
    after(async () => {
      try {
        const bot = await ensureBotUser();
        const recentRows = await db.officeChatMessage.findMany({
          where: { id: { not: row.id } },
          include: { user: { select: { name: true, email: true } } },
          orderBy: { createdAt: "desc" },
          take: 10,
        });
        const recent = recentRows.reverse().map((r) => ({
          name: r.user.name ?? r.user.email.split("@")[0],
          text: r.text,
          isBot: r.user.email === BOT_EMAIL,
        }));
        const reply = await composeBotReply({ text, askerName: me.name ?? me.email.split("@")[0], recent });
        if (reply) await db.officeChatMessage.create({ data: { userId: bot.id, text: reply } });
      } catch (e) {
        console.error("[office:chat:bot]", e instanceof Error ? e.message : e);
      }
    });
  }

  return NextResponse.json({ item: toChatDTO(row) });
}
