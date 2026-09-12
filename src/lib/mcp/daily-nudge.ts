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

/** AI向け（ツール名を入れる）と、人が読む向け（アーチくんのひとこと）の2つ */
export type TodaysOne = { ai: string; human: string };

/**
 * その日はじめてなら「今日の1件」を返す。2回目以降と、やることが無い日は null
 * （無風の日に何か言わない）。AI連携とアーチくんのひとことで同じ1件を使う＝1日1回。
 */
export async function todaysOne(v: McpViewer): Promise<TodaysOne | null> {
  if (await alreadyShownToday(v.email)) return null;

  const now = new Date();
  const mine = { assigneeId: v.id };
  const alive: Prisma.LeadWhereInput = { status: { notIn: ["SKIPPED", "ARCHIVED", "DEAL_CONVERTED"] } };

  // メモに「電話候補」と書いたまま、OSの電話候補に入っていない先。
  // 自由記述だと一覧にも今日の一手にも出ず、そのまま埋もれる（2026-09-12 実測6件）。
  // 本人のAIから「入れますか？」と勧める＝本部から連絡はしない。
  const legacy = await db.lead.findMany({
    where: {
      ...alive, ...mine, outreachResult: null,
      logs: { some: { action: "NOTE", detail: { contains: "電話候補" } } },
      NOT: { logs: { some: { action: PHONE_CANDIDATE } } },
    },
    take: 10, orderBy: { updatedAt: "asc" },
    select: { id: true, name: true, phone: true },
  });
  if (legacy.length > 0) {
    const names = legacy.slice(0, 3).map((l) => `${l.name}（${l.phone ?? "電話番号なし"}）`).join("・");
    const more = legacy.length > 3 ? ` ほか${legacy.length - 3}件` : "";
    const line = `メモに「電話候補」と残したまま、OSの電話候補に入っていない先が${legacy.length}件あります（${names}${more}）。`;
    return {
      ai: `【今日の1件】${line}record_lead_result(leadId, phoneCandidate: true) で入ります。入れると「今日の一手」の7番に社名と電話番号が並びます。`,
      human: `${line}つないでいるAIに「この${legacy.length}件を電話候補に入れて」と言っていただければ入ります。入れておくと、明日から「今日の一手」に社名と電話番号が並んで出ます。`,
    };
  }

  // 上から順に1件だけ。手が止まっている順＝送ったか分からない → 返事待ち → 期限切れ商談 → 電話候補
  const prepared = await db.lead.findMany({
    where: { ...alive, ...mine, logs: { some: { action: OUTREACH_PREPARED } } },
    take: 3, orderBy: { updatedAt: "asc" },
    select: { id: true, name: true },
  });
  if (prepared.length > 0) {
    const names = prepared.map((l) => l.name).join("・");
    const line = `下書きを作ったまま「送った」が確定していない先が${prepared.length}件あります（${names}）。`;
    return {
      ai: `【今日の1件】${line}送っていれば confirm_sent(leadIds)、送っていなければ confirm_sent(leadIds, sent: false) で取りやめると、その会社に他の拠点が当たれます。`,
      human: `${line}AIに「送りました」または「送っていません」と伝えてください。送っていない分は取りやめになり、その会社に他の拠点が当たれるようになります。`,
    };
  }

  const waiting = await db.lead.findFirst({
    where: { ...alive, ...mine, sentAt: { not: null, lt: new Date(now.getTime() - 7 * DAY_MS) }, outreachResult: null },
    orderBy: { sentAt: "asc" },
    select: { id: true, name: true, sentAt: true },
  });
  if (waiting) {
    const days = waiting.sentAt ? Math.floor((now.getTime() - waiting.sentAt.getTime()) / DAY_MS) : null;
    const line = `${waiting.name} に送って${days ?? "?"}日、まだ返事が記録されていません。`;
    return {
      ai: `【今日の1件】${line}追い連絡をするか、返事が来ていたら record_lead_result(leadId, result) で残してください。`,
      human: `${line}追い連絡をするか、返事が来ていたらAIに一言伝えてください。`,
    };
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
    const line = `${overdue.customer.name}「${overdue.title}」が見込み日を過ぎています。`;
    return {
      ai: `【今日の1件】${line}決まっていれば update_deal、延びたなら expectedCloseDate を直してください。`,
      human: `${line}決まっていれば結果を、延びたなら新しい見込み日を入れてください。`,
    };
  }

  const phone = await db.lead.findFirst({
    where: { ...alive, ...mine, outreachResult: null, logs: { some: { action: PHONE_CANDIDATE } } },
    orderBy: { updatedAt: "asc" },
    select: { id: true, name: true, phone: true },
  });
  if (phone) {
    const line = `${phone.name}（${phone.phone ?? "電話番号なし"}）はメール・フォームが使えない先です。`;
    return {
      ai: `【今日の1件】${line}電話をかけて、話せたら log_activity に残してください。`,
      human: `${line}電話をかけて、話せたら内容をAIに伝えて記録に残してください。`,
    };
  }

  return null;
}
