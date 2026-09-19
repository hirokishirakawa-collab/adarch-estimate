// ==============================================================
// Ad Arch Studio — 依頼をOSの営業の流れ（リード）に乗せる（内部だけ）
//   2026-09-20 代表決定「発注者の場合はクライアント候補にできる」
//   ・依頼（request_order）で連絡先を残した会社だけ。相談だけの人はリードにしない
//   ・同じ会社（メール一致 or 社名一致）の顧客がいれば → 顧客に紐づけるだけ（リードは作らない）
//     同じ会社のリードがいれば → そのリードに紐づけ＋履歴を1行（新しく作らない）
//     どちらも無ければ → 担当拠点の代表を担当にしてリードを作る（取得元=STUDIO_MCP）。本部の一覧に入ったものは本部（ADMIN）が担当
//   ・迷惑の疑いはリードにしない
//   ⚠️ ここで読んだ顧客・リードは、窓口の返答にも公開ツールにも一切返さない（戻り値は紐づけたIDだけ）
//   ⚠️ 依頼の本文はリードに写さない（外部の入力＝OSのAIが読むメモに入れない）。種類と受付番号だけ
// ==============================================================

import { db } from "@/lib/db";

export interface LeadLinkInput {
  inquiryId: string;
  receiptLabel: string;
  kindLabel: string;
  companyName: string;
  email: string;
  phone: string | null;
  prefecture: string | null;
  branchId: string | null;
  groupCompanyId: string | null;
}

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

export async function linkInquiryToLead(input: LeadLinkInput): Promise<{ leadId: string | null; customerId: string | null; created: boolean }> {
  const name = input.companyName.trim();
  const email = input.email.trim().toLowerCase();
  const memoLine = `[AI窓口] ${input.receiptLabel}（${input.kindLabel}）の依頼。内容は「AI窓口からの依頼」で確認`;

  // 1) 既存の顧客
  const customer = await db.customer.findFirst({
    where: { OR: [{ email: { equals: email, mode: "insensitive" } }, { name }] },
    select: { id: true },
  });
  if (customer) {
    await db.studioInquiry.update({ where: { id: input.inquiryId }, data: { customerId: customer.id } });
    return { leadId: null, customerId: customer.id, created: false };
  }

  // 2) 既存のリード
  const lead = await db.lead.findFirst({
    where: { OR: [{ email: { equals: email, mode: "insensitive" } }, { name }] },
    select: { id: true },
  });
  if (lead) {
    await db.$transaction([
      db.leadLog.create({ data: { leadId: lead.id, action: "NOTE", detail: memoLine, staffName: "AI窓口" } }),
      db.studioInquiry.update({ where: { id: input.inquiryId }, data: { leadId: lead.id } }),
    ]);
    return { leadId: lead.id, customerId: null, created: false };
  }

  // 3) 新しく作る（担当拠点の代表が担当）
  const who = await assigneeFor(input.branchId, input.groupCompanyId);
  const created = await db.lead.create({
    data: {
      name,
      email,
      phone: input.phone,
      prefecture: input.prefecture,
      area: input.prefecture,
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
  await db.studioInquiry.update({ where: { id: input.inquiryId }, data: { leadId: created.id } });
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
