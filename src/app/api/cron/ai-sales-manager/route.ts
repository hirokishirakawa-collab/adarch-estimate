export const runtime = "nodejs";
export const maxDuration = 120;

import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { db } from "@/lib/db";
import { notifyCeo } from "@/lib/google-chat";
import { ARCHIVE_BRANCH_ID } from "@/lib/data/customers";
import { AI_PREFIX } from "@/lib/mcp/os-write-tools";

const CRON_SECRET = process.env.CRON_SECRET ?? "";

// ---------------------------------------------------------------
// GET /api/cron/ai-sales-manager
// Auth: Bearer {CRON_SECRET}
// Query: ?dry=1 で送らずに本文だけ返す／?raw=1 で集計の生データも返す
//
// 本部AI営業マネージャー（2026-09-09・代表決定）
// ・毎朝、全拠点の商談・リードを本部権限で見渡し「今日、代表が動かすべきこと」を1枚にする
// ・停止商談（30/60/90日）・見込み日超過・担当未設定・返事待ち放置・昨日の動き・AI活用の兆し
// ・送り先は代表だけ（CEO通知スペース）。各拠点には出さない（週次の内容は本部のみ・2026-08-24）
// ・金額は載せない（他拠点の金額を出さない線引きに合わせる。代表は画面で見られる）
// ・Sonnet 固定（ヘッドレス自動化の決まり）。AIが落ちても集計の素の1枚は送る
// ---------------------------------------------------------------

const DAY_MS = 86_400_000;
const JST = 9 * 3_600_000;
const OPEN = ["PROSPECTING", "QUALIFYING", "PROPOSAL", "NEGOTIATION"] as const;
const STATUS_JA: Record<string, string> = { PROSPECTING: "声かけ", QUALIFYING: "検討中", PROPOSAL: "提案中", NEGOTIATION: "交渉中" };

const jstDay = (d: Date) => new Date(d.getTime() + JST).toISOString().slice(0, 10);
const daysSince = (d: Date, now: Date) => Math.floor((now.getTime() - d.getTime()) / DAY_MS);

