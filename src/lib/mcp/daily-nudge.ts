// ==============================================================
// 「今日の1件」— その日はじめてAIからOSに触れたときだけ、返事の末尾に1行そえる
//
//   こちらから通知は送らない（2026-09-13 代表判断＝スペースへの連絡はしない）。
//   本人がAIに話しかけたときにだけ目に入る形にする。
//   出すのは1件だけ。複数並べると選ぶ手間で止まるため。
//   1日1回の判定は app_settings（key/value）に置く。スキーマは足さない。
// ==============================================================

import type { Prisma } from "@/generated/prisma/client";
import { db } from "@/lib/db";
import { getBranchFilter } from "@/lib/session";
import { PHONE_CANDIDATE, OUTREACH_PREPARED } from "@/lib/constants/leads";
import type { McpViewer } from "./os-read-tools";

const JST = 9 * 60 * 60 * 1000;
const DAY_MS = 86_400_000;
const jstDay = (d = new Date()) => new Date(d.getTime() + JST).toISOString().slice(0, 10);

/** 今日はもう出したか。出していなければ今日の印を付けて false を返す */
async function alreadyShownToday(email: string): Promise<boolean> {
  const key = `mcp_nudge:${email}`;
  const today = jstDay();
  const seen = await db.appSetting.findUnique({ where: { key }, select: { value: true } });
  if (seen?.value === today) return true;
  await db.appSetting.upsert({ where: { key }, create: { key, value: today }, update: { value: today } });
  return false;
}

/**
 * その日はじめての呼び出しなら「今日の1件」を1行で返す。2回目以降と、
 * やることが無い日は null（無風の日に何か言わない）。
 */
export async function todaysOne(v: McpViewer): Promise<string | null> {
  if (await alreadyShownToday(v.email)) return null;

  const now = new Date();
  const mine = { assigneeId: v.id };
  const alive: Prisma.LeadWhereInput = { status: { notIn: ["SKIPPED", "ARCHIVED", "DEAL_CONVERTED"] } };

  // 上から順に1件だけ。手が止まっている順＝送ったか分からない → 返事待ち → 期限切れ商談 → 電話候補
  const prepared = await db.lead.findMany({
    where: { ...alive, ...mine, logs: { some: { action: OUTREACH_PREPARED } } },
    take: 3, orderBy: { updatedAt: "asc" },
    select: { id: true, name: true },
  });
  if (prepared.length > 0) {
    const names = prepared.map((l) => l.name).join("・");
    return `【今日の1件】下書きを作ったまま「送った」が確定していない先が${prepared.length}件あります（${names}）。送っていれば confirm_sent、送っていなければ confirm_sent(sent: false) で取りやめると、その会社に他の拠点が当たれます。`;
  }

  const waiting = await db.lead.findFirst({
    where: { ...alive, ...mine, sentAt: { not: null, lt: new Date(now.getTime() - 7 * DAY_MS) }, outreachResult: null },
    orderBy: { sentAt: "asc" },
    select: { id: true, name: true, sentAt: true },
  });
  if (waiting) {
    const days = waiting.sentAt ? Math.floor((now.getTime() - waiting.sentAt.getTime()) / DAY_MS) : null;
    return `【今日の1件】${waiting.name} に送って${days ?? "?"}日、まだ返事が記録されていません。追い連絡をするか、返事が来ていたら record_lead_result(leadId, result) で残してください。`;
  }

  const overdue = await db.deal.findFirst({
    where: {
      ...getBranchFilter(v),
      status: { in: ["PROSPECTING", "QUALIFYING", "PROPOSAL", "NEGOTIATION"] },
      expectedCloseDate: { lt: new Date(now.getFullYear(), now.getMonth(), now.getDate()) },
    },
    orderBy: { expectedCloseDate: "asc" },
    select: { id: true, title: true, customer: { select: { name: true } } },
  });
  if (overdue) {
    return `【今日の1件】${overdue.customer.name}「${overdue.title}」が見込み日を過ぎています。決まっていれば update_deal、延びたなら期日を直してください。`;
  }

  const phone = await db.lead.findFirst({
    where: { ...alive, ...mine, outreachResult: null, logs: { some: { action: PHONE_CANDIDATE } } },
    orderBy: { updatedAt: "asc" },
    select: { id: true, name: true, phone: true },
  });
  if (phone) {
    return `【今日の1件】${phone.name}（${phone.phone ?? "電話番号なし"}）はメール・フォームが使えない先です。電話をかけて、話せたら log_activity に残してください。`;
  }

  return null;
}
