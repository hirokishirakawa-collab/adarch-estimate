"use server";

import { revalidatePath } from "next/cache";
import { after } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { sendChatMessage } from "@/lib/google-chat";
import { getLeadStatusOption } from "@/lib/constants/leads";
import type { ScoredLead, ScoredBtoBLead, ScoredRecruitLead } from "@/lib/constants/leads";
import type { ScoredCinemaLead } from "@/lib/constants/cinema-leads";
import type { TvcmLeadCandidate } from "@/lib/constants/tvcm-leads";
import type { LeadStatus } from "@/generated/prisma/client";
import type { UserRole } from "@/types/roles";

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
        detail: `TVCMプールから claim`,
        staffName,
      },
    });

    revalidatePath("/dashboard/leads/tvcm-pool");
    revalidatePath("/dashboard/leads/list");

    return { success: true, assignedTo: user.name ?? user.email };
  } catch (e) {
    console.error("[claimTvcmLead] DB error:", e);
    return { success: false, error: "claim中にエラーが発生しました" };
  }
}

// ---------------------------------------------------------------
// TVCM/動画PR リード（PR TIMES由来）を一括保存する
// 配布モデル: ADMIN のみが保存可能、保存されたリードは assigneeId=null（未アサイン）で
// 全パートナーから claim 可能なプールに入る
// ---------------------------------------------------------------
export async function saveTvcmLeadsFromSearch(
  candidates: TvcmLeadCandidate[],
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
    return { saved: 0, error: "TVCMリードの保存は管理者専用です" };
  }

  let savedCount = 0;

  try {
    for (const c of candidates) {
      const address = c.address ?? "";
      const existing = await db.lead.findUnique({
        where: { name_address: { name: c.companyName, address } },
      });

      if (existing) {
        await db.lead.update({
          where: { id: existing.id },
          data: {
            source: "PR_TIMES_TVCM",
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
          },
        });
      } else {
        const created = await db.lead.create({
          data: {
            name: c.companyName,
            address: address || null,
            websiteUrl: c.companyWebsite,
            industry: c.industryGuess,
            area: c.prefecture,
            source: "PR_TIMES_TVCM",
            status: "UNTOUCHED",
            scoreComment: c.summary,
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
            createdById: user.id,
            assigneeId: null, // 未アサイン状態でプールに投入、パートナーが claim する
          },
        });

        await db.leadLog.create({
          data: {
            leadId: created.id,
            action: "POOLED",
            detail: `TVCM/動画PRプール投入（${c.prefecture ?? "地域不明"}・${c.industryGuess ?? "業種不明"}）`,
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
    console.error("[saveTvcmLeadsFromSearch] DB error:", msg, e);
    return { saved: savedCount, error: "保存中にエラーが発生しました" };
  }
}
