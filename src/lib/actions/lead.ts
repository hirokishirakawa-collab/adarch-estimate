"use server";

import { revalidatePath } from "next/cache";
import { after } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { sendChatMessage } from "@/lib/google-chat";
import { getLeadStatusOption, getLeadRejectReason } from "@/lib/constants/leads";
import type { LeadRejectReasonValue } from "@/lib/constants/leads";
import type { ScoredLead, ScoredBtoBLead, ScoredRecruitLead } from "@/lib/constants/leads";
import type { ScoredCinemaLead } from "@/lib/constants/cinema-leads";
import type { TvcmLeadCandidate } from "@/lib/constants/tvcm-leads";
import type { LeadStatus } from "@/generated/prisma/client";
import type { UserRole } from "@/types/roles";
import { parseSignalDate, resolveSignal, shouldReplaceSignal } from "@/lib/leads/signal";
import {
  buildPlaceLeadMemo,
  buildCinemaLeadMemo,
  buildRecruitLeadMemo,
  buildBtoBLeadMemo,
} from "@/lib/leads/company-memo";

// Chat通知先スペースID
const LEAD_CHAT_SPACE_ID = process.env.DEAL_CHAT_SPACE_ID ?? "AAQAp6XvXqE";

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

      // 会社内容（Google概要・口コミ要約・企業タイプ等）。声かけ時の材料になるのでメモに残す
      const companyMemo = buildPlaceLeadMemo(lead);
      // Google Places は日付を持つシグナルを返さないので発掘日に倒す
      const signal = resolveSignal("FOUND", null);

      if (existing) {
        // 既存: スコアのみ更新。メモは手入力を潰さないよう空のときだけ補う
        await db.lead.update({
          where: { id: existing.id },
          data: {
            scoreTotal: lead.score.total,
            scoreBreakdown: lead.score.breakdown as Record<string, number>,
            scoreComment: lead.score.comment,
            rating: lead.rating,
            ratingCount: lead.ratingCount,
            businessStatus: lead.businessStatus,
            ...(existing.memo || !companyMemo ? {} : { memo: companyMemo }),
            ...(existing.assigneeId || !user ? {} : { assigneeId: user.id }),
            ...(shouldReplaceSignal(existing, signal) ? signal : {}),
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
            memo: companyMemo || null,
            ...signal,
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
// 検索結果に対して既存リードかどうかをチェックする
// ---------------------------------------------------------------
export async function checkExistingLeads(
  items: { name: string; address: string }[]
): Promise<Record<string, string>> {
  const session = await auth();
  if (!session?.user) return {};

  if (items.length === 0) return {};

  try {
    // OR条件で一括検索
    const existing = await db.lead.findMany({
      where: {
        OR: items.map((item) => ({
          name: item.name,
          address: item.address || "",
        })),
      },
      select: { name: true, address: true, status: true },
    });

    // "name|address" → status のマップを返す
    const map: Record<string, string> = {};
    for (const lead of existing) {
      map[`${lead.name}|${lead.address ?? ""}`] = lead.status;
    }
    return map;
  } catch (e) {
    console.error("[checkExistingLeads] DB error:", e);
    return {};
  }
}

// ---------------------------------------------------------------
// 担当の自動決定（ログインユーザーを担当にする）
//
// 声かけ解放ルールで担当が外れたリードや、担当が付かないまま残った
// リードを、実際に動かした人の担当に自動で寄せる。担当プルダウンを
// 手で選ぶ手間をなくすのが目的。
//   - 既に担当がいるリードは触らない（他拠点の担当を奪わない）
//   - TVer案件プールは先着claim（「私がやります」）が唯一の入口なので対象外
// 呼び出し側の update に混ぜる差分を返す。ログは更新が通ってから
// autoAssignLog() で残す。
// ---------------------------------------------------------------
async function autoAssignPatch(
  lead: { assigneeId: string | null; source: string },
  sessionEmail: string
): Promise<{ assigneeId?: string }> {
  if (lead.assigneeId) return {};
  if (lead.source === "PR_TIMES_TVCM") return {};

  const me = await db.user.findUnique({
    where: { email: sessionEmail },
    select: { id: true },
  });
  if (!me) return {};

  return { assigneeId: me.id };
}

/** autoAssignPatch で担当が付いたときだけログを残す */
async function autoAssignLog(
  patch: { assigneeId?: string },
  leadId: string,
  staffName: string
): Promise<void> {
  if (!patch.assigneeId) return;
  await db.leadLog.create({
    data: {
      leadId,
      action: "ASSIGNED",
      detail: `担当を ${staffName} さんに自動設定（未アサインのリードを操作したため）`,
      staffName,
    },
  });
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

    // 未アサインのリードを動かした人をそのまま担当にする
    const assignPatch = await autoAssignPatch(lead, session.user.email ?? "");

    await db.lead.update({
      where: { id: leadId },
      data: { status: status as LeadStatus, ...assignPatch },
    });

    await autoAssignLog(assignPatch, leadId, staffName);

    await db.leadLog.create({
      data: {
        leadId,
        action: "STATUS_CHANGED",
        detail: `ステータスを「${oldOption.label}」から「${newOption.label}」に変更`,
        staffName,
      },
    });

    // Chat通知は停止（リード段階の更新は通知しない → 商談化してから通知）

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

  const staffName = session.user.name ?? session.user.email ?? "不明";

  try {
    const lead = await db.lead.findUnique({
      where: { id: leadId },
      select: { assigneeId: true, source: true },
    });
    if (!lead) return { error: "リードが見つかりません" };

    // 未アサインのリードにメモを書いた人をそのまま担当にする
    const assignPatch = await autoAssignPatch(lead, session.user.email ?? "");

    await db.lead.update({
      where: { id: leadId },
      data: { memo: memo || null, ...assignPatch },
    });

    await autoAssignLog(assignPatch, leadId, staffName);

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

    // Chat通知は停止（リード段階のアサインは通知しない → 商談化してから通知）

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

    // 顧客作成 + リード更新 + ヒアリング移行 + ログ記録（トランザクション）
    const { copyHearingToCustomer } = await import("@/lib/actions/hearing");
    const customer = await db.$transaction(async (tx) => {
      const c = await tx.customer.create({
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

      await tx.lead.update({
        where: { id: leadId },
        data: {
          status: "DEAL_CONVERTED",
          convertedCustomerId: c.id,
        },
      });

      // ヒアリングシートを顧客に引き継ぎ
      await copyHearingToCustomer(leadId, c.id).catch((err) =>
        console.error("[convertLeadToCustomer] Hearing copy error:", err)
      );

      await tx.leadLog.create({
        data: {
          leadId,
          action: "CONVERTED",
          detail: `顧客「${c.name}」(ID: ${c.id}) に転換`,
          staffName,
        },
      });

      return c;
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

// ---------------------------------------------------------------
// リードのステータスを一括変更する
// ---------------------------------------------------------------
export async function bulkUpdateLeadStatus(
  ids: string[],
  newStatus: string
): Promise<{ error?: string; updated?: number }> {
  const session = await auth();
  if (!session?.user) return { error: "ログインが必要です" };

  if (!ids.length) return { updated: 0 };

  const validStatuses = ["UNTOUCHED", "CALLED", "APPOINTMENT", "DEAL_CONVERTED", "SKIPPED"];
  if (!validStatuses.includes(newStatus)) {
    return { error: "無効なステータスです" };
  }

  const staffName = session.user.name ?? session.user.email ?? "不明";
  const newOption = getLeadStatusOption(newStatus);

  try {
    await db.$transaction(async (tx) => {
      await tx.lead.updateMany({
        where: { id: { in: ids } },
        data: { status: newStatus as LeadStatus },
      });

      await tx.leadLog.createMany({
        data: ids.map((id) => ({
          leadId: id,
          action: "STATUS_CHANGED",
          detail: `一括操作: ステータスを「${newOption.label}」に変更`,
          staffName,
        })),
      });
    });

    revalidatePath("/dashboard/leads/list");
    return { updated: ids.length };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error("[bulkUpdateLeadStatus] DB error:", msg);
    return { error: "ステータス変更に失敗しました" };
  }
}

// ---------------------------------------------------------------
// リードの担当者を一括変更する
// ---------------------------------------------------------------
export async function bulkAssignLeads(
  ids: string[],
  assigneeId: string | null
): Promise<{ error?: string; updated?: number }> {
  const session = await auth();
  if (!session?.user) return { error: "ログインが必要です" };

  if (!ids.length) return { updated: 0 };

  const staffName = session.user.name ?? session.user.email ?? "不明";

  try {
    let assigneeName = "未アサイン";
    if (assigneeId) {
      const assignee = await db.user.findUnique({
        where: { id: assigneeId },
        select: { name: true, email: true },
      });
      if (!assignee) return { error: "ユーザーが見つかりません" };
      assigneeName = assignee.name ?? assignee.email;
    }

    await db.$transaction(async (tx) => {
      await tx.lead.updateMany({
        where: { id: { in: ids } },
        data: { assigneeId },
      });

      await tx.leadLog.createMany({
        data: ids.map((id) => ({
          leadId: id,
          action: "ASSIGNED",
          detail: `一括操作: 担当者を「${assigneeName}」に設定`,
          staffName,
        })),
      });
    });

    revalidatePath("/dashboard/leads/list");
    return { updated: ids.length };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error("[bulkAssignLeads] DB error:", msg);
    return { error: "担当者変更に失敗しました" };
  }
}

// ---------------------------------------------------------------
// BtoB検索結果をリードとして一括保存する
// ---------------------------------------------------------------
export async function saveBtoBLeadsFromSearch(
  leads: ScoredBtoBLead[],
  industry: string,
  area: string
): Promise<{ saved: number; error?: string }> {
  const session = await auth();
  if (!session?.user) return { saved: 0, error: "ログインが必要です" };

  const staffName = session.user.name ?? session.user.email ?? "不明";
  const email = session.user.email ?? "";
  const user = await db.user.findUnique({
    where: { email },
    select: { id: true },
  });

  let savedCount = 0;

  // BigIntの安全な変換（undefinedや不正な値でクラッシュしないように）
  function safeBigInt(value: number | string | undefined | null): bigint | null {
    if (value === undefined || value === null) return null;
    try { return BigInt(Math.floor(Number(value))); } catch { return null; }
  }

  try {
    for (const lead of leads) {
      const address = lead.address || "";
      const capitalBigint = safeBigInt(lead.capital);

      // 会社内容（事業内容・規模・補助金）をメモに残す
      const companyMemo = buildBtoBLeadMemo(lead);
      // 補助金の認定日＝予算がついた日。これが今いちばん強いシグナル
      const signal = resolveSignal("SUBSIDY", parseSignalDate(lead.latestSubsidyDate));

      const existing = await db.lead.findUnique({
        where: { name_address: { name: lead.name, address } },
      });

      if (existing) {
        await db.lead.update({
          where: { id: existing.id },
          data: {
            ...(existing.memo || !companyMemo ? {} : { memo: companyMemo }),
            ...(existing.assigneeId || !user ? {} : { assigneeId: user.id }),
            ...(shouldReplaceSignal(existing, signal) ? signal : {}),
            scoreTotal: lead.score?.total ?? 0,
            scoreBreakdown: (lead.score?.breakdown ?? {}) as Record<string, number>,
            scoreComment: lead.score?.comment ?? null,
            source: "GBIZINFO",
            corporateNumber: lead.corporateNumber ?? null,
            capital: capitalBigint,
            employeeCount: lead.employeeCount ?? null,
            representativeName: lead.representativeName ?? null,
            youtubeChannelUrl: lead.youtubeChannel?.url ?? null,
            youtubeSubscribers: lead.youtubeChannel?.subscribers ?? null,
            subsidies: lead.subsidies ?? [],
          },
        });
      } else {
        const created = await db.lead.create({
          data: {
            name: lead.name,
            address: address || null,
            websiteUrl: lead.websiteUrl || null,
            scoreTotal: lead.score?.total ?? 0,
            scoreBreakdown: (lead.score?.breakdown ?? {}) as Record<string, number>,
            scoreComment: lead.score?.comment ?? null,
            memo: companyMemo || null,
            ...signal,
            industry,
            area,
            source: "GBIZINFO",
            corporateNumber: lead.corporateNumber ?? null,
            capital: capitalBigint,
            employeeCount: lead.employeeCount ?? null,
            representativeName: lead.representativeName ?? null,
            youtubeChannelUrl: lead.youtubeChannel?.url ?? null,
            youtubeSubscribers: lead.youtubeChannel?.subscribers ?? null,
            subsidies: lead.subsidies ?? [],
            createdById: user?.id ?? null,
            assigneeId: user?.id ?? null,
          },
        });

        await db.leadLog.create({
          data: {
            leadId: created.id,
            action: "CREATED",
            detail: `BtoBリード獲得AIから保存（スコア: ${lead.score?.total ?? 0}）`,
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
    console.error("[saveBtoBLeadsFromSearch] DB error:", msg, e);
    return { saved: savedCount, error: "保存中にエラーが発生しました" };
  }
}

// ---------------------------------------------------------------
// シネアド検索結果をリードとして一括保存する
// ---------------------------------------------------------------
export async function saveCinemaLeadsFromSearch(
  leads: ScoredCinemaLead[],
  industry: string,
  area: string
): Promise<{ saved: number; error?: string }> {
  const session = await auth();
  if (!session?.user) return { saved: 0, error: "ログインが必要です" };

  const staffName = session.user.name ?? session.user.email ?? "不明";
  const email = session.user.email ?? "";
  const user = await db.user.findUnique({
    where: { email },
    select: { id: true },
  });

  let savedCount = 0;

  try {
    for (const lead of leads) {
      const address = lead.address || "";
      // 会社内容（Google概要・口コミ要約・企業タイプ等）をメモに残す
      const companyMemo = buildCinemaLeadMemo(lead);
      const signal = resolveSignal("FOUND", null);
      const existing = await db.lead.findUnique({
        where: { name_address: { name: lead.name, address } },
      });

      if (existing) {
        await db.lead.update({
          where: { id: existing.id },
          data: {
            scoreTotal: lead.score?.total ?? 0,
            scoreBreakdown: (lead.score?.breakdown ?? {}) as Record<string, number>,
            scoreComment: lead.score?.comment ?? null,
            source: "CINEMA_AD",
            distanceKm: lead.distanceKm ?? null,
            cinemaTheaterName: area,
            ...(existing.memo || !companyMemo ? {} : { memo: companyMemo }),
            ...(existing.assigneeId || !user ? {} : { assigneeId: user.id }),
            ...(shouldReplaceSignal(existing, signal) ? signal : {}),
          },
        });
      } else {
        const created = await db.lead.create({
          data: {
            name: lead.name,
            address: address || null,
            phone: lead.phone || null,
            rating: lead.rating,
            ratingCount: lead.ratingCount,
            types: lead.types,
            mapsUrl: lead.mapsUrl || null,
            websiteUrl: lead.websiteUrl || null,
            businessStatus: lead.businessStatus || null,
            scoreTotal: lead.score?.total ?? 0,
            scoreBreakdown: (lead.score?.breakdown ?? {}) as Record<string, number>,
            scoreComment: lead.score?.comment ?? null,
            memo: companyMemo || null,
            ...signal,
            industry,
            area,
            source: "CINEMA_AD",
            distanceKm: lead.distanceKm ?? null,
            cinemaTheaterName: area,
            createdById: user?.id ?? null,
            assigneeId: user?.id ?? null,
          },
        });

        await db.leadLog.create({
          data: {
            leadId: created.id,
            action: "CREATED",
            detail: `シネアドリード獲得AIから保存（スコア: ${lead.score?.total ?? 0}、距離: ${lead.distanceKm}km）`,
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
    console.error("[saveCinemaLeadsFromSearch] DB error:", msg, e);
    return { saved: savedCount, error: "保存中にエラーが発生しました" };
  }
}

// ---------------------------------------------------------------
// 採用リード検索結果をリードとして一括保存する
// ---------------------------------------------------------------
export async function saveRecruitLeadsFromSearch(
  leads: ScoredRecruitLead[],
  industry: string,
  area: string,
): Promise<{ saved: number; error?: string }> {
  const session = await auth();
  if (!session?.user) return { saved: 0, error: "ログインが必要です" };

  const staffName = session.user.name ?? session.user.email ?? "不明";
  const email = session.user.email ?? "";
  const user = await db.user.findUnique({
    where: { email },
    select: { id: true },
  });

  let savedCount = 0;

  try {
    for (const lead of leads) {
      const address = lead.address || "";
      const existing = await db.lead.findUnique({
        where: { name_address: { name: lead.name, address } },
      });

      const recruitTypeSuffix = lead.recruitAnalysis?.recruitType
        ? `（${lead.recruitAnalysis.recruitType === "both" ? "中途+新卒" : lead.recruitAnalysis.recruitType === "midcareer" ? "中途" : lead.recruitAnalysis.recruitType === "newgrad" ? "新卒" : ""}）`
        : "";

      // 会社内容（Google概要・口コミ要約・採用状況）をメモに残す
      const companyMemo = buildRecruitLeadMemo(lead);
      // 採用ページを今この瞬間に確認できた＝求人が生きている。確認日をシグナルにする
      const signal = resolveSignal(
        lead.recruitAnalysis?.recruitPageUrl ? "RECRUIT" : "FOUND",
        null
      );

      if (existing) {
        await db.lead.update({
          where: { id: existing.id },
          data: {
            scoreTotal: lead.score?.total ?? 0,
            scoreBreakdown: (lead.score?.breakdown ?? {}) as Record<string, number>,
            scoreComment: lead.score?.comment ?? null,
            source: "RECRUIT_SEARCH",
            youtubeChannelUrl: lead.youtubeChannel?.url ?? null,
            youtubeSubscribers: lead.youtubeChannel?.subscribers ?? null,
            ...(existing.memo || !companyMemo ? {} : { memo: companyMemo }),
            ...(existing.assigneeId || !user ? {} : { assigneeId: user.id }),
            ...(shouldReplaceSignal(existing, signal) ? signal : {}),
          },
        });
      } else {
        const created = await db.lead.create({
          data: {
            name: lead.name,
            address: address || null,
            phone: lead.phone || null,
            rating: lead.rating,
            ratingCount: lead.ratingCount,
            types: lead.types,
            mapsUrl: lead.mapsUrl || null,
            websiteUrl: lead.websiteUrl || null,
            businessStatus: lead.businessStatus || null,
            scoreTotal: lead.score?.total ?? 0,
            scoreBreakdown: (lead.score?.breakdown ?? {}) as Record<string, number>,
            scoreComment: lead.score?.comment ?? null,
            memo: companyMemo || null,
            ...signal,
            industry,
            area,
            source: "RECRUIT_SEARCH",
            youtubeChannelUrl: lead.youtubeChannel?.url ?? null,
            youtubeSubscribers: lead.youtubeChannel?.subscribers ?? null,
            createdById: user?.id ?? null,
            assigneeId: user?.id ?? null,
          },
        });

        await db.leadLog.create({
          data: {
            leadId: created.id,
            action: "CREATED",
            detail: `採用リード獲得AIから保存${recruitTypeSuffix}（スコア: ${lead.score?.total ?? 0}）`,
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
    console.error("[saveRecruitLeadsFromSearch] DB error:", msg, e);
    return { saved: savedCount, error: "保存中にエラーが発生しました" };
  }
}

// ---------------------------------------------------------------
// 営業実績ベースの検索サジェスト
// ---------------------------------------------------------------
export interface SearchSuggestion {
  /** おすすめキーワード */
  keywords: string;
  /** 業種ラベル */
  industryLabel: string;
  /** エリア */
  area: string;
  /** 成功件数（DEAL_CONVERTED + APPOINTMENT） */
  successCount: number;
  /** 総リード数 */
  totalCount: number;
  /** 成功率（%） */
  successRate: number;
  /** 平均スコア */
  avgScore: number;
}

export async function getSearchSuggestions(): Promise<SearchSuggestion[]> {
  try {
    const { getSessionInfo: getSI } = await import("@/lib/session");
    const info = await getSI();
    const branchIds = info
      ? [info.branchId, info.branchId2].filter((id): id is string => !!id)
      : [];
    // 自拠点フィルタ（ADMIN or 未割当は全体）
    const branchFilter = branchIds.length > 0
      ? { createdBy: { branchId: branchIds.length === 1 ? branchIds[0] : { in: branchIds } } }
      : {};

    // 業種 × エリア（都道府県）の組み合わせで集計（自拠点優先）
    let leads = await db.lead.findMany({
      where: {
        source: { in: ["GOOGLE_PLACES", "CINEMA_AD"] },
        industry: { not: null },
        area: { not: null },
        scoreTotal: { gt: 0 },
        ...branchFilter,
      },
      select: {
        industry: true,
        area: true,
        status: true,
        scoreTotal: true,
      },
    });

    // 自拠点データが少なければグループ全体で補完
    if (leads.length < 5 && branchIds.length > 0) {
      leads = await db.lead.findMany({
        where: {
          source: { in: ["GOOGLE_PLACES", "CINEMA_AD"] },
          industry: { not: null },
          area: { not: null },
          scoreTotal: { gt: 0 },
        },
        select: {
          industry: true,
          area: true,
          status: true,
          scoreTotal: true,
        },
      });
    }

    if (leads.length === 0) return [];

    // 業種 × エリアでグルーピング
    const groups = new Map<string, {
      industry: string;
      area: string;
      total: number;
      success: number;
      scoreSum: number;
    }>();

    for (const lead of leads) {
      if (!lead.industry || !lead.area) continue;
      // エリアから都道府県を抽出（「渋谷区 東京都」→「東京都」）
      const prefMatch = lead.area.match(/(北海道|.{2,3}[都道府県])/);
      const pref = prefMatch?.[0] ?? lead.area;
      const key = `${lead.industry}|${pref}`;

      const g = groups.get(key) ?? {
        industry: lead.industry,
        area: pref,
        total: 0,
        success: 0,
        scoreSum: 0,
      };
      g.total++;
      g.scoreSum += lead.scoreTotal;
      if (lead.status === "DEAL_CONVERTED" || lead.status === "APPOINTMENT") {
        g.success++;
      }
      groups.set(key, g);
    }

    // 成功実績があるものを優先、なければ検索実績が多い組み合わせを表示
    const suggestions: SearchSuggestion[] = [];
    for (const g of groups.values()) {
      if (g.total < 2) continue;
      const industryOpt = (await import("@/lib/constants/leads")).LEAD_INDUSTRY_OPTIONS
        .find((o) => o.label === g.industry || o.keywords.includes(g.industry));
      suggestions.push({
        keywords: industryOpt?.keywords ?? g.industry,
        industryLabel: g.industry,
        area: g.area,
        successCount: g.success,
        totalCount: g.total,
        successRate: Math.round((g.success / g.total) * 100),
        avgScore: Math.round(g.scoreSum / g.total),
      });
    }

    // 成功実績ありを優先、次に件数×平均スコアでソート
    suggestions.sort((a, b) => {
      // 成功実績があるものを先に
      if (a.successCount > 0 && b.successCount === 0) return -1;
      if (a.successCount === 0 && b.successCount > 0) return 1;
      // 成功実績同士は成功率で
      if (a.successCount > 0 && b.successCount > 0) {
        return (b.successRate * Math.log2(b.successCount + 1)) - (a.successRate * Math.log2(a.successCount + 1));
      }
      // 成功なし同士は件数×平均スコアで
      return (b.totalCount * b.avgScore) - (a.totalCount * a.avgScore);
    });

    return suggestions.slice(0, 5);
  } catch (err) {
    console.error("getSearchSuggestions error:", err);
    return [];
  }
}

// ---------------------------------------------------------------
// TVCM/動画PR リードの状態遷移（履歴画面から後判定するため）
//   "pool"   → status を UNTOUCHED に変更（プール投入）
//   "reject" → status を SKIPPED に変更（却下）
// ADMIN 専用
// ---------------------------------------------------------------
export async function transitionTvcmLeadStatus(
  leadId: string,
  decision: "pool" | "reject",
  rejectReason?: LeadRejectReasonValue | null,
): Promise<{ success: boolean; error?: string }> {
  const session = await auth();
  if (!session?.user?.email) return { success: false, error: "ログインが必要です" };

  const staffName = session.user.name ?? session.user.email ?? "ADMIN";
  const user = await db.user.findUnique({
    where: { email: session.user.email },
    select: { role: true },
  });
  if (!user || user.role !== "ADMIN") {
    return { success: false, error: "管理者専用です" };
  }

  const lead = await db.lead.findUnique({
    where: { id: leadId },
    select: { source: true, name: true, prefecture: true, industry: true, status: true },
  });
  if (!lead || lead.source !== "PR_TIMES_TVCM") {
    return { success: false, error: "TVer広告案件リードではありません" };
  }

  const newStatus: LeadStatus = decision === "pool" ? "UNTOUCHED" : "SKIPPED";
  // 却下理由は却下時のみ保持。プール投入時は過去の却下理由をクリアする
  const reasonValue = decision === "reject" ? (rejectReason ?? null) : null;
  const reasonLabel = getLeadRejectReason(reasonValue)?.label ?? null;

  try {
    await db.lead.update({
      where: { id: leadId },
      data: { status: newStatus, assigneeId: null, rejectReason: reasonValue },
    });
    await db.leadLog.create({
      data: {
        leadId,
        action: decision === "pool" ? "POOLED" : "REJECTED",
        detail:
          decision === "pool"
            ? "履歴画面からプール投入"
            : `履歴画面から却下${reasonLabel ? `［${reasonLabel}］` : ""}`,
        staffName,
      },
    });

    // プール投入時のみChat通知
    if (decision === "pool" && lead.status !== "UNTOUCHED") {
      const meta = [lead.prefecture, lead.industry].filter(Boolean).join("・");
      const metaText = meta ? `（${meta}）` : "";
      const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "";
      const poolUrl = `${appUrl}/dashboard/leads/tvcm-pool`;
      const message = `📢 TVer広告 案件プールに「${lead.name}」を追加${metaText}\n👉 先着順！${poolUrl}`;
      after(async () => {
        try {
          await sendChatMessage(LEAD_CHAT_SPACE_ID, message);
        } catch (e) {
          console.error("[transitionTvcmLeadStatus] Chat通知失敗:", e);
        }
      });
    }

    revalidatePath("/dashboard/leads/tvcm-history");
    revalidatePath("/dashboard/leads/tvcm-pool");
    revalidatePath("/dashboard/leads/list");
    return { success: true };
  } catch (e) {
    console.error("[transitionTvcmLeadStatus] DB error:", e);
    return { success: false, error: "更新に失敗しました" };
  }
}

// ---------------------------------------------------------------
// TVCM/動画PR リードの一括状態遷移（履歴画面の一括プール投入用）
// ADMIN 専用。プール投入時のみ Chat に都道府県内訳を含めて1回通知。
// ---------------------------------------------------------------
export async function bulkTransitionTvcmLeads(
  leadIds: string[],
  decision: "pool" | "reject",
  rejectReason?: LeadRejectReasonValue | null,
): Promise<{ success: boolean; updated: number; error?: string }> {
  const session = await auth();
  if (!session?.user?.email) return { success: false, updated: 0, error: "ログインが必要です" };

  const staffName = session.user.name ?? session.user.email ?? "ADMIN";
  const user = await db.user.findUnique({
    where: { email: session.user.email },
    select: { role: true },
  });
  if (!user || user.role !== "ADMIN") {
    return { success: false, updated: 0, error: "管理者専用です" };
  }

  if (leadIds.length === 0) {
    return { success: false, updated: 0, error: "対象リードがありません" };
  }

  try {
    // 対象リードを一括取得（TVCM由来 & UNTOUCHED 以外のみ更新対象とする）
    const targets = await db.lead.findMany({
      where: {
        id: { in: leadIds },
        source: "PR_TIMES_TVCM",
      },
      select: {
        id: true,
        name: true,
        prefecture: true,
        industry: true,
        status: true,
        scoreComment: true,
      },
    });

    const newStatus: LeadStatus = decision === "pool" ? "UNTOUCHED" : "SKIPPED";
    const logAction = decision === "pool" ? "POOLED" : "REJECTED";
    // 却下理由は却下時のみ保持。プール投入時は過去の却下理由をクリアする
    const reasonValue = decision === "reject" ? (rejectReason ?? null) : null;
    const reasonLabel = getLeadRejectReason(reasonValue)?.label ?? null;
    const logDetail = decision === "pool"
      ? "履歴画面から一括プール投入"
      : `履歴画面から一括却下${reasonLabel ? `［${reasonLabel}］` : ""}`;

    // プール投入: 既に UNTOUCHED のものは Chat 通知に含めない（重複通知防止）
    const newlyPooled = decision === "pool"
      ? targets.filter((t) => t.status !== "UNTOUCHED")
      : targets;

    // 一括更新
    await db.lead.updateMany({
      where: { id: { in: targets.map((t) => t.id) } },
      data: { status: newStatus, assigneeId: null, rejectReason: reasonValue },
    });

    // ログを一括作成
    await db.leadLog.createMany({
      data: targets.map((t) => ({
        leadId: t.id,
        action: logAction,
        detail: logDetail,
        staffName,
      })),
    });

    // プール投入の場合、Chat に都道府県内訳付きで1回だけ通知
    if (decision === "pool" && newlyPooled.length > 0) {
      const prefCounts: Record<string, number> = {};
      for (const t of newlyPooled) {
        const key = t.prefecture?.trim() || "都道府県不明";
        prefCounts[key] = (prefCounts[key] ?? 0) + 1;
      }
      const prefSummary = Object.entries(prefCounts)
        .sort((a, b) => b[1] - a[1])
        .map(([pref, n]) => `${pref} ${n}件`)
        .join("・");

      // 会社名＋業種＋内容（AIサマリー）の一覧。多すぎる時は先頭のみ表示して残数を添える。
      const MAX_LISTED = 15;
      const companyLines = newlyPooled.slice(0, MAX_LISTED).map((t) => {
        const meta = [t.prefecture?.trim(), t.industry?.trim()]
          .filter(Boolean)
          .join("・");
        const head = `・${t.name}${meta ? `（${meta}）` : ""}`;
        const summary = t.scoreComment?.trim().replace(/\s+/g, " ");
        return summary
          ? `${head}\n　${summary.length > 70 ? `${summary.slice(0, 70)}…` : summary}`
          : head;
      });
      if (newlyPooled.length > MAX_LISTED) {
        companyLines.push(`…他 ${newlyPooled.length - MAX_LISTED}件`);
      }

      const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "";
      const poolUrl = `${appUrl}/dashboard/leads/tvcm-pool`;
      const message = [
        `📢 TVer広告 案件プールに ${newlyPooled.length}件 を一括投入しました`,
        `地域内訳: ${prefSummary}`,
        ``,
        ...companyLines,
        ``,
        `👉 先着順！「私がやります」でclaim:`,
        poolUrl,
      ].join("\n");

      after(async () => {
        try {
          await sendChatMessage(LEAD_CHAT_SPACE_ID, message);
        } catch (e) {
          console.error("[bulkTransitionTvcmLeads] Chat通知失敗:", e);
        }
      });
    }

    revalidatePath("/dashboard/leads/tvcm-history");
    revalidatePath("/dashboard/leads/tvcm-pool");
    revalidatePath("/dashboard/leads/list");
    return { success: true, updated: targets.length };
  } catch (e) {
    console.error("[bulkTransitionTvcmLeads] DB error:", e);
    return { success: false, updated: 0, error: "一括更新に失敗しました" };
  }
}

// ---------------------------------------------------------------
// TVCM/動画PR プールから案件をclaim（早い者勝ち）
// ---------------------------------------------------------------
export async function claimTvcmLead(
  leadId: string,
): Promise<{ success: boolean; error?: string; assignedTo?: string }> {
  const session = await auth();
  if (!session?.user?.email) return { success: false, error: "ログインが必要です" };

  const staffName = session.user.name ?? session.user.email ?? "不明";
  const user = await db.user.findUnique({
    where: { email: session.user.email },
    select: { id: true, name: true, email: true },
  });
  if (!user) return { success: false, error: "ユーザーが見つかりません" };

  try {
    // updateMany で条件付きアトミック更新（assigneeId=null かつ source=PR_TIMES_TVCM の時のみ更新）
    const result = await db.lead.updateMany({
      where: {
        id: leadId,
        source: "PR_TIMES_TVCM",
        assigneeId: null,
      },
      data: {
        assigneeId: user.id,
      },
    });

    if (result.count === 0) {
      // 既に他人にclaimされている or 存在しない or TVCM以外
      const existing = await db.lead.findUnique({
        where: { id: leadId },
        select: {
          assigneeId: true,
          assignee: { select: { name: true, email: true } },
        },
      });
      if (!existing) return { success: false, error: "案件が見つかりません" };
      if (existing.assigneeId === user.id) {
        return { success: true, assignedTo: user.name ?? user.email };
      }
      const claimedBy =
        existing.assignee?.name ?? existing.assignee?.email ?? "他のパートナー";
      return {
        success: false,
        error: `すでに ${claimedBy} さんがclaim済みです`,
      };
    }

    await db.leadLog.create({
      data: {
        leadId,
        action: "CLAIMED",
        detail: `TVer広告案件プールから claim`,
        staffName,
      },
    });

    // claim 後のリード情報を取得して Chat 通知
    const claimedLead = await db.lead.findUnique({
      where: { id: leadId },
      select: { name: true, prefecture: true, industry: true },
    });
    if (claimedLead) {
      const meta = [claimedLead.prefecture, claimedLead.industry].filter(Boolean).join("・");
      const metaText = meta ? `（${meta}）` : "";
      const message = `🎯 ${staffName} さんが「${claimedLead.name}」をclaim${metaText}`;
      after(async () => {
        try {
          await sendChatMessage(LEAD_CHAT_SPACE_ID, message);
        } catch (e) {
          console.error("[claimTvcmLead] Chat通知失敗:", e);
        }
      });
    }

    revalidatePath("/dashboard/leads/tvcm-pool");
    revalidatePath("/dashboard/leads/list");

    return { success: true, assignedTo: user.name ?? user.email };
  } catch (e) {
    console.error("[claimTvcmLead] DB error:", e);
    return { success: false, error: "claim中にエラーが発生しました" };
  }
}

// ---------------------------------------------------------------
// TVCM/動画PR リード（PR TIMES由来）を「一括」でclaimする
// 競合状態に強いアトミック実装:
//   1) updateMany でフィルタ条件に合うものだけを current user に assign
//   2) 直前に取得した「未claim」スナップショットと突き合わせて、
//      claim できなかったID（他人に先取り済み）を error メッセージとして返す
// ---------------------------------------------------------------
export async function bulkClaimTvcmLeads(
  leadIds: string[],
): Promise<{ success: boolean; claimed: number; skipped: number; error?: string }> {
  const session = await auth();
  if (!session?.user?.email) return { success: false, claimed: 0, skipped: 0, error: "ログインが必要です" };
  if (leadIds.length === 0) return { success: true, claimed: 0, skipped: 0 };

  const staffName = session.user.name ?? session.user.email ?? "不明";
  const user = await db.user.findUnique({
    where: { email: session.user.email },
    select: { id: true, name: true, email: true },
  });
  if (!user) return { success: false, claimed: 0, skipped: 0, error: "ユーザーが見つかりません" };

  try {
    // 事前に「対象IDのうち未claimだったもの」を取得（通知用）
    const beforeClaim = await db.lead.findMany({
      where: {
        id: { in: leadIds },
        source: "PR_TIMES_TVCM",
        assigneeId: null,
      },
      select: { id: true, name: true, prefecture: true, industry: true },
    });

    const result = await db.lead.updateMany({
      where: {
        id: { in: leadIds },
        source: "PR_TIMES_TVCM",
        assigneeId: null,
      },
      data: {
        assigneeId: user.id,
      },
    });

    const claimed = result.count;
    const skipped = leadIds.length - claimed;

    if (claimed > 0) {
      // ログ記録
      await db.leadLog.createMany({
        data: beforeClaim.slice(0, claimed).map((l) => ({
          leadId: l.id,
          action: "CLAIMED",
          detail: `TVer広告案件プールから 一括claim`,
          staffName,
        })),
      });

      // Chat通知（1メッセージにまとめる）
      after(async () => {
        try {
          const names = beforeClaim
            .slice(0, Math.min(claimed, 5))
            .map((l) => l.name)
            .join("・");
          const suffix = claimed > 5 ? ` ほか${claimed - 5}件` : "";
          const message = `🎯 ${staffName} さんが ${claimed}件 を一括claim: ${names}${suffix}`;
          await sendChatMessage(LEAD_CHAT_SPACE_ID, message);
        } catch (e) {
          console.error("[bulkClaimTvcmLeads] Chat通知失敗:", e);
        }
      });
    }

    revalidatePath("/dashboard/leads/tvcm-pool");
    revalidatePath("/dashboard/leads/list");

    return { success: true, claimed, skipped };
  } catch (e) {
    console.error("[bulkClaimTvcmLeads] DB error:", e);
    return { success: false, claimed: 0, skipped: 0, error: "一括claim中にエラーが発生しました" };
  }
}

// ---------------------------------------------------------------
// TVCM/動画PR リード（PR TIMES由来）を一括保存する
// 配布モデル: ADMIN のみが保存可能。
//  - decision="pool"   → assigneeId=null + status=UNTOUCHED でプールに投入（パートナーがclaim可）
//  - decision="reject" → status=SKIPPED で記録（次回クロール時に重複判定でスキップされる）
// ---------------------------------------------------------------
export async function saveTvcmLeadsFromSearch(
  candidates: TvcmLeadCandidate[],
  decision: "pool" | "reject" = "pool",
  rejectReason?: LeadRejectReasonValue | null,
): Promise<{ saved: number; error?: string }> {
  const session = await auth();
  if (!session?.user?.email) return { saved: 0, error: "ログインが必要です" };

  const staffName = session.user.name ?? session.user.email ?? "不明";
  const email = session.user.email;
  const user = await db.user.findUnique({
    where: { email },
    select: { id: true, role: true },
  });
  if (!user) return { saved: 0, error: "ユーザーが見つかりません" };
  if (user.role !== "ADMIN") {
    return { saved: 0, error: "TVer広告案件リードの保存は管理者専用です" };
  }

  const targetStatus: LeadStatus = decision === "reject" ? "SKIPPED" : "UNTOUCHED";
  const logAction = decision === "reject" ? "REJECTED" : "POOLED";
  // 却下理由は却下時のみ保持。プール投入時は過去の却下理由をクリアする
  const reasonValue = decision === "reject" ? (rejectReason ?? null) : null;
  const reasonLabel = getLeadRejectReason(reasonValue)?.label ?? null;
  const logDetailPrefix =
    decision === "reject"
      ? `TVer広告案件 却下記録${reasonLabel ? `［${reasonLabel}］` : ""}`
      : "TVer広告 案件プール投入";

  let savedCount = 0;
  const savedPrefectures: string[] = [];

  try {
    for (const c of candidates) {
      const address = c.address ?? "";
      // CM発表のプレスリリース日＝広告に金を使うと決めた日
      const signal = resolveSignal("TVCM", parseSignalDate(c.announcedDate));
      const existing = await db.lead.findUnique({
        where: { name_address: { name: c.companyName, address } },
      });

      if (existing) {
        await db.lead.update({
          where: { id: existing.id },
          data: {
            source: "PR_TIMES_TVCM",
            status: targetStatus,
            rejectReason: reasonValue,
            pressReleaseUrl: c.pressReleaseUrl,
            pressReleaseTitle: c.pressReleaseTitle,
            videoUrl: c.videoUrl,
            productionCompany: c.productionCompany,
            announcedDate: c.announcedDate ? new Date(c.announcedDate) : null,
            prefecture: c.prefecture,
            agencyDetected: c.agencyDetected,
            isListed: c.isListed,
            capital: c.capital !== null ? BigInt(c.capital) : null,
            employeeCount: c.employeeCount,
            industry: c.industryGuess,
            area: c.prefecture,
            scoreComment: c.summary,
            websiteUrl: c.companyWebsite,
            ...(shouldReplaceSignal(existing, signal) ? signal : {}),
          },
        });

        // 既存リードへの判断もログに残す（学習データ＆「判断済みは再表示しない」の材料になる）
        await db.leadLog.create({
          data: {
            leadId: existing.id,
            action: logAction,
            detail: `${logDetailPrefix}（${c.prefecture ?? "地域不明"}・${c.industryGuess ?? "業種不明"}）`,
            staffName,
          },
        });
      } else {
        if (decision === "pool") savedPrefectures.push(c.prefecture ?? "地域不明");
        const created = await db.lead.create({
          data: {
            name: c.companyName,
            address: address || null,
            websiteUrl: c.companyWebsite,
            industry: c.industryGuess,
            area: c.prefecture,
            source: "PR_TIMES_TVCM",
            status: targetStatus,
            scoreComment: c.summary,
            ...signal,
            capital: c.capital !== null ? BigInt(c.capital) : null,
            employeeCount: c.employeeCount,
            pressReleaseUrl: c.pressReleaseUrl,
            pressReleaseTitle: c.pressReleaseTitle,
            videoUrl: c.videoUrl,
            productionCompany: c.productionCompany,
            announcedDate: c.announcedDate ? new Date(c.announcedDate) : null,
            prefecture: c.prefecture,
            agencyDetected: c.agencyDetected,
            isListed: c.isListed,
            rejectReason: reasonValue,
            createdById: user.id,
            assigneeId: null,
          },
        });

        await db.leadLog.create({
          data: {
            leadId: created.id,
            action: logAction,
            detail: `${logDetailPrefix}（${c.prefecture ?? "地域不明"}・${c.industryGuess ?? "業種不明"}）`,
            staffName,
          },
        });

        savedCount++;
      }
    }

    // プール投入の場合のみ、新規投入があればGoogle Chatで全パートナーに通知
    if (decision === "pool" && savedCount > 0) {
      const prefCounts: Record<string, number> = {};
      for (const p of savedPrefectures) {
        prefCounts[p] = (prefCounts[p] ?? 0) + 1;
      }
      const prefSummary = Object.entries(prefCounts)
        .sort((a, b) => b[1] - a[1])
        .map(([pref, n]) => `${pref} ${n}件`)
        .join("・");

      const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "";
      const poolUrl = `${appUrl}/dashboard/leads/tvcm-pool`;
      const message = `📢 TVCM/動画PR 案件プールに ${savedCount}件 追加されました\n地域内訳: ${prefSummary}\n\n👉 先着順！「私がやります」でclaim:\n${poolUrl}`;

      after(async () => {
        try {
          await sendChatMessage(LEAD_CHAT_SPACE_ID, message);
        } catch (e) {
          console.error("[saveTvcmLeadsFromSearch] Chat通知失敗:", e);
        }
      });
    }

    revalidatePath("/dashboard/leads/list");
    revalidatePath("/dashboard/leads/tvcm-pool");
    return { saved: savedCount };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error("[saveTvcmLeadsFromSearch] DB error:", msg, e);
    return { saved: savedCount, error: "保存中にエラーが発生しました" };
  }
}

// ---------------------------------------------------------------
// リードを営業対象から外す（却下）
//
// 周年ファインダーで競合・同業が並んでしまうため、気づいた人がその場で外せるようにしたもの。
// 外すと status=SKIPPED になり、リード管理・営業フロー・周年ファインダーの
// すべてから見えなくなる（既存の却下と同じ扱い）。
//
// 物理削除ではないので、代表がリード管理の「却下済み」から戻せる。
// 誰が外したかは LeadLog に残す。
// ---------------------------------------------------------------
export async function rejectLeadFromList(
  leadId: string,
  rejectReason: LeadRejectReasonValue,
): Promise<{ success: boolean; error?: string }> {
  const session = await auth();
  if (!session?.user?.email) return { success: false, error: "ログインが必要です" };

  const staffName = session.user.name ?? session.user.email;

  const lead = await db.lead.findUnique({
    where: { id: leadId },
    select: { id: true, name: true, status: true },
  });
  if (!lead) return { success: false, error: "リードが見つかりません" };
  if (lead.status === "SKIPPED") return { success: true }; // 二重押しは黙って成功扱い

  const reasonLabel = getLeadRejectReason(rejectReason)?.label ?? "理由なし";

  try {
    await db.lead.update({
      where: { id: leadId },
      data: { status: "SKIPPED", assigneeId: null, rejectReason },
    });
    await db.leadLog.create({
      data: {
        leadId,
        action: "REJECTED",
        detail: `営業対象から除外［${reasonLabel}］`,
        staffName,
      },
    });

    revalidatePath("/dashboard/anniversary-finder");
    revalidatePath("/dashboard/leads/list");
    revalidatePath("/dashboard/sales");
    return { success: true };
  } catch (e) {
    console.error("[rejectLeadFromList] DB error:", e);
    return { success: false, error: "除外に失敗しました" };
  }
}
