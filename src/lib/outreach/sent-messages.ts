// ==============================================================
// 送った営業文（メール・フォーム）をグループで見返すための集計
//   元データは送付ログ LeadLog(action=FORM_SENT) の detail＝「【訴求】…\n件名: …\n本文」。
//   DBは増やさず、同じ送り手・同じ日・同じ件名の型（市名を伏せた件名）を1つの文面としてまとめる。
//   宛名（会社名）は伏せる。売上の金額はもともと送付ログに無い。
// ==============================================================
import { createHash } from "crypto";
import { db } from "@/lib/db";
import { OUTREACH_RESULT_OPTIONS } from "@/lib/constants/outreach-result";
import { MAIL_TRACKING, parseTrackingDetail } from "@/lib/outreach/mail-tracking";

const FORM_SENT = "FORM_SENT";
const MASK = "◯◯";

export interface ParsedSentDetail {
  appeal: string;
  subject: string | null;
  body: string;
}

/** 送付ログの detail を訴求・件名・本文に分ける（営業フォーム経由は件名なし） */
export function parseSentDetail(detail: string | null): ParsedSentDetail {
  const lines = (detail ?? "").replace(/^\[AI記録\]\s*/, "").split("\n");
  let appeal = "";
  if (lines[0]?.startsWith("【訴求】")) appeal = lines.shift()!.replace("【訴求】", "").trim();
  let subject: string | null = null;
  if (lines[0]?.startsWith("件名:")) subject = lines.shift()!.replace(/^件名:\s*/, "").trim() || null;
  return { appeal, subject, body: lines.join("\n").trim() };
}

/** 件名の先頭の地名（沼田市・岐阜県 など）を伏せて、市ごとに差し込んだ件名を1つの型にする */
export function subjectPattern(subject: string): string {
  return subject.replace(/^[^\s、。,，!！?？]{1,12}?(都|道|府|県|市|区|町|村)([^\s、。,，!！?？]{1,5}?区)?(エリア)?/, MASK);
}

/** 本文の宛名（1行目の「◯◯　ご担当者様」）と、本文中の会社名を伏せる */
export function maskRecipient(body: string, companyName: string): string {
  const lines = body.split("\n");
  const first = lines.findIndex((l) => l.trim() !== "");
  if (first >= 0 && /(ご担当者様|ご担当者さま|御中|様)\s*$/.test(lines[first])) {
    lines[first] = lines[first].replace(/^.*?(\s*)(ご担当者様|ご担当者さま|御中|様)\s*$/, `${MASK}$1$2`);
  }
  let out = lines.join("\n");
  const name = companyName.trim();
  if (name.length >= 2) out = out.split(name).join(MASK);
  return out;
}

const jstDay = (d: Date) => new Intl.DateTimeFormat("sv-SE", { timeZone: "Asia/Tokyo" }).format(d);

export interface SentMessageVariant {
  body: string;
  areas: string[];
  count: number;
}

export interface SentMessageGroup {
  id: string;
  title: string;
  appeal: string;
  sender: string;
  branch: string | null;
  day: string;
  lastSentAt: Date;
  sent: number;
  emailCount: number;
  formCount: number;
  waiting: number;
  results: { value: string; label: string; count: number }[];
  replied: number;
  /** MailSuite で開封・クリックが登録された社数（開封は目安） */
  opened: number;
  clicked: number;
  areas: string[];
  industries: string[];
  variants: SentMessageVariant[];
}

export type SentMessageSort = "result" | "new" | "count" | "replied" | "opened" | "clicked";

// 「一番結果が出ている文面」を上に出すための点数。
//   返信率をそのまま並べると「1社に送って1社返信＝100%」が最上位に来てしまい、
//   下駄を履かせて均すと今度は「1社に送って返信ゼロ」が「11社に送って返信ゼロ」より上に来る。
//   そこで率の「確からしい下限」（Wilsonの下側95%）で見る。返信ゼロはどれだけ送っても0、
//   返信があるものだけが前に出て、同じ率なら送った数が多いほうが上になる。
//   返信 > クリック > 開封 の順に重く見る（開封はMailSuiteの目安）。
function lowerBound(hit: number, n: number): number {
  if (n <= 0 || hit <= 0) return 0;
  const z = 1.96;
  const p = hit / n;
  const d = 1 + (z * z) / n;
  const c = p + (z * z) / (2 * n) - z * Math.sqrt((p * (1 - p) + (z * z) / (4 * n)) / n);
  return Math.max(0, c / d);
}
function resultScore(g: { sent: number; replied: number; clicked: number; opened: number }): number {
  return lowerBound(g.replied, g.sent) * 1000 + lowerBound(g.clicked, g.sent) * 100 + lowerBound(g.opened, g.sent) * 10;
}

/** 返信率（%・送った数が0なら0）。画面に出す用 */
export function replyRate(g: { sent: number; replied: number }): number {
  return g.sent > 0 ? Math.round((g.replied / g.sent) * 100) : 0;
}

export interface SentMessageQuery {
  from?: Date;
  to?: Date;
  sort?: SentMessageSort;
}

