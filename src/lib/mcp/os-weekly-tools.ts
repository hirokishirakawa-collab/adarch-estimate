// ==============================================================
// MCP: 週次共有（グループサポート）を AI から出す
//   my_week            = この1週間の自拠点の事実を1コールで返す（声かけ・返事・活動記録・動いた商談・受注候補・先週の予定）
//   submit_weekly_share = Q1〜Q5 を受け取り、フォームと同じ処理で提出する（共通コア saveWeeklyShare）
//   決まり:
//     - 加盟代表（groupCompanyId あり）だけ。本部ユーザーは対象外
//     - 数字は OS にある記録だけ（AIが盛らない）。金額は返さない
//     - 提出は本人が下書きを確認してから（tool-catalog の confirm）
// ==============================================================

import { db } from "@/lib/db";
import { getBranchFilter } from "@/lib/session";
import { ARCHIVE_BRANCH_ID } from "@/lib/data/customers";
import { getWeekId, Q1_OPTIONS, Q5_OPTIONS } from "@/lib/constants/group-support";
import { saveWeeklyShare, validateWeeklyAnswers } from "@/lib/group-support/submit-weekly";
import type { McpViewer } from "./os-read-tools";
import { WriteError } from "./os-write-tools";

const day = (d: Date | null | undefined) => (d ? d.toISOString().slice(0, 10) : null);
const short = (s: string | null | undefined, n = 160) => {
  const t = (s ?? "").replace(/\s+/g, " ").trim();
  return t.length > n ? `${t.slice(0, n)}…` : t;
};

async function myCompany(v: McpViewer) {
  if (!v.groupCompanyId || v.role === "ADMIN") throw new WriteError("週次共有は加盟代表のアカウントから使えます（本部ユーザーは対象外です）");
  const c = await db.groupCompany.findUnique({ where: { id: v.groupCompanyId }, select: { id: true, name: true, ownerName: true, isActive: true } });
  if (!c || !c.isActive) throw new WriteError("貴社の登録が見つかりません。本部にお問い合わせください");
  return c;
}

