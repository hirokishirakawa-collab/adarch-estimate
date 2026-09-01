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
import { resolveRef, refContextForBot, type RefInput } from "@/lib/office/refs";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MAX_LEN = 300;
const PAGE = 80;

export async function GET(req: NextRequest) {
  const me = await officeGuard();
  if (me instanceof NextResponse) return me;

  const afterRaw = req.nextUrl.searchParams.get("after");
  const after = afterRaw && !Number.isNaN(Date.parse(afterRaw)) ? new Date(afterRaw) : null;
  // 案件別（refKind + refId）＝「この案件の会話」。履歴として後から入った人も読める
  const refKind = req.nextUrl.searchParams.get("refKind");
  const refId = req.nextUrl.searchParams.get("refId");
  const refFilter = refKind && refId ? { refKind, refId } : {};

  const rows = await db.officeChatMessage.findMany({
    where: { ...(after ? { createdAt: { gt: after } } : {}), ...refFilter },
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
  let refInput: RefInput | null = null;
  try {
    const body = (await req.json()) as { text?: string; ref?: RefInput | null };
    text = typeof body.text === "string" ? body.text.trim() : "";
    refInput = body.ref && typeof body.ref === "object" ? body.ref : null;
  } catch {
    return NextResponse.json({ error: "本文が読めません" }, { status: 400 });
  }
  if (!text) return NextResponse.json({ error: "本文を入力してください" }, { status: 400 });
  if (text.length > MAX_LEN) return NextResponse.json({ error: `${MAX_LEN}文字までです` }, { status: 400 });

  // 紐づけは {kind,id} だけ受け取り、題名はサーバーで取り直す
  const ref = await resolveRef(refInput);
  if (refInput && !ref) return NextResponse.json({ error: "紐づけ先が見つかりませんでした" }, { status: 400 });

  const row = await db.officeChatMessage.create({
    data: {
      userId: me.id,
      text,
      refKind: ref?.kind ?? null,
      refId: ref?.id ?? null,
      refTitle: ref?.title ?? null,
      refSub: ref?.sub ?? null,
      refHref: ref?.href ?? null,
    },
    include: { user: { select: chatUserSelect } },
  });

  // アーチくん: 宛名があれば必ず／誰もいない時は質問だけ返す（応答を返してから動く）
  const mention = isMention(text);
  // 紐づけて聞いた質問は、誰かいてもアーチくんが先に材料を出す（人の返事の邪魔はしない長さ）
  const shouldReply = mention || (isQuestionish(text) && ((await othersOnline(me.id)) === 0 || !!ref));
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
        const refContext = ref ? await refContextForBot(ref) : null;
        const reply = await composeBotReply({ text, askerName: me.name ?? me.email.split("@")[0], recent, refContext });
        if (reply) await db.officeChatMessage.create({ data: { userId: bot.id, text: reply } });
      } catch (e) {
        console.error("[office:chat:bot]", e instanceof Error ? e.message : e);
      }
    });
  }

  return NextResponse.json({ item: toChatDTO(row) });
}
