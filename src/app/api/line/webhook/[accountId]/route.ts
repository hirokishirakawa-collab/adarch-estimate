// ==============================================================
// POST /api/line/webhook/[accountId] — LINE Messaging API Webhook
// LINE Developers の Webhook URL にこのURLを登録する。
// 署名（x-line-signature）をチャネルシークレットで検証してから処理。
// ==============================================================

import { NextRequest, NextResponse, after } from "next/server";
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
  const signature = req.headers.get("x-line-signature");
  if (!verifySignature(secret, rawBody, signature)) {
    // 署名ヘッダ自体が無い＝LINE以外からのアクセス（スキャナ等）。記録せずに弾く
    if (!signature) return NextResponse.json({ error: "Bad signature" }, { status: 401 });
    // 診断用に記録（LINEは届いているのに秘密鍵が合わない＝別チャネルのシークレット等）。書き込みは60秒に1回まで
    if (account.webhookErrorAt && Date.now() - account.webhookErrorAt.getTime() < 60_000) {
      return NextResponse.json({ error: "Bad signature" }, { status: 401 });
    }
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

  // LINEには先に200を返し、処理は応答後に続ける（応答遅延による再送・重複を防ぐ）
  // 「検証」ボタンは events が空で届く＝接続確認として時刻だけ記録
  after(async () => {
    try {
      await handleWebhookEvents(account, events as Parameters<typeof handleWebhookEvents>[1]);
    } catch (e) {
      console.error("[line/webhook] handle failed", e);
    }
  });
  return NextResponse.json({ ok: true });
}

/** ブラウザで開いたときの案内（LINE側は POST しか使わない） */
export async function GET() {
  return NextResponse.json({ ok: true, note: "LINE webhook endpoint. POST only." });
}