async function collect() {
  const now = new Date();
  const today0 = new Date(Math.floor((now.getTime() + JST) / DAY_MS) * DAY_MS - JST); // JST 00:00
  const yesterday0 = new Date(today0.getTime() - DAY_MS);
  const in7 = new Date(today0.getTime() + 7 * DAY_MS);

  const [openDeals, waitingLeads, yLogs, yActs, yAiLogs, yAudit, weekAudit, grants, activeCompanies] = await Promise.all([
    db.deal.findMany({
      where: { status: { in: [...OPEN] }, NOT: { branchId: ARCHIVE_BRANCH_ID } },
      select: {
        id: true, title: true, status: true, updatedAt: true, expectedCloseDate: true, assignedToId: true, probability: true,
        customer: { select: { name: true, industry: true } }, branch: { select: { name: true } }, assignedTo: { select: { name: true } },
        dealLogs: { orderBy: { createdAt: "desc" }, take: 1, select: { createdAt: true } },
      },
    }),
    db.lead.findMany({
      where: { status: { notIn: ["SKIPPED", "ARCHIVED", "DEAL_CONVERTED"] }, sentAt: { not: null, lt: new Date(now.getTime() - 14 * DAY_MS) }, outreachResult: null },
      select: { id: true, name: true, sentAt: true, assignee: { select: { name: true, groupCompany: { select: { name: true } } } } },
      orderBy: { sentAt: "asc" },
    }),
    db.dealLog.count({ where: { createdAt: { gte: yesterday0, lt: today0 }, type: { not: "SYSTEM" } } }),
    db.activityLog.count({ where: { createdAt: { gte: yesterday0, lt: today0 } } }),
    db.dealLog.count({ where: { createdAt: { gte: yesterday0, lt: today0 }, content: { startsWith: AI_PREFIX.trim() } } }),
    db.auditLog.findMany({ where: { createdAt: { gte: yesterday0, lt: today0 }, action: { in: ["mcp_os_read", "mcp_os_write", "mcp_connected"] } }, select: { email: true, action: true, detail: true } }),
    db.auditLog.groupBy({ by: ["email"], where: { createdAt: { gte: new Date(today0.getTime() - 7 * DAY_MS) }, action: { in: ["mcp_os_read", "mcp_os_write"] } }, _count: true }),
    db.oAuthGrant.findMany({ where: { revokedAt: null, expiresAt: { gt: now } }, select: { userEmail: true, clientName: true } }),
    db.groupCompany.count({ where: { isActive: true } }),
  ]);

  const enriched = openDeals.map((d) => {
    const last = d.dealLogs[0]?.createdAt ?? d.updatedAt;
    return { ...d, last, idle: daysSince(last, now), over: d.expectedCloseDate && d.expectedCloseDate < today0 ? daysSince(d.expectedCloseDate, now) : null, soon: d.expectedCloseDate && d.expectedCloseDate >= today0 && d.expectedCloseDate < in7 };
  });
  const row = (d: (typeof enriched)[number]) => ({ id: d.id, customer: d.customer.name, industry: d.customer.industry, title: d.title, status: STATUS_JA[d.status] ?? d.status, branch: d.branch.name, assignee: d.assignedTo?.name ?? null, probability: d.probability, lastMoved: jstDay(d.last), idleDays: d.idle, expectedCloseDate: d.expectedCloseDate ? jstDay(d.expectedCloseDate) : null, daysOver: d.over });

  const stalled = enriched.filter((d) => d.status !== "PROSPECTING" && d.idle >= 30).sort((a, b) => b.idle - a.idle);
  const overdue = enriched.filter((d) => d.over != null).sort((a, b) => (b.over ?? 0) - (a.over ?? 0));
  const unassigned = enriched.filter((d) => !d.assignedToId);
  const closingSoon = enriched.filter((d) => d.soon);
  const byBranch = (rows: typeof enriched) => Object.entries(rows.reduce<Record<string, number>>((m, d) => ((m[d.branch.name] = (m[d.branch.name] ?? 0) + 1), m), {})).sort((a, b) => b[1] - a[1]);

  // AI活用: 昨日の利用者・7日の利用者・接続数（本部＝白川代表を除く）
  const users = await db.user.findMany({ where: { email: { in: [...new Set([...yAudit.map((a) => a.email), ...weekAudit.map((a) => a.email), ...grants.map((g) => g.userEmail)])] } }, select: { email: true, name: true, role: true, groupCompany: { select: { name: true } } } });
  const uname = (email: string) => { const u = users.find((x) => x.email === email); return u ? `${u.groupCompany?.name ?? (u.role === "ADMIN" ? "本部" : "拠点なし")}（${u.name ?? email}）` : email; };
  const isHqEmail = (email: string) => users.find((x) => x.email === email)?.role === "ADMIN";
  const aiYesterday = Object.entries(yAudit.filter((a) => !isHqEmail(a.email)).reduce<Record<string, { read: number; write: number; connected: number }>>((m, a) => { const e = (m[a.email] ??= { read: 0, write: 0, connected: 0 }); if (a.action === "mcp_os_read") e.read++; else if (a.action === "mcp_os_write") e.write++; else e.connected++; return m; }, {}))
    .map(([email, c]) => ({ who: uname(email), ...c }));
  const aiWeek = weekAudit.filter((a) => !isHqEmail(a.email)).map((a) => ({ who: uname(a.email), calls: a._count })).sort((a, b) => b.calls - a.calls);
  const connected = [...new Set(grants.filter((g) => !isHqEmail(g.userEmail)).map((g) => g.userEmail))].map((e) => ({ who: uname(e), clients: [...new Set(grants.filter((g) => g.userEmail === e).map((g) => g.clientName ?? "AI"))] }));

  return {
    asOf: jstDay(now),
    counts: { openDeals: openDeals.length, stalled: stalled.length, stalled60: stalled.filter((d) => d.idle >= 60).length, stalled90: stalled.filter((d) => d.idle >= 90).length, overdue: overdue.length, unassigned: unassigned.length, closingSoon: closingSoon.length, waitingLeads: waitingLeads.length, activeCompanies },
    yesterday: { dealLogs: yLogs, activityLogs: yActs, aiRecords: yAiLogs },
    stalled: stalled.slice(0, 12).map(row),
    stalledByBranch: byBranch(stalled),
    overdue: overdue.slice(0, 10).map(row),
    unassigned: unassigned.slice(0, 10).map(row),
    closingSoon: closingSoon.slice(0, 10).map(row),
    waitingLeads: waitingLeads.slice(0, 10).map((l) => ({ id: l.id, name: l.name, sentAt: l.sentAt ? jstDay(l.sentAt) : null, days: l.sentAt ? daysSince(l.sentAt, now) : null, assignee: l.assignee?.name ?? null, company: l.assignee?.groupCompany?.name ?? null })),
    waitingByCompany: Object.entries(waitingLeads.reduce<Record<string, number>>((m, l) => { const k = l.assignee?.groupCompany?.name ?? "担当なし"; m[k] = (m[k] ?? 0) + 1; return m; }, {})).sort((a, b) => b[1] - a[1]),
    ai: { yesterday: aiYesterday, week: aiWeek, connected },
  };
}

