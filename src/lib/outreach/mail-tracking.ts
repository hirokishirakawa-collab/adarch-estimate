// ==============================================================
// MailSuite の開封・クリック通知を、送った先のリードに記録する
//   MailSuite には公式APIが無いので、各自の Gmail に届く通知の「件名」を読む。
//     開封 : 「info@example.co.jpが「件名」を読みました」 / "… opened «件名»"
//     クリック: 「🔗 info@example.co.jp が「件名」のリンクをクリックしました」 / "… clicked a link at «件名»"
//   相手がメールアドレスで出ている通知だけを、自分が担当のリード（本部は全件）に照合する。
//   DBは増やさず LeadLog(action=MAIL_TRACKING) に1通知1行で残す。開封は目安（自動の開封も含む）。
// ==============================================================
import { db } from "@/lib/db";

export const MAIL_TRACKING = "MAIL_TRACKING";

export type MailTrackingKind = "open" | "click";

export interface MailTrackingItem {
  kind: MailTrackingKind;
  /** 通知に出ている相手（メールアドレスのときだけ照合できる） */
  who: string;
  subject: string;
  /** 通知の日時（分からなければ登録時刻） */
  at?: Date;
}

export interface MailTrackingViewer {
  id: string;
  role: string;
  name: string | null;
  email: string;
}

const KIND_LABEL: Record<MailTrackingKind, string> = { open: "開封", click: "クリック" };

/** 通知の件名1行を読み取る。読めなければ null */
export function parseMailsuiteLine(line: string): Omit<MailTrackingItem, "at"> | null {
  const t = line.replace(/^\s*🔗\s*/, "").trim();
  if (!t) return null;
  let m = t.match(/^(.+?)\s*が「(.+)」のリンクをクリックしました/);
  if (m) return { kind: "click", who: m[1].trim(), subject: m[2].trim() };
  m = t.match(/^(.+?)\s*が「(.+)」を読みました/);
  if (m) return { kind: "open", who: m[1].trim(), subject: m[2].trim() };
  m = t.match(/^(.+?)\s+(?:has just )?clicked a link (?:at|in) «(.+)»/i);
  if (m) return { kind: "click", who: m[1].trim(), subject: m[2].trim() };
  m = t.match(/^(.+?)\s+(?:has just )?(?:opened|read) «(.+)»/i);
  if (m) return { kind: "open", who: m[1].trim(), subject: m[2].trim() };
  return null;
}

const isEmail = (s: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s);

/** 記録の本文（集計側がここから件名を読む） */
export function trackingDetail(kind: MailTrackingKind, subject: string, at: Date): string {
  return `【MailSuite】${KIND_LABEL[kind]}\n件名: ${subject}\n日時: ${at.toISOString()}`;
}

export function parseTrackingDetail(detail: string | null): { kind: MailTrackingKind; subject: string } | null {
  const m = (detail ?? "").match(/^【MailSuite】(開封|クリック)\n件名: (.*)/);
  if (!m) return null;
  return { kind: m[1] === "クリック" ? "click" : "open", subject: m[2].trim() };
}

export interface MailTrackingResult {
  recorded: number;
  duplicated: number;
  skipped: { who: string; subject: string; reason: string }[];
}

export async function recordMailTracking(viewer: MailTrackingViewer, items: MailTrackingItem[]): Promise<MailTrackingResult> {
  const result: MailTrackingResult = { recorded: 0, duplicated: 0, skipped: [] };
  const staffName = viewer.name ?? viewer.email;

  for (const item of items.slice(0, 200)) {
    const who = item.who.trim().toLowerCase();
    const subject = item.subject.trim();
    if (!isEmail(who)) {
      result.skipped.push({ who: item.who, subject, reason: "相手が名前で出ている通知は、アドレスで照合できないため登録しません" });
      continue;
    }
    const leads = await db.lead.findMany({
      where: {
        email: { equals: who, mode: "insensitive" },
        ...(viewer.role === "ADMIN" ? {} : { assigneeId: viewer.id }),
        logs: { some: { action: "FORM_SENT" } },
      },
      select: { id: true },
      take: 5,
    });
    if (leads.length === 0) {
      result.skipped.push({ who: item.who, subject, reason: "このアドレスに送った記録（送付確定済みのリード）が見つかりません" });
      continue;
    }
    const at = item.at && !Number.isNaN(+item.at) ? item.at : new Date();
    const detail = trackingDetail(item.kind, subject, at);
    for (const lead of leads) {
      // 同じ通知を二度登録しない（日時まで同じ、または日時の分からない貼り付けで同じ日・同じ件名・同じ種類）
      const dayStart = new Date(at); dayStart.setHours(0, 0, 0, 0);
      const dup = await db.leadLog.findFirst({
        where: {
          leadId: lead.id,
          action: MAIL_TRACKING,
          OR: [
            { detail },
            ...(item.at ? [] : [{ detail: { startsWith: `【MailSuite】${KIND_LABEL[item.kind]}\n件名: ${subject}\n` }, createdAt: { gte: dayStart } }]),
          ],
        },
        select: { id: true },
      });
      if (dup) { result.duplicated += 1; continue; }
      await db.leadLog.create({ data: { leadId: lead.id, action: MAIL_TRACKING, detail, staffName } });
      result.recorded += 1;
    }
  }
  return result;
}
