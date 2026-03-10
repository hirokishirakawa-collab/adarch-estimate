"use server";

import { revalidatePath } from "next/cache";
import { after } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { sendChatMessage } from "@/lib/google-chat";
import { getLeadStatusOption } from "@/lib/constants/leads";
import type { ScoredLead } from "@/lib/constants/leads";
import type { LeadStatus } from "@/generated/prisma/client";
import type { UserRole } from "@/types/roles";

// Chat通知先スペースID
const LEAD_CHAT_SPACE_ID = "AAQAp6XvXqE";

// ---------------------------------------------------------------
// 検索結果をリードとして一括保存する
// ---------------------------------------------------------------
export async function saveLeadsFromSearch(
  leads: ScoredLead[],
  industry: string,
  area: string
): Promise<{ saved: number; error?: string }> {
  const session = await auth();
  if (!session?.user) return { saved: 0, error: "ログインが必要です" };

  const staffName = session.user.name ?? session.user.email ?? "不明";

  // ユーザーIDを取得
  const email = session.user.email ?? "";
  const user = await db.user.findUnique({
    where: { email },
    select: { id: true },
  });

  let savedCount = 0;

  try {
    for (const lead of leads) {
      // upsert パターン: 既存なら更新、新規なら作成
      const existing = await db.lead.findUnique({
        where: { name_address: { name: lead.name, address: lead.address ?? "" } },
      });

      if (existing) {
        // 既存: スコアのみ更新
        await db.lead.update({
          where: { id: existing.id },
          data: {
            scoreTotal: lead.score.total,
            scoreBreakdown: lead.score.breakdown as Record<string, number>,
            scoreComment: lead.score.comment,
            rating: lead.rating,
            ratingCount: lead.ratingCount,
            businessStatus: lead.businessStatus,
          },
        });
      } else {
        // 新規作成
        const created = await db.lead.create({
          data: {
            name: lead.name,
            address: lead.address || null,
            phone: lead.phone || null,
            rating: lead.rating,
            ratingCount: lead.ratingCount,
            types: lead.types,
            mapsUrl: lead.mapsUrl || null,
            websiteUrl: lead.websiteUrl || null,
            businessStatus: lead.businessStatus || null,
            scoreTotal: lead.score.total,
            scoreBreakdown: lead.score.breakdown as Record<string, number>,
            scoreComment: lead.score.comment,
            industry,
            area,
            createdById: user?.id ?? null,
            assigneeId: user?.id ?? null,
          },
        });

        // ログ記録
        await db.leadLog.create({
          data: {
            leadId: created.id,
            action: "CREATED",
            detail: `リード獲得AIから保存（スコア: ${lead.score.total}）`,
            staffName,
          },
        });

        savedCount++;
      }
    }

    revalidatePath("/dashboard/leads/list");
    return { saved: savedCount };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error("[saveLeadsFromSearch] DB error:", msg, e);
    return { saved: savedCount, error: "保存中にエラーが発生しました" };
  }
}

// ---------------------------------------------------------------
// リードのステータスを更新する
// ---------------------------------------------------------------
export async function updateLeadStatus(
  leadId: string,
  status: string
): Promise<{ error?: string }> {
  const session = await auth();
  if (!session?.user) return { error: "ログインが必要です" };

  const staffName = session.user.name ?? session.user.email ?? "不明";

  try {
    const lead = await db.lead.findUnique({ where: { id: leadId } });
    if (!lead) return { error: "リードが見つかりません" };

    const oldOption = getLeadStatusOption(lead.status);
    const newOption = getLeadStatusOption(status);

    await db.lead.update({
      where: { id: leadId },
      data: { status: status as LeadStatus },
    });

    await db.leadLog.create({
      data: {
        leadId,
        action: "STATUS_CHANGED",
        detail: `ステータスを「${oldOption.label}」から「${newOption.label}」に変更`,
        staffName,
      },
    });

    // Chat通知（レスポンス送信後に実行）
    const capturedName = lead.name;
    const capturedLabel = newOption.label;
    const capturedStaff = staffName;
    after(async () => {
      await sendChatMessage(
        LEAD_CHAT_SPACE_ID,
        `📋 リード更新\n${capturedStaff}さんが「${capturedName}」のステータスを「${capturedLabel}」に変更しました`
      );
    });

    revalidatePath("/dashboard/leads/list");
    return {};
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error("[updateLeadStatus] DB error:", msg);
    return { error: "更新に失敗しました" };
  }
}

// ---------------------------------------------------------------
// リードのメモを更新する
// ---------------------------------------------------------------
export async function updateLeadMemo(
  leadId: string,
  memo: string
): Promise<{ error?: string }> {
  const session = await auth();
  if (!session?.user) return { error: "ログインが必要です" };

  try {
    await db.lead.update({
      where: { id: leadId },
      data: { memo: memo || null },
    });

    revalidatePath("/dashboard/leads/list");
    return {};
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error("[updateLeadMemo] DB error:", msg);
    return { error: "更新に失敗しました" };
  }
}

