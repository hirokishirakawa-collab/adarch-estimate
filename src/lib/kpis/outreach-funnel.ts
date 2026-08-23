// ---------------------------------------------------------------
// 行動量ボード：送付 → 返信あり → 受注 → 報告済売上 の漏斗を加盟会社ごとに出す。
//   送付     = LeadLog(FORM_SENT) の件数（staffName = User.name ?? email で人に戻す）
//   返信あり = Lead.outreachResult が REPLIED / WON（担当者 = assignee）
//   受注     = Lead.outreachResult が WON
//   報告売上 = RevenueReport.amount（createdBy の加盟会社で集計・税抜）
//   すべて「その月」の出来事で数える（送付日／結果日／計上月）。
//   ⚠️ 送付ログは名前文字列なので、OS上の名前を変えた人は加盟会社に紐づかず「不明」に入る。
// ---------------------------------------------------------------
import { db } from "@/lib/db";

export interface FunnelRow {
  key: string; // groupCompanyId or "__unknown__"
  companyName: string;
  sent: number;
  replied: number;
  won: number;
  reportedAmount: number; // 税抜
  reportCount: number;
}

export interface FunnelBoard {
  month: string; // "YYYY-MM"
  rows: FunnelRow[];
  total: Omit<FunnelRow, "key" | "companyName">;
}

function monthRange(month: string): { start: Date; end: Date; targetMonth: Date } {
  const [y, m] = month.split("-").map(Number);
  return {
    start: new Date(y, m - 1, 1),
    end: new Date(y, m, 1),
    targetMonth: new Date(`${month}-01T00:00:00.000Z`),
  };
}

export function currentMonthKey(d = new Date()): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

export async function getOutreachFunnelBoard(month: string): Promise<FunnelBoard> {
  const { start, end, targetMonth } = monthRange(month);

  const [users, companies, sentLogs, resultLeads, reports] = await Promise.all([
    db.user.findMany({ select: { id: true, name: true, email: true, groupCompanyId: true } }),
    db.groupCompany.findMany({ where: { isActive: true }, select: { id: true, name: true }, orderBy: { name: "asc" } }),
    db.leadLog.groupBy({
      by: ["staffName"],
      where: { action: "FORM_SENT", createdAt: { gte: start, lt: end } },
      _count: { _all: true },
    }),
    db.lead.findMany({
      where: { outreachResultAt: { gte: start, lt: end }, outreachResult: { in: ["REPLIED", "WON"] } },
      select: { assigneeId: true, outreachResult: true },
    }),
    db.revenueReport.findMany({
      where: { targetMonth },
      select: { amount: true, createdById: true },
    }),
  ]);

  // 名前／メール → 加盟会社
  const byName = new Map<string, string | null>();
  const byId = new Map<string, string | null>();
  for (const u of users) {
    byId.set(u.id, u.groupCompanyId);
    if (u.name) byName.set(u.name, u.groupCompanyId);
    byName.set(u.email, u.groupCompanyId);
  }

  const rows = new Map<string, FunnelRow>();
  const UNKNOWN = "__unknown__";
  for (const c of companies) {
    rows.set(c.id, { key: c.id, companyName: c.name, sent: 0, replied: 0, won: 0, reportedAmount: 0, reportCount: 0 });
  }
  const rowOf = (companyId: string | null | undefined): FunnelRow => {
    const key = companyId && rows.has(companyId) ? companyId : UNKNOWN;
    let r = rows.get(key);
    if (!r) {
      r = { key, companyName: "（加盟会社に紐づかない操作）", sent: 0, replied: 0, won: 0, reportedAmount: 0, reportCount: 0 };
      rows.set(key, r);
    }
    return r;
  };

  for (const g of sentLogs) rowOf(byName.get(g.staffName)).sent += g._count._all;
  for (const l of resultLeads) {
    const r = rowOf(l.assigneeId ? byId.get(l.assigneeId) : null);
    r.replied += 1; // WON も「返信あり」を経ている
    if (l.outreachResult === "WON") r.won += 1;
  }
  for (const rep of reports) {
    const r = rowOf(byId.get(rep.createdById));
    r.reportedAmount += Number(rep.amount);
    r.reportCount += 1;
  }

  const list = [...rows.values()].sort((a, b) => b.sent - a.sent || b.reportedAmount - a.reportedAmount);
  const total = list.reduce(
    (t, r) => ({
      sent: t.sent + r.sent,
      replied: t.replied + r.replied,
      won: t.won + r.won,
      reportedAmount: t.reportedAmount + r.reportedAmount,
      reportCount: t.reportCount + r.reportCount,
    }),
    { sent: 0, replied: 0, won: 0, reportedAmount: 0, reportCount: 0 },
  );
  return { month, rows: list, total };
}

/** 自分ひとりの今月の漏斗（月次報告ページの1行表示用） */
export async function getMyFunnel(userId: string, staffName: string, month: string) {
  const { start, end } = monthRange(month);
  const [sent, replied, won, unreportedWon] = await Promise.all([
    db.leadLog.count({ where: { action: "FORM_SENT", staffName, createdAt: { gte: start, lt: end } } }),
    db.lead.count({ where: { assigneeId: userId, outreachResultAt: { gte: start, lt: end }, outreachResult: { in: ["REPLIED", "WON"] } } }),
    db.lead.count({ where: { assigneeId: userId, outreachResultAt: { gte: start, lt: end }, outreachResult: "WON" } }),
    db.lead.count({ where: { assigneeId: userId, outreachResult: "WON", revenueItems: { none: {} } } }),
  ]);
  return { sent, replied, won, unreportedWon };
}
