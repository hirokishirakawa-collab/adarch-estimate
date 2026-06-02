"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { getSessionInfo } from "@/lib/session";
import { logAudit } from "@/lib/audit";
import type { OutreachStatus } from "@/generated/prisma/client";

// 当面は本部（ADMIN）限定。段階公開はPhase0（ドメイン/法務/運用ガイド）整備後に。
async function requireAdmin() {
  const info = await getSessionInfo();
  if (!info || info.role !== "ADMIN") return null;
  return info;
}

// 一覧（ADMIN: 全件 / その他: 自分の担当のみ）
export async function getOutreachLeads() {
  const info = await requireAdmin();
  if (!info) return [];
  return db.outreachLead.findMany({
    where: info.role === "ADMIN" ? {} : { ownerEmail: info.email },
    orderBy: { createdAt: "desc" },
    take: 500,
  });
}

// 貼り付けでリード追加（1行1社・「会社名, メール, 事業メモ」）。配信停止メールはスキップ。
export async function addOutreachLeads(raw: string): Promise<{ error?: string; added?: number; skipped?: number }> {
  const info = await requireAdmin();
  if (!info) return { error: "権限がありません" };

  const lines = raw.split("\n").map((l) => l.trim()).filter(Boolean);
  if (lines.length === 0) return { added: 0 };

  const optOuts = new Set(
    (await db.outreachOptOut.findMany({ select: { email: true } })).map((o) => o.email.toLowerCase()),
  );

  let skipped = 0;
  const rows = lines
    .map((line) => {
      const parts = line.split(/[\t,]/).map((p) => p.trim());
      const companyName = parts[0] ?? "";
      const email = parts.find((p) => p.includes("@")) ?? null;
      const note = parts.slice(1).filter((p) => !p.includes("@")).join(" ") || null;
      return { companyName, email, note };
    })
    .filter((r) => {
      if (!r.companyName) return false;
      if (r.email && optOuts.has(r.email.toLowerCase())) { skipped++; return false; }
      return true;
    })
    .map((r) => ({
      companyName: r.companyName,
      email: r.email,
      businessNote: r.note,
      ownerEmail: info.email,
      ownerName: info.staffName,
      senderEmail: info.email,
    }));

  if (rows.length === 0) return { added: 0, skipped };

  try {
    const result = await db.outreachLead.createMany({ data: rows });
    logAudit({ action: "outreach_leads_added", email: info.email, name: info.staffName, entity: "outreach_lead", entityId: `${result.count}件`, detail: `アウトリーチ追加 ${result.count}件（配信停止スキップ${skipped}）` });
    revalidatePath("/dashboard/outreach-pipeline");
    return { added: result.count, skipped };
  } catch (e) {
    console.error("[addOutreachLeads] DB error:", e instanceof Error ? e.message : e);
    return { error: "追加に失敗しました" };
  }
}

// AI生成した下書きを保存
export async function saveOutreachDraft(id: string, subject: string, body: string): Promise<{ error?: string }> {
  const info = await requireAdmin();
  if (!info) return { error: "権限がありません" };
  // 担当者スコープ（IDOR防止）: ADMIN以外は自分の担当リードのみ
  const where = info.role === "ADMIN" ? { id } : { id, ownerEmail: info.email };
  try {
    const res = await db.outreachLead.updateMany({
      where,
      data: { draftSubject: subject, draftBody: body, draftedAt: new Date(), status: "DRAFTED" },
    });
    if (res.count === 0) return { error: "権限がありません" };
  } catch (e) {
    console.error("[saveOutreachDraft] DB error:", e instanceof Error ? e.message : e);
    return { error: "保存に失敗しました" };
  }
  revalidatePath("/dashboard/outreach-pipeline");
  return {};
}

// ステータス更新（OPTOUT は配信停止リストにも登録）
export async function updateOutreachStatus(id: string, status: OutreachStatus): Promise<{ error?: string }> {
  const info = await requireAdmin();
  if (!info) return { error: "権限がありません" };
  // 担当者スコープ（IDOR防止）
  const where = info.role === "ADMIN" ? { id } : { id, ownerEmail: info.email };
  try {
    const res = await db.outreachLead.updateMany({
      where,
      data: {
        status,
        ...(status === "SENT" ? { sentAt: new Date() } : {}),
        ...(status === "REPLIED" ? { repliedAt: new Date() } : {}),
      },
    });
    if (res.count === 0) return { error: "権限がありません" };
    if (status === "OPTOUT") {
      const lead = await db.outreachLead.findUnique({ where: { id }, select: { email: true } });
      if (lead?.email) {
        await db.outreachOptOut.upsert({
          where: { email: lead.email },
          create: { email: lead.email, reason: "アウトリーチ画面で配信停止" },
          update: {},
        });
      }
    }
  } catch (e) {
    console.error("[updateOutreachStatus] DB error:", e instanceof Error ? e.message : e);
    return { error: "更新に失敗しました" };
  }
  revalidatePath("/dashboard/outreach-pipeline");
  return {};
}

export async function deleteOutreachLead(id: string): Promise<{ error?: string }> {
  const info = await requireAdmin();
  if (!info) return { error: "権限がありません" };
  // 担当者スコープ（IDOR防止）
  const where = info.role === "ADMIN" ? { id } : { id, ownerEmail: info.email };
  try {
    const res = await db.outreachLead.deleteMany({ where });
    if (res.count === 0) return { error: "権限がありません" };
  } catch (e) {
    console.error("[deleteOutreachLead] DB error:", e instanceof Error ? e.message : e);
    return { error: "削除に失敗しました" };
  }
  revalidatePath("/dashboard/outreach-pipeline");
  return {};
}