type Digest = Awaited<ReturnType<typeof collect>>;

/** AIが落ちた時の素の1枚（集計だけ・金額なし） */
function plainText(d: Digest): string {
  const l: string[] = [];
  l.push(`【本部AI営業マネージャー】${d.asOf} 朝の1枚`);
  l.push(`進行中 ${d.counts.openDeals}件／停止30日超 ${d.counts.stalled}件（60日超 ${d.counts.stalled60}・90日超 ${d.counts.stalled90}）／見込み日超過 ${d.counts.overdue}件／担当未設定 ${d.counts.unassigned}件／返事待ち14日超 ${d.counts.waitingLeads}件`);
  l.push(`昨日の動き: 商談ログ ${d.yesterday.dealLogs}・活動 ${d.yesterday.activityLogs}・うちAI記録 ${d.yesterday.aiRecords}`);
  if (d.closingSoon.length) l.push(`今週見込み: ${d.closingSoon.map((x) => `${x.customer}（${x.branch}・${x.expectedCloseDate}）`).join("、")}`);
  if (d.overdue.length) l.push(`期限超過: ${d.overdue.slice(0, 5).map((x) => `${x.customer}（${x.branch}・${x.daysOver}日）`).join("、")}`);
  if (d.stalled.length) l.push(`停止が長い順: ${d.stalled.slice(0, 5).map((x) => `${x.customer}（${x.branch}・${x.idleDays}日）`).join("、")}`);
  if (d.ai.connected.length) l.push(`AI連携: 接続 ${d.ai.connected.length}社／7日で使った ${d.ai.week.length}社`);
  return l.join("\n");
}

async function compose(d: Digest): Promise<string | null> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return null;
  const client = new Anthropic({ apiKey });
  try {
    const res = await client.messages.create({
      model: "claude-sonnet-5",
      max_tokens: 1200,
      system:
        "あなたはAd Arch（アドアーチ）グループ本部の営業マネージャーAI。白川代表（本部）にだけ届く朝の1枚を書く。" +
        "相手は経営者。丁寧語・前置きなし・見出しは使わず、行頭に『▶』『・』だけ。全体で12〜18行、1行は40字以内。金額は一切書かない。" +
        "構成: 1) 今日、代表が手を打つべき3件（誰に何を言うか。停止が長い・期限超過・確度が高いのに止まっている、を優先。拠点名と相手先を必ず） " +
        "2) 在庫の数（進行中・停止30/60/90・期限超過・担当未設定を1行） 3) 昨日の動き（1行。AI記録があれば触れる） " +
        "4) 返事待ちの放置が多い拠点（あれば1行） 5) AI連携の兆し（接続・利用のある拠点名を1行。無ければ『まだ動きなし』） " +
        "6) 締め＝今日の一手を1行で言い切る。『専門家に相談』『体制を整えてから』は書かない。数字は渡されたものだけ使う。",
      messages: [{ role: "user", content: `今日は ${d.asOf}。集計（JSON）:\n${JSON.stringify(d)}\n\nこの材料で朝の1枚を書いてください。本文だけを出力。` }],
    });
    const text = res.content.filter((b): b is Anthropic.Messages.TextBlock => b.type === "text").map((b) => b.text).join("").trim();
    return text || null;
  } catch (e) {
    console.error("[cron:ai-sales-manager] compose failed:", e instanceof Error ? e.message : e);
    return null;
  }
}

export async function GET(req: NextRequest) {
  const auth = req.headers.get("authorization") ?? "";
  if (!CRON_SECRET || auth !== `Bearer ${CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const dry = req.nextUrl.searchParams.get("dry") === "1";
  const raw = req.nextUrl.searchParams.get("raw") === "1";

  try {
    const digest = await collect();
    const ai = await compose(digest);
    const text = ai ? `【本部AI営業マネージャー】${digest.asOf}\n${ai}` : plainText(digest);
    if (!dry) await notifyCeo(text);
    return NextResponse.json({ ok: true, sent: !dry, composedByAi: !!ai, text, ...(raw ? { digest } : {}) });
  } catch (e) {
    console.error("[cron:ai-sales-manager]", e instanceof Error ? e.message : e);
    return NextResponse.json({ error: "failed" }, { status: 500 });
  }
}