/** 期間内の送付ログを文面ごとにまとめる（新しい順に最大3000件を読む） */
export async function getSentMessageGroups(q: SentMessageQuery = {}): Promise<SentMessageGroup[]> {
  const from = q.from ?? new Date(Date.now() - 90 * 86_400_000);
  const logs = await db.leadLog.findMany({
    where: { action: FORM_SENT, createdAt: { gte: from, ...(q.to ? { lt: q.to } : {}) } },
    orderBy: { createdAt: "desc" },
    take: 3000,
    select: {
      detail: true,
      staffName: true,
      createdAt: true,
      lead: {
        select: {
          id: true,
          name: true,
          area: true,
          industry: true,
          email: true,
          outreachResult: true,
          assignee: { select: { groupCompany: { select: { name: true } } } },
        },
      },
    },
  });

  // MailSuite の開封・クリック（リード×件名）
  const leadIds = [...new Set(logs.map((l) => l.lead.id))];
  const trackLogs = leadIds.length
    ? await db.leadLog.findMany({ where: { action: MAIL_TRACKING, leadId: { in: leadIds } }, select: { leadId: true, detail: true } })
    : [];
  const tracked = new Map<string, { open: Set<string>; click: Set<string> }>();
  for (const t of trackLogs) {
    const p = parseTrackingDetail(t.detail);
    if (!p) continue;
    const e = tracked.get(t.leadId) ?? { open: new Set<string>(), click: new Set<string>() };
    e[p.kind].add(p.subject);
    tracked.set(t.leadId, e);
  }

  const groups = new Map<string, SentMessageGroup & { variantMap: Map<string, SentMessageVariant>; openSet: Set<string>; clickSet: Set<string> }>();
  for (const log of logs) {
    const parsed = parseSentDetail(log.detail);
    if (!parsed.body) continue;
    const day = jstDay(log.createdAt);
    const title = parsed.subject ? subjectPattern(parsed.subject) : parsed.appeal || parsed.body.split("\n").find((l) => l.trim())?.slice(0, 40) || "（件名なし）";
    const key = `${log.staffName}|${day}|${title}`;
    const id = createHash("sha1").update(key).digest("hex").slice(0, 12);

    let g = groups.get(id);
    if (!g) {
      g = {
        id, title, appeal: parsed.appeal, sender: log.staffName,
        branch: log.lead.assignee?.groupCompany?.name ?? null,
        day, lastSentAt: log.createdAt, sent: 0, emailCount: 0, formCount: 0, waiting: 0,
        results: [], replied: 0, opened: 0, clicked: 0, areas: [], industries: [], variants: [], variantMap: new Map(), openSet: new Set(), clickSet: new Set(),
      };
      groups.set(id, g);
    }
    g.sent += 1;
    if (log.lead.email) g.emailCount += 1; else g.formCount += 1;
    if (log.createdAt > g.lastSentAt) g.lastSentAt = log.createdAt;

    const r = log.lead.outreachResult;
    if (!r) g.waiting += 1;
    else {
      const label = OUTREACH_RESULT_OPTIONS.find((o) => o.value === r)?.label ?? r;
      const hit = g.results.find((x) => x.value === r);
      if (hit) hit.count += 1; else g.results.push({ value: r, label, count: 1 });
      if (r === "REPLIED" || r === "WON") g.replied += 1;
    }
    const tr = tracked.get(log.lead.id);
    if (tr) {
      // 件名つきの送付は同じ件名の通知だけ、件名の無い送付（営業フォーム経由）はどの通知でも数える
      const hit = (s: Set<string>) => (parsed.subject ? s.has(parsed.subject) : s.size > 0);
      if (hit(tr.open) || hit(tr.click)) g.openSet.add(log.lead.id);
      if (hit(tr.click)) g.clickSet.add(log.lead.id);
    }
    if (log.lead.area && !g.areas.includes(log.lead.area)) g.areas.push(log.lead.area);
    if (log.lead.industry && !g.industries.includes(log.lead.industry)) g.industries.push(log.lead.industry);

    const masked = maskRecipient(parsed.body, log.lead.name);
    const v = g.variantMap.get(masked);
    if (v) {
      v.count += 1;
      if (log.lead.area && !v.areas.includes(log.lead.area)) v.areas.push(log.lead.area);
    } else {
      g.variantMap.set(masked, { body: masked, areas: log.lead.area ? [log.lead.area] : [], count: 1 });
    }
  }

  const list = [...groups.values()].map(({ variantMap, openSet, clickSet, ...g }) => ({ ...g, opened: openSet.size, clicked: clickSet.size, variants: [...variantMap.values()] }));
  const sort = q.sort ?? "result";
  list.sort((a, b) =>
    sort === "result" ? resultScore(b) - resultScore(a) || b.replied - a.replied || b.sent - a.sent || +b.lastSentAt - +a.lastSentAt
    : sort === "count" ? b.sent - a.sent || +b.lastSentAt - +a.lastSentAt
    : sort === "replied" ? b.replied - a.replied || b.sent - a.sent
    : sort === "opened" ? b.opened - a.opened || b.sent - a.sent
    : sort === "clicked" ? b.clicked - a.clicked || b.sent - a.sent
    : +b.lastSentAt - +a.lastSentAt,
  );
  return list;
}

/** 1つの文面の詳細（共有URL用）。期間は直近1年を見る */
export async function getSentMessageGroup(id: string): Promise<SentMessageGroup | null> {
  const all = await getSentMessageGroups({ from: new Date(Date.now() - 365 * 86_400_000) });
  return all.find((g) => g.id === id) ?? null;
}
