// ==============================================================
// POST /api/line/webhook/[accountId] — LINE Messaging API Webhook
// LINE Developers の Webhook URL にこのURLを登録する。
// 署名（x-line-signature）をチャネルシークレットで検証してから処理。
// ==============================================================

import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { decryptSecret } from "@/lib/line/secret";
import { verifySignature } from "@/lib/line/client";
import { handleWebhookEvents } from "@/lib/line/service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function POST(req: NextRequest, ctx: { params: Promise<{ accountId: string }> }) {
  const { accountId } = await ctx.params;
  const account = await db.lineAccount.findUnique({ where: { id: accountId } });
  if (!account || !account.isActive) {
    return NextResponse.json({ error: "Unknown account" }, { status: 404 });
  }

  const rawBody = await req.text();
  const secret = decryptSecret(account.channelSecretEnc);
  if (!verifySignature(secret, rawBody, req.headers.get("x-line-signature"))) {
    // 診断用に記録（LINEは届いているのに秘密鍵が合わない＝別チャネルのシークレット等）
    await db.lineAccount.update({
      where: { id: account.id },
      data: {
        webhookErrorAt: new Date(),
        webhookError: "署名が一致しません。チャネルシークレットが Messaging API チャネルのものか確認してください",
      },
    });
    return NextResponse.json({ error: "Bad signature" }, { status: 401 });
  }

  let events: unknown[] = [];
  try {
    const parsed = JSON.parse(rawBody) as { events?: unknown[] };
    events = parsed.events ?? [];
  } catch {
    return NextResponse.json({ error: "Bad JSON" }, { status: 400 });
  }

  // 「検証」ボタンは events が空で届く＝接続確認として時刻だけ記録
  await handleWebhookEvents(account, events as Parameters<typeof handleWebhookEvents>[1]);
  return NextResponse.json({ ok: true });
}

/** ブラウザで開いたときの案内（LINE側は POST しか使わない） */
export async function GET() {
  return NextResponse.json({ ok: true, note: "LINE webhook endpoint. POST only." });
}