/** この1週間（過去7日）の自拠点の事実。週次の下書き材料 */
export async function myWeek(v: McpViewer, input: { days?: number }) {
  const company = await myCompany(v);
  const days = Math.min(14, Math.max(3, Math.floor(input.days ?? 7)));
  const from = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
  const branch = getBranchFilter(v);
  const weekId = getWeekId();

  const [sentLeads, resultLeads, activities, dealLogs, movedDeals, candidates, salesActs, thisWeek, lastWeekly] = await Promise.all([
    db.lead.findMany({ where: { assigneeId: v.id, sentAt: { gte: from } }, select: { name: true, sentAt: true, status: true }, orderBy: { sentAt: "desc" }, take: 50 }),
    db.lead.findMany({ where: { assigneeId: v.id, outreachResultAt: { gte: from } }, select: { name: true, outreachResult: true, outreachResultAt: true, status: true }, orderBy: { outreachResultAt: "desc" }, take: 50 }),
    db.activityLog.findMany({
      where: { createdAt: { gte: from }, customer: { ...branch, NOT: { branchId: ARCHIVE_BRANCH_ID } } },
      select: { type: true, content: true, createdAt: true, customer: { select: { name: true } } },
      orderBy: { createdAt: "desc" },
      take: 40,
    }),
    db.dealLog.findMany({
      where: { createdAt: { gte: from }, deal: branch },
      select: { content: true, createdAt: true, deal: { select: { title: true, customer: { select: { name: true } } } } },
      orderBy: { createdAt: "desc" },
      take: 40,
    }),
    db.deal.findMany({
      where: { ...branch, updatedAt: { gte: from } },
      select: { title: true, status: true, probability: true, expectedCloseDate: true, updatedAt: true, customer: { select: { name: true } } },
      orderBy: { updatedAt: "desc" },
      take: 20,
    }),
    db.deal.findMany({
      where: { ...branch, status: { in: ["NEGOTIATION", "PROPOSAL", "QUALIFYING"] } },
      select: { title: true, status: true, probability: true, expectedCloseDate: true, customer: { select: { name: true } } },
      orderBy: [{ probability: { sort: "desc", nulls: "last" } }, { expectedCloseDate: { sort: "asc", nulls: "last" } }, { updatedAt: "desc" }],
      take: 3,
    }),
    db.salesActivity.findMany({ where: { userId: v.id, date: { gte: from } }, select: { companyName: true, note: true, date: true }, orderBy: { date: "desc" }, take: 30 }),
    db.weeklySubmission.findUnique({ where: { groupCompanyId_weekId: { groupCompanyId: company.id, weekId } }, select: { q1: true, q2: true, q3: true, q4: true, q5: true, status: true, updatedAt: true } }),
    db.weeklySubmission.findFirst({ where: { groupCompanyId: company.id, weekId: { not: weekId } }, orderBy: { weekId: "desc" }, select: { weekId: true, q1: true, q3: true, q4: true, status: true } }),
  ]);

  const replied = resultLeads.filter((l) => l.outreachResult === "REPLIED" || l.outreachResult === "REPLIED_NG" || l.outreachResult === "WON");
  const appointments = resultLeads.filter((l) => l.status === "APPOINTMENT" || l.status === "DEAL_CONVERTED");

  return {
    company: { name: company.name, owner: company.ownerName },
    weekId,
    period: { from: day(from), to: day(new Date()), days },
    alreadySubmittedThisWeek: thisWeek
      ? { status: thisWeek.status, q1: thisWeek.q1, q2: thisWeek.q2, q3: thisWeek.q3, q4: thisWeek.q4, q5: thisWeek.q5, updatedAt: day(thisWeek.updatedAt), note: "今週は提出済み。submit_weekly_share を呼ぶと上書きになる" }
      : null,
    lastWeek: lastWeekly
      ? { weekId: lastWeekly.weekId, q1: lastWeekly.q1, plannedForThisWeek: lastWeekly.q3, shared: lastWeekly.q4, status: lastWeekly.status, note: "先週の『来週やること』。今週やれたかを Q2 に書く材料" }
      : null,
    outreach: {
      sentCount: sentLeads.length,
      sent: sentLeads.slice(0, 15).map((l) => ({ name: l.name, on: day(l.sentAt), status: l.status })),
      repliedCount: replied.length,
      replied: replied.slice(0, 10).map((l) => ({ name: l.name, result: l.outreachResult, on: day(l.outreachResultAt) })),
      appointmentCount: appointments.length,
      appointments: appointments.map((l) => ({ name: l.name, status: l.status })),
      note: "sent＝営業フォーム/AIで『送付済み』にしたリード。replied＝返信あり（NGを含む）",
    },
    activities: {
      count: activities.length + dealLogs.length + salesActs.length,
      customerLogs: activities.slice(0, 15).map((a) => ({ on: day(a.createdAt), type: a.type, customer: a.customer.name, summary: short(a.content) })),
      dealLogs: dealLogs.slice(0, 15).map((d) => ({ on: day(d.createdAt), customer: d.deal.customer.name, deal: d.deal.title, summary: short(d.content) })),
      salesActivities: salesActs.slice(0, 15).map((s) => ({ on: day(s.date), company: s.companyName, note: short(s.note, 100) })),
    },
    movedDeals: movedDeals.map((d) => ({ customer: d.customer.name, title: d.title, status: d.status, probability: d.probability, expectedClose: day(d.expectedCloseDate), updatedAt: day(d.updatedAt) })),
    closestCandidates: candidates.map((d) => ({ customer: d.customer.name, title: d.title, status: d.status, probability: d.probability, expectedClose: day(d.expectedCloseDate) })),
    form: {
      q1: { label: "今週の調子はいかがですか？", options: [...Q1_OPTIONS] },
      q2: { label: "先週やったこと（箇条書きでOK）" },
      q3: { label: "来週やること" },
      q4: { label: "共有・相談したいこと（なければ「特になし」）" },
      q5: { label: "本部からのサポートは必要ですか？", options: [...Q5_OPTIONS] },
    },
    howTo:
      "この材料から Q1〜Q5 の下書きを作り、本人に見せて直してもらってから submit_weekly_share を呼ぶ。数字と相手先名は上の記録にあるものだけを使う（OSに無い活動は本人に聞いて足す）。金額は書かない。Q1 と Q5 は本人に選んでもらう。",
  };
}

/** 週次共有を提出（フォームと同じ処理） */
export async function submitWeeklyShare(v: McpViewer, input: { q1: string; q2: string; q3: string; q4: string; q5: string }) {
  const company = await myCompany(v);
  const answers = { q1: input.q1?.trim(), q2: input.q2?.trim(), q3: input.q3?.trim(), q4: input.q4?.trim(), q5: input.q5?.trim() };
  const invalid = validateWeeklyAnswers(answers);
  if (invalid) throw new WriteError(invalid);

  const r = await saveWeeklyShare({
    company,
    answers,
    source: "AI",
    actorEmail: v.email,
    actorName: v.name ?? company.ownerName,
  });

  return {
    ok: true,
    weekId: r.weekId,
    status: r.status,
    company: company.name,
    message: `${company.name} の週次共有（${r.weekId}）を提出しました。本部のグループサポート画面に「AI記録」の印つきで出ます${answers.q5 !== "今は大丈夫" ? "。サポート要請として本部に通知しました" : ""}`,
  };
}
