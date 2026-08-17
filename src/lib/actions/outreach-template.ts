"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { getSessionInfo } from "@/lib/session";

/**
 * 自分の定型文。
 *
 * AIの下書きをそのまま送るのではなく、自分の言い回しを持っておいて全件に反映できるようにする。
 * 保存先は OutreachSample（営業フォームの「マイサンプル」と同じ表）。
 * アウトリーチは件名も持つので、name に "__outreach__" を入れて区別し、
 * text に「件名\n---\n本文」の形で入れる。表を増やさずに済ませる。
 */

const OUTREACH_KEY = "__outreach__";
const SEP = "\n---\n";

export type MyTemplate = { subject: string; body: string } | null;

async function requireUser() {
  const info = await getSessionInfo();
  if (!info) return null;
  if (info.role !== "ADMIN" && info.role !== "MANAGER") return null;
  return info;
}

/** 差し込み変数を実際の値に置き換える */
function fill(text: string, lead: { companyName: string; contactName: string | null }): string {
  return text
    .replace(/\{会社名\}/g, lead.companyName)
    .replace(/\{companyName\}/g, lead.companyName)
    .replace(/\{担当者\}/g, lead.contactName ?? "ご担当者");
}

export async function getMyTemplate(): Promise<MyTemplate> {
  const info = await requireUser();
  if (!info) return null;
  const row = await db.outreachSample.findFirst({
    where: { userId: info.userId, name: OUTREACH_KEY },
  });
  if (!row) return null;
  const i = row.text.indexOf(SEP);
  if (i === -1) return { subject: "", body: row.text };
  return { subject: row.text.slice(0, i), body: row.text.slice(i + SEP.length) };
}

export async function saveMyTemplate(
  subject: string,
  body: string
): Promise<{ error?: string }> {
  const info = await requireUser();
  if (!info) return { error: "権限がありません" };
  if (!body.trim()) return { error: "本文を入力してください" };

  const text = `${subject.trim()}${SEP}${body.trim()}`;
  const existing = await db.outreachSample.findFirst({
    where: { userId: info.userId, name: OUTREACH_KEY },
    select: { id: true },
  });

  if (existing) {
    await db.outreachSample.update({ where: { id: existing.id }, data: { text } });
  } else {
    await db.outreachSample.create({
      data: { userId: info.userId, name: OUTREACH_KEY, text, sortOrder: 0 },
    });
  }
  revalidatePath("/dashboard/outreach-pipeline");
  return {};
}

export async function deleteMyTemplate(): Promise<void> {
  const info = await requireUser();
  if (!info) return;
  await db.outreachSample.deleteMany({ where: { userId: info.userId, name: OUTREACH_KEY } });
  revalidatePath("/dashboard/outreach-pipeline");
}

/**
 * 自分の定型文を、指定したリードの下書きへ一括で入れる。
 * 既に下書きがある会社は、上書きするかどうかを呼び出し側で選べるようにする。
 */
export async function applyMyTemplate(
  leadIds: string[],
  opts: { overwrite: boolean }
): Promise<{ error?: string; applied?: number; skipped?: number }> {
  const info = await requireUser();
  if (!info) return { error: "権限がありません" };

  const tpl = await getMyTemplate();
  if (!tpl || !tpl.body.trim()) return { error: "先に自分の定型文を保存してください" };
  if (!leadIds.length) return { applied: 0 };

  const where =
    info.role === "ADMIN"
      ? { id: { in: leadIds } }
      : { id: { in: leadIds }, ownerEmail: info.email };

  const leads = await db.outreachLead.findMany({
    where,
    select: { id: true, companyName: true, contactName: true, draftBody: true, status: true },
  });

  let applied = 0;
  let skipped = 0;

  for (const l of leads) {
    // 送信済み以降は触らない。既に出した文面を書き換えても意味がないため
    if (l.status !== "NEW" && l.status !== "DRAFTED") { skipped++; continue; }
    if (l.draftBody && !opts.overwrite) { skipped++; continue; }

    await db.outreachLead.update({
      where: { id: l.id },
      data: {
        draftSubject: fill(tpl.subject, l),
        draftBody: fill(tpl.body, l),
        draftedAt: new Date(),
        status: "DRAFTED",
      },
    });
    applied++;
  }

  revalidatePath("/dashboard/outreach-pipeline");
  return { applied, skipped };
}