// ---------------------------------------------------------------
// リードに担当者をアサインする
// ---------------------------------------------------------------
export async function assignLead(
  leadId: string,
  assigneeId: string
): Promise<{ error?: string }> {
  const session = await auth();
  if (!session?.user) return { error: "ログインが必要です" };

  const staffName = session.user.name ?? session.user.email ?? "不明";

  try {
    const assignee = await db.user.findUnique({
      where: { id: assigneeId },
      select: { name: true, email: true },
    });
    if (!assignee) return { error: "ユーザーが見つかりません" };

    await db.lead.update({
      where: { id: leadId },
      data: { assigneeId },
    });

    const lead = await db.lead.findUnique({ where: { id: leadId } });

    await db.leadLog.create({
      data: {
        leadId,
        action: "ASSIGNED",
        detail: `担当者を「${assignee.name ?? assignee.email}」に設定`,
        staffName,
      },
    });

    // Chat通知
    const capturedLeadName = lead?.name ?? "不明";
    const capturedAssigneeName = assignee.name ?? assignee.email;
    const capturedStaff = staffName;
    after(async () => {
      await sendChatMessage(
        LEAD_CHAT_SPACE_ID,
        `👤 担当者アサイン\n${capturedStaff}さんが「${capturedLeadName}」の担当者を「${capturedAssigneeName}」に設定しました`
      );
    });

    revalidatePath("/dashboard/leads/list");
    return {};
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error("[assignLead] DB error:", msg);
    return { error: "更新に失敗しました" };
  }
}

// ---------------------------------------------------------------
// リードを顧客に転換する
// ---------------------------------------------------------------
export async function convertLeadToCustomer(
  leadId: string
): Promise<{ error?: string; customerId?: string }> {
  const session = await auth();
  if (!session?.user) return { error: "ログインが必要です" };

  const staffName = session.user.name ?? session.user.email ?? "不明";
  const email = session.user.email ?? "";

  try {
    const lead = await db.lead.findUnique({ where: { id: leadId } });
    if (!lead) return { error: "リードが見つかりません" };
    if (lead.convertedCustomerId) return { error: "既に顧客に転換済みです" };

    // 登録者の所属拠点を取得
    const dbUser = await db.user.findUnique({
      where: { email },
      select: { id: true, branchId: true },
    });
    // 拠点が見つからない場合はデフォルト拠点（最初の拠点）を使用
    const effectiveBranchId =
      dbUser?.branchId ??
      (await db.branch.findFirst({ select: { id: true } }).then((b) => b?.id)) ??
      null;
    if (!effectiveBranchId) return { error: "拠点情報が見つかりません" };

    // 顧客を作成
    const customer = await db.customer.create({
      data: {
        name: lead.name,
        phone: lead.phone,
        address: lead.address,
        industry: lead.industry,
        status: "PROSPECT",
        rank: "C",
        branchId: effectiveBranchId,
        staffName,
      },
    });

    // リードを更新
    await db.lead.update({
      where: { id: leadId },
      data: {
        status: "DEAL_CONVERTED",
        convertedCustomerId: customer.id,
      },
    });

    // ヒアリングシートを顧客に引き継ぎ
    const { copyHearingToCustomer } = await import("@/lib/actions/hearing");
    await copyHearingToCustomer(leadId, customer.id).catch((err) =>
      console.error("[convertLeadToCustomer] Hearing copy error:", err)
    );

    // ログ記録
    await db.leadLog.create({
      data: {
        leadId,
        action: "CONVERTED",
        detail: `顧客「${customer.name}」(ID: ${customer.id}) に転換`,
        staffName,
      },
    });

    // Chat通知
    const capturedName = lead.name;
    const capturedStaff = staffName;
    after(async () => {
      await sendChatMessage(
        LEAD_CHAT_SPACE_ID,
        `🎉 リード→顧客転換\n${capturedStaff}さんが「${capturedName}」を顧客に転換しました`
      );
    });

    revalidatePath("/dashboard/leads/list");
    revalidatePath("/dashboard/customers");
    return { customerId: customer.id };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error("[convertLeadToCustomer] DB error:", msg);
    return { error: "転換に失敗しました" };
  }
}

// ---------------------------------------------------------------
// リードを一括削除する（ADMIN限定）
// ---------------------------------------------------------------
export async function deleteAllLeads(): Promise<{ deleted: number; error?: string }> {
  const session = await auth();
  if (!session?.user) return { deleted: 0, error: "ログインが必要です" };

  const role = (session.user.role ?? "USER") as UserRole;
  if (role !== "ADMIN") return { deleted: 0, error: "管理者権限が必要です" };

  try {
    // ログを先に削除（外部キー制約）
    await db.leadLog.deleteMany({});
    const result = await db.lead.deleteMany({});

    revalidatePath("/dashboard/leads/list");
    return { deleted: result.count };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error("[deleteAllLeads] DB error:", msg);
    return { deleted: 0, error: "削除に失敗しました" };
  }
}

// ---------------------------------------------------------------
// 選択したリードを削除する（ADMIN限定）
// ---------------------------------------------------------------
export async function deleteSelectedLeads(
  leadIds: string[]
): Promise<{ deleted: number; error?: string }> {
  const session = await auth();
  if (!session?.user) return { deleted: 0, error: "ログインが必要です" };

  const role = (session.user.role ?? "USER") as UserRole;
  if (role !== "ADMIN") return { deleted: 0, error: "管理者権限が必要です" };

  if (leadIds.length === 0) return { deleted: 0 };

  try {
    await db.leadLog.deleteMany({ where: { leadId: { in: leadIds } } });
    const result = await db.lead.deleteMany({ where: { id: { in: leadIds } } });

    revalidatePath("/dashboard/leads/list");
    return { deleted: result.count };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error("[deleteSelectedLeads] DB error:", msg);
    return { deleted: 0, error: "削除に失敗しました" };
  }
}
