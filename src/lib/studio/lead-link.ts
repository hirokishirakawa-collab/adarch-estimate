// ==============================================================
// Ad Arch Studio — 依頼をOSの営業の流れ（リード）に乗せる（内部だけ）
//   2026-09-20 代表決定「発注者の場合はクライアント候補にできる」＋最終セキュリティ確認
//   ・リード化するのは、担当（拠点または本部）が依頼を「相談中」か「確定」に進めたときだけ。
//     受付の時点では作らない＝人が確かめるまで、外部の入力はリード一覧・OSのAIに入らない
//   ・同じ会社の判定はメール一致（大文字小文字を無視）だけ。社名が同じだけでは紐づけない
//     顧客にいれば → 顧客に紐づけるだけ（リードは作らない）
//     リードにいれば → そのリードに紐づけ＋履歴を1行（新しく作らない）
//     どちらも無ければ → 担当拠点の代表を担当にしてリードを作る（取得元=STUDIO_MCP）。本部の一覧のものは本部（ADMIN）が担当
//   ・既に紐づいている依頼（leadId / customerId あり）と迷惑の疑いは何もしない＝二重に作らない
//   ⚠️ 依頼の本文はリードに写さない（種類と受付番号だけ）。窓口の返答・公開ツールからは読めない
// ==============================================================

import { db } from "@/lib/db";
import { STUDIO_KIND_LABEL, inquiryNumberLabel } from "./labels";

/** 担当者＝その拠点の代表（県本部の社に所属する人を優先）。本部の一覧に入ったものは本部（ADMIN） */
async function assigneeFor(branchId: string | null, groupCompanyId: string | null): Promise<{ id: string; name: string } | null> {
  if (branchId) {
    const u = await db.user.findFirst({
      where: { isActive: true, role: { not: "ADMIN" }, OR: [{ branchId }, { branchId2: branchId }] },
      orderBy: [{ createdAt: "asc" }],
      select: { id: true, name: true, groupCompanyId: true },
    });
    const same = groupCompanyId
      ? await db.user.findFirst({ where: { isActive: true, role: { not: "ADMIN" }, groupCompanyId, OR: [{ branchId }, { branchId2: branchId }] }, orderBy: { createdAt: "asc" }, select: { id: true, name: true } })
      : null;
    const pick = same ?? u;
    if (pick) return { id: pick.id, name: pick.name ?? "" };
  }
  const admin = await db.user.findFirst({ where: { role: "ADMIN", isActive: true }, orderBy: { createdAt: "asc" }, select: { id: true, name: true } });
  return admin ? { id: admin.id, name: admin.name ?? "" } : null;
}

/** 担当が「相談中」「確定」に進めたときに呼ぶ。紐づけ済み・迷惑の疑い・依頼が無いときは何もしない */
export async function linkInquiryToLead(inquiryId: string): Promise<{ leadId: string | null; customerId: string | null; created: boolean } | null> {
  const q = await db.studioInquiry.findUnique({
    where: { id: inquiryId },
    select: { id: true, number: true, createdAt: true, kind: true, companyName: true, email: true, phone: true, prefecture: true, locationPrefecture: true, assignedBranchId: true, assignedGroupCompanyId: true, suspectedSpam: true, status: true, leadId: true, customerId: true },
  });
  if (!q || q.leadId || q.customerId || q.suspectedSpam || q.status === "SPAM") return null;
  const email = q.email.trim().toLowerCase();
  if (!email) return null;
  const memoLine = `[AI窓口] ${inquiryNumberLabel(q.number, q.createdAt)}（${STUDIO_KIND_LABEL[q.kind]}）の依頼。内容は「AI窓口からの依頼」で確認`;

  // 1) 既存の顧客（メール一致だけ）
  const customer = await db.customer.findFirst({ where: { email: { equals: email, mode: "insensitive" } }, select: { id: true } });
  if (customer) {
    await db.studioInquiry.update({ where: { id: q.id }, data: { customerId: customer.id } });
    return { leadId: null, customerId: customer.id, created: false };
  }

  // 2) 既存のリード（メール一致だけ）
  const lead = await db.lead.findFirst({ where: { email: { equals: email, mode: "insensitive" } }, select: { id: true } });
  if (lead) {
    await db.$transaction([
      db.leadLog.create({ data: { leadId: lead.id, action: "NOTE", detail: memoLine, staffName: "AI窓口" } }),
      db.studioInquiry.update({ where: { id: q.id }, data: { leadId: lead.id } }),
    ]);
    return { leadId: lead.id, customerId: null, created: false };
  }

  // 3) 新しく作る（担当拠点の代表が担当）
  const who = await assigneeFor(q.assignedBranchId, q.assignedGroupCompanyId);
  const pref = q.locationPrefecture ?? q.prefecture;
  const created = await db.lead.create({
    data: {
      name: q.companyName.trim(),
      email,
      phone: q.phone,
      prefecture: pref,
      area: pref,
      source: "STUDIO_MCP",
      status: "UNTOUCHED",
      signalKind: "FOUND",
      signalAt: new Date(),
      memo: memoLine,
      assigneeId: who?.id ?? null,
      logs: { create: { action: "CREATED", detail: memoLine, staffName: "AI窓口" } },
    },
    select: { id: true },
  });
  await db.studioInquiry.update({ where: { id: q.id }, data: { leadId: created.id } });
  return { leadId: created.id, customerId: null, created: true };
}

/** 本部が依頼の担当を付け替えたとき、窓口から作ったリード（未対応のもの）の担当も合わせる */
export async function followReassign(leadId: string | null, branchId: string | null, groupCompanyId: string | null): Promise<void> {
  if (!leadId) return;
  const lead = await db.lead.findUnique({ where: { id: leadId }, select: { source: true, status: true } });
  if (!lead || lead.source !== "STUDIO_MCP" || lead.status !== "UNTOUCHED") return;
  const who = await assigneeFor(branchId, groupCompanyId);
  await db.lead.update({ where: { id: leadId }, data: { assigneeId: who?.id ?? null } });
}
