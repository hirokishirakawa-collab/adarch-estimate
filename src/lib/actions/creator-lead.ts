"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { getSessionInfo } from "@/lib/session";
import { logAudit } from "@/lib/audit";
import type { CreatorLeadStatus } from "@/generated/prisma/client";

async function requireAdmin() {
  const info = await getSessionInfo();
  if (!info || info.role !== "ADMIN") return null;
  return info;
}

// ---------------------------------------------------------------
// 一覧（ADMIN・白川代表のみ）
// ---------------------------------------------------------------
export async function getCreatorLeads() {
  const info = await requireAdmin();
  if (!info) return [];
  return db.creatorLead.findMany({ orderBy: { createdAt: "desc" }, take: 500 });
}

// ---------------------------------------------------------------
// 発掘結果を保存（重複はスキップ）
// ---------------------------------------------------------------
type DiscoveredCreator = {
  name?: string; handle?: string; prefecture?: string; genre?: string; skills?: string; achievements?: string;
  portfolioUrl?: string; websiteUrl?: string; youtubeUrl?: string; instagramUrl?: string; xUrl?: string; tiktokUrl?: string; email?: string;
  scoreTotal?: number; scoreComment?: string; fitReason?: string; aiAdvice?: string;
};

export async function saveCreatorLeads(creators: DiscoveredCreator[]): Promise<{ error?: string; saved?: number }> {
  const info = await requireAdmin();
  if (!info) return { error: "権限がありません" };
  if (!Array.isArray(creators) || creators.length === 0) return { saved: 0 };

  const s = (v: unknown) => (typeof v === "string" && v.trim() ? v.trim() : null);
  const rows = creators
    .filter((c) => s(c.name))
    .map((c) => ({
      name: s(c.name)!,
      handle: s(c.handle),
      prefecture: s(c.prefecture),
      genre: s(c.genre),
      skills: s(c.skills),
      achievements: s(c.achievements),
      portfolioUrl: s(c.portfolioUrl),
      websiteUrl: s(c.websiteUrl),
      youtubeUrl: s(c.youtubeUrl),
      instagramUrl: s(c.instagramUrl),
      xUrl: s(c.xUrl),
      tiktokUrl: s(c.tiktokUrl),
      email: s(c.email),
      scoreTotal: typeof c.scoreTotal === "number" ? Math.round(c.scoreTotal) : null,
      scoreComment: s(c.scoreComment),
      fitReason: s(c.fitReason),
      aiAdvice: s(c.aiAdvice),
      ownerEmail: info.email,
      ownerName: info.staffName,
    }));

  if (rows.length === 0) return { saved: 0 };

  try {
    const result = await db.creatorLead.createMany({ data: rows, skipDuplicates: true });
    logAudit({
      action: "creator_leads_saved",
      email: info.email,
      name: info.staffName,
      entity: "creator_lead",
      entityId: rows.map((r) => r.name).join(",").slice(0, 200),
      detail: `クリエイター発掘 ${result.count}件 保存`,
    });
    revalidatePath("/dashboard/creator-leads");
    return { saved: result.count };
  } catch (e) {
    console.error("[saveCreatorLeads] DB error:", e instanceof Error ? e.message : e);
    return { error: "保存に失敗しました" };
  }
}

// ---------------------------------------------------------------
// ステータス・メモ・優先度・次アクションの更新
// ---------------------------------------------------------------
export async function updateCreatorLead(
  id: string,
  data: { status?: CreatorLeadStatus; priority?: string | null; notes?: string | null; nextAction?: string | null },
): Promise<{ error?: string }> {
  const info = await requireAdmin();
  if (!info) return { error: "権限がありません" };

  try {
    await db.creatorLead.update({
      where: { id },
      data: {
        ...(data.status !== undefined ? { status: data.status } : {}),
        ...(data.priority !== undefined ? { priority: data.priority } : {}),
        ...(data.notes !== undefined ? { notes: data.notes } : {}),
        ...(data.nextAction !== undefined ? { nextAction: data.nextAction } : {}),
        ...(data.status === "CONTACTED" ? { contactedAt: new Date() } : {}),
      },
    });
  } catch (e) {
    console.error("[updateCreatorLead] DB error:", e instanceof Error ? e.message : e);
    return { error: "更新に失敗しました" };
  }
  revalidatePath("/dashboard/creator-leads");
  return {};
}

// ---------------------------------------------------------------
// 削除（単件・一括）
// ---------------------------------------------------------------
export async function deleteCreatorLead(id: string): Promise<{ error?: string }> {
  const info = await requireAdmin();
  if (!info) return { error: "権限がありません" };
  try {
    await db.creatorLead.delete({ where: { id } });
    logAudit({ action: "creator_lead_deleted", email: info.email, name: info.staffName, entity: "creator_lead", entityId: id });
  } catch (e) {
    console.error("[deleteCreatorLead] DB error:", e instanceof Error ? e.message : e);
    return { error: "削除に失敗しました" };
  }
  revalidatePath("/dashboard/creator-leads");
  return {};
}

export async function bulkDeleteCreatorLeads(ids: string[]): Promise<{ error?: string; deleted?: number }> {
  const info = await requireAdmin();
  if (!info) return { error: "権限がありません" };
  if (!ids?.length) return { deleted: 0 };
  try {
    const result = await db.creatorLead.deleteMany({ where: { id: { in: ids } } });
    logAudit({ action: "creator_leads_bulk_deleted", email: info.email, name: info.staffName, entity: "creator_lead", entityId: `${result.count}件` });
    revalidatePath("/dashboard/creator-leads");
    return { deleted: result.count };
  } catch (e) {
    console.error("[bulkDeleteCreatorLeads] DB error:", e instanceof Error ? e.message : e);
    return { error: "一括削除に失敗しました" };
  }
}
