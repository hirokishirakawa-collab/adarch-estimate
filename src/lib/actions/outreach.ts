"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { getSessionInfo } from "@/lib/session";
import { logAudit } from "@/lib/audit";
import { recordSent, unrecordSent } from "@/lib/actions/no-solicitation";
import type { OutreachStatus } from "@/generated/prisma/client";

/// 加盟している段階で全員が使える。本部が個別に許可を出す運用はやめた。
/// データの見える範囲は下の ownerEmail スコープで担保する（ADMINだけが全件を編集できる）。
async function requireOutreach() {
  const info = await getSessionInfo();
  if (!info) return null;
  if (info.role !== "ADMIN" && info.role !== "MANAGER") return null;
  return info;
}

/// 送信後のステータス。ここから先は全社に公開する。
const SHARED_STATUSES = ["SENT", "REPLIED", "MEETING"] as const;

// 自分のアウトリーチ（ADMIN: 全件 / 代表: 自分の担当のみ）
export async function getOutreachLeads() {
  const info = await requireOutreach();
  if (!info) return [];
  return db.outreachLead.findMany({
    where: info.role === "ADMIN" ? {} : { ownerEmail: info.email },
    orderBy: { createdAt: "desc" },
    take: 500,
  });
}

/// 全社の送付状況。送信済み以降だけを、誰でも読み取り専用で見られる。
/// 「どこに誰が当たったか」を共有するのが目的なので、下書き本文と連絡先は返さない。
/// 通常のリード管理（Lead モデル）とは別系統。混ぜない。
export async function getSharedOutreachActivity() {
  const info = await requireOutreach();
  if (!info) return [];
  return db.outreachLead.findMany({
    where: { status: { in: [...SHARED_STATUSES] } },
    select: {
      id: true,
      companyName: true,
      website: true,
      prefecture: true,
      status: true,
      ownerName: true,
      ownerEmail: true,
      sentAt: true,
      repliedAt: true,
      createdAt: true,
    },
    orderBy: [{ sentAt: "desc" }, { createdAt: "desc" }],
    take: 500,
  });
}

// 貼り付けでリード追加（1行1社・「会社名, メール, 事業メモ」）。配信停止メールはスキップ。
export async function addOutreachLeads(raw: string): Promise<{ error?: string; added?: number; skipped?: number }> {
  const info = await requireOutreach();
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
  const info = await requireOutreach();
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
  const info = await requireOutreach();
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

    // 送信済み以降は全社の台帳に載せる。他の拠点が同じ会社に当たらないように。
    // REPLIED / MEETING は送信の後なので、同じく載せたままにする。
    if (status === "SENT" || status === "REPLIED" || status === "MEETING") {
      const lead = await db.outreachLead.findUnique({
        where: { id },
        select: { companyName: true, website: true },
      });
      if (lead) {
        await recordSent({
          url: lead.website,
          companyName: lead.companyName,
          source: "OUTREACH",
          sourceId: id,
        });
      }
    }

    // 未送信の状態に戻したら台帳からも外す（誤って送信済みにした場合の取り消し）。
    // 他の拠点が同じ会社に当たれるよう解放する。
    if (status === "NEW" || status === "DRAFTED") {
      const lead = await db.outreachLead.findUnique({
        where: { id },
        select: { website: true },
      });
      if (lead) await unrecordSent(lead.website, id);
    }
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
  const info = await requireOutreach();
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

/// 一括削除。担当者スコープを効かせるので、他人のリードが混ざっていても消えない。
export async function deleteOutreachLeads(ids: string[]): Promise<{ error?: string; deleted?: number }> {
  const info = await requireOutreach();
  if (!info) return { error: "権限がありません" };
  if (!ids.length) return { deleted: 0 };
  const where =
    info.role === "ADMIN" ? { id: { in: ids } } : { id: { in: ids }, ownerEmail: info.email };
  try {
    const res = await db.outreachLead.deleteMany({ where });
    logAudit({
      action: "outreach_leads_deleted",
      email: info.email,
      name: info.staffName,
      entity: "outreach_lead",
      entityId: `${res.count}件`,
      detail: `アウトリーチ一括削除 ${res.count}件`,
    });
    revalidatePath("/dashboard/outreach-pipeline");
    return { deleted: res.count };
  } catch (e) {
    console.error("[deleteOutreachLeads] DB error:", e instanceof Error ? e.message : e);
    return { error: "削除に失敗しました" };
  }
}

/// 一括ステータス更新。配信停止は1件ずつの経路（updateOutreachStatus）に寄せる。
export async function updateOutreachStatuses(
  ids: string[],
  status: OutreachStatus
): Promise<{ error?: string; updated?: number }> {
  const info = await requireOutreach();
  if (!info) return { error: "権限がありません" };
  if (!ids.length) return { updated: 0 };
  if (status === "OPTOUT") {
    return { error: "配信停止は1件ずつ設定してください（停止リストへの登録が伴うため）" };
  }
  const where =
    info.role === "ADMIN" ? { id: { in: ids } } : { id: { in: ids }, ownerEmail: info.email };
  try {
    const res = await db.outreachLead.updateMany({
      where,
      data: {
        status,
        ...(status === "SENT" ? { sentAt: new Date() } : {}),
        ...(status === "REPLIED" ? { repliedAt: new Date() } : {}),
      },
    });
    revalidatePath("/dashboard/outreach-pipeline");
    return { updated: res.count };
  } catch (e) {
    console.error("[updateOutreachStatuses] DB error:", e instanceof Error ? e.message : e);
    return { error: "更新に失敗しました" };
  }
}
