export const runtime = "nodejs";
export const maxDuration = 60;

import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { sendChatMessage } from "@/lib/google-chat";

const CRON_SECRET = process.env.CRON_SECRET ?? "";
// 商談・リード・アプローチ事例が既に流れている案件進捗スペース
const NOTIFY_SPACE = process.env.DEAL_CHAT_SPACE_ID ?? "AAQAp6XvXqE";

// ---------------------------------------------------------------
// GET /api/cron/live-digest
// Auth: Bearer {CRON_SECRET}
// Query: ?date=2026-08-24（省略時は前日）／?dry=1 で送らずに本文だけ返す
//
// 前日のグループの動きを1通にまとめて Google Chat へ流す。
// ・1日1回だけ（2026-08-24 代表決定。イベントごとの即時通知はしない）
// ・⚠️ 金額と週次共有は入れない。ライブと同じ線引き
// ・動きが1件も無い日は送らない（無風の通知でスペースを埋めない）
// ---------------------------------------------------------------

function dayRange(dateParam: string | null): { start: Date; end: Date; label: string } {
  let base: Date;
  if (dateParam && /^\d{4}-\d{2}-\d{2}$/.test(dateParam)) {
    const [y, m, d] = dateParam.split("-").map(Number);
    base = new Date(y, m - 1, d);
  } else {
    base = new Date();
    base.setDate(base.getDate() - 1);
  }
  const start = new Date(base.getFullYear(), base.getMonth(), base.getDate());
  const end = new Date(start.getTime() + 86400000);
  return { start, end, label: `${start.getMonth() + 1}/${start.getDate()}` };
}

export async function GET(req: NextRequest) {
  const auth = req.headers.get("authorization") ?? "";
  if (!CRON_SECRET || auth !== `Bearer ${CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { start, end, label } = dayRange(req.nextUrl.searchParams.get("date"));
  const dry = req.nextUrl.searchParams.get("dry") === "1";

  try {
    const [users, deals, dealLogs, moves, sent, leads, bookings] = await Promise.all([
      db.user.findMany({
        select: { id: true, email: true, groupCompany: { select: { name: true } } },
      }),
      db.deal.findMany({
        where: { updatedAt: { gte: start, lt: end } },
        // amount は取らない
        select: {
          status: true,
          assignedToId: true,
          createdById: true,
          customer: { select: { name: true, industry: true } },
          branch: { select: { name: true } },
        },
      }),
      db.dealLog.count({ where: { createdAt: { gte: start, lt: end }, type: { not: "SYSTEM" } } }),
      db.groupMove.findMany({
        where: { movedAt: { gte: start, lt: end } },
        select: { stage: true, industry: true, groupCompany: { select: { name: true } } },
      }),
      db.autoSalesSentDomain.findMany({
        where: { sentAt: { gte: start, lt: end } },
        select: { sentBy: true, branch: { select: { name: true } } },
      }),
      db.lpView.count({ where: { createdAt: { gte: start, lt: end }, event: "lead" } }),
      db.booking.count({ where: { createdAt: { gte: start, lt: end }, status: "CONFIRMED" } }),
    ]);

    // 名前を1本に寄せる。
    //   商談は拠点名（Branch）、動きは加盟会社名で入るので、そのまま数えると
    //   同じ人が「石川」と「瀬野 詠介（石川）」の2行に割れる。
    //   ユーザー経由で加盟会社名へ寄せ、辿れないものだけ拠点名のまま残す。
    const companyByUserId = new Map<string, string>();
    const companyByEmail = new Map<string, string>();
    for (const u of users) {
      if (!u.groupCompany?.name) continue;
      companyByUserId.set(u.id, u.groupCompany.name);
      companyByEmail.set(u.email, u.groupCompany.name);
    }

    const byActor = new Map<string, number>();
    const bump = (name: string) => byActor.set(name, (byActor.get(name) ?? 0) + 1);

    const wonList: string[] = [];
    for (const d of deals) {
      const actor =
        (d.assignedToId ? companyByUserId.get(d.assignedToId) : null) ??
        (d.createdById ? companyByUserId.get(d.createdById) : null) ??
        d.branch.name;
      bump(actor);
      if (d.status === "CLOSED_WON") {
        const ind = d.customer.industry ? `（${d.customer.industry}）` : "";
        wonList.push(`・${actor}\n  「${d.customer.name}」${ind}を受注`);
      }
    }
    for (const m of moves) {
      bump(m.groupCompany.name);
      if (m.stage === "WON") {
        wonList.push(`・${m.groupCompany.name}\n  ${m.industry}で受注`);
      }
    }
    for (const s of sent) {
      bump((s.sentBy ? companyByEmail.get(s.sentBy) : null) ?? s.branch.name);
    }

    const approach = moves.length + sent.length + dealLogs;
    const dealMoved = deals.length;
    const total = approach + dealMoved + leads + bookings;

    if (total === 0) {
      return NextResponse.json({ ok: true, skipped: "動きゼロのため送信なし", date: label });
    }

    const ranking = [...byActor.entries()]
      .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0], "ja"))
      .slice(0, 8)
      .map(([name, n]) => `・${name} ${n}件`);

    const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "";
    const text = [
      `☀️ *昨日のグループ（${label}）*`,
      ``,
      `受注 ${wonList.length}件／商談が動いた ${dealMoved}件／アプローチ ${approach}件`,
      leads || bookings
        ? `資料請求 ${leads}件／面談予約 ${bookings}件`
        : null,
      wonList.length ? `\n🎉 *受注*\n${wonList.join("\n")}` : null,
      ranking.length ? `\n*動いた拠点*\n${ranking.join("\n")}` : null,
      appUrl ? `\n👉 ${appUrl}/dashboard/live` : null,
    ]
      .filter((l) => l !== null)
      .join("\n");

    if (dry) return NextResponse.json({ ok: true, dry: true, date: label, text });

    await sendChatMessage(NOTIFY_SPACE, text);
    return NextResponse.json({ ok: true, date: label, total, sent: true });
  } catch (e) {
    console.error("[cron/live-digest]", e instanceof Error ? e.message : e);
    return NextResponse.json({ error: "Internal Error" }, { status: 500 });
  }
}
