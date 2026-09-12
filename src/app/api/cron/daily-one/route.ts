export const runtime = "nodejs";
export const maxDuration = 120;

import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { loadViewer } from "@/lib/mcp/os-read-tools";
import { todaysOne } from "@/lib/mcp/daily-nudge";
import { ensureBotUser, BOT_EMAIL } from "@/lib/office/arch-kun";
import { ONLINE_WINDOW_MS, DEMO_EMAIL } from "@/lib/office/presence";

const CRON_SECRET = process.env.CRON_SECRET ?? "";
const DAY_MS = 86_400_000;
/** 何日動きが無い人には声をかけないか（動かない人を追いかけない・2026-09-13 代表方針） */
const ACTIVE_WITHIN_DAYS = 30;

// ---------------------------------------------------------------
// GET /api/cron/daily-one
// Auth: Bearer {CRON_SECRET}／?dry=1 で送らずに本文だけ返す
//
// アーチくんが、その日の「1件」を各代表に1対1のひとことで届ける（2026-09-13 代表指示）。
// ・OSの中だけ。Google Chatのスペースにも外にも出さない
// ・1人1日1件だけ。AI連携で先に出ていればそちらが優先（同じ判定を共有している）
// ・やることが無い人には送らない。直近30日に動きが無い人にも送らない
// ---------------------------------------------------------------
export async function GET(req: NextRequest) {
  const auth = req.headers.get("authorization") ?? "";
  if (!CRON_SECRET || auth !== `Bearer ${CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const dry = req.nextUrl.searchParams.get("dry") === "1";
  const since = new Date(Date.now() - ACTIVE_WITHIN_DAYS * DAY_MS);

  // 直近に動いた人だけ（OSを触ったかAI連携を使った記録がある人）
  const actives = await db.auditLog.findMany({
    where: { createdAt: { gte: since } },
    distinct: ["email"],
    select: { email: true },
  });
  const users = await db.user.findMany({
    where: {
      isActive: true,
      email: { in: actives.map((a) => a.email), notIn: [BOT_EMAIL, DEMO_EMAIL] },
      role: { in: ["MANAGER", "ADMIN"] },
    },
    select: { id: true, email: true, name: true, lastSeenAt: true },
  });

  const bot = dry ? null : await ensureBotUser();
  const sent: { email: string; message: string }[] = [];
  const skipped: string[] = [];

  for (const u of users) {
    const viewer = await loadViewer(u.email);
    if (!viewer) { skipped.push(u.email); continue; }
    const one = await todaysOne(viewer).catch(() => null);
    if (!one) { skipped.push(u.email); continue; }
    sent.push({ email: u.email, message: one.human });
    if (dry || !bot) continue;

    await db.officeKnock.create({ data: { fromId: bot.id, toId: u.id, message: one.human } });
    // 離席中だけベルにも載せる（在席中は画面に出るので二重にしない）
    const online = !!u.lastSeenAt && Date.now() - u.lastSeenAt.getTime() < ONLINE_WINDOW_MS;
    if (!online) {
      // ベルだけに載せる。既存の通知ヘルパーは本人設定でGoogle Chat・メールへ転送するので使わない
      // （2026-09-13 代表判断＝スペースにも外にも出さない。OSの中だけ）
      await db.notification.create({
        data: { userId: u.id, type: "OFFICE_KNOCK", title: "アーチくんからひとこと", message: one.human, linkUrl: "/dashboard/live" },
      }).catch((e) => console.error("[daily-one:notify]", e));
    }
  }

  return NextResponse.json({ dry, targets: users.length, sent: sent.length, skipped: skipped.length, items: sent });
}
