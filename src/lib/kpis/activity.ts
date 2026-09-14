import { db } from "@/lib/db";
import { getSessionInfo, getBranchFilter } from "@/lib/session";
import { jstDayStart, jstMonthStart } from "@/lib/jst-range";

export interface ActivityCounts {
  /** 声かけ数（アウトリーチ送付＝LeadLog FORM_SENT ＋「連絡済み」への変更） */
  outreach: number;
  /** 新規作成された商談数 */
  deals: number;
  /** 受注した商談数（受注日で数える） */
  won: number;
}

export interface ActivityKpi extends ActivityCounts {
  /** 全社集計を見ているか（ADMIN）。false の場合は今月の数字は本人ぶんのみ。 */
  isAdmin: boolean;
  /** 今日（日本時間0時から）のグループ全体。誰が見ても全社の件数（2026-09-15） */
  today: ActivityCounts;
}

// 声かけ = 営業フォーム送付(FORM_SENT) ＋ リードを「連絡済み」にした操作。
// CSV一括取込はCREATEDで入るため二重計上されない。
const OUTREACH_ACTIONS = [
  { action: "FORM_SENT" },
  { action: "STATUS_CHANGED", detail: { contains: "「連絡済み」に変更" } },
];

/**
 * 各ダッシュボードのトップに出す「今月の活動」＋「今日・グループ全体」KPI を取得する。
 * - 今月: ADMIN は全拠点・全員／それ以外は本人（声かけ）・自拠点（商談・受注）のぶんのみ
 * - 今日: 全員にグループ全体の件数（GROUP LIVE で全社の動きを見合うのと同じ前提）
 * 個人名は返さない（件数のみ）。区切りは日本時間。
 */
export async function getActivityKpi(): Promise<ActivityKpi | null> {
  const info = await getSessionInfo();
  if (!info) return null;

  const isAdmin = info.role === "ADMIN";
  const monthStart = jstMonthStart();
  const dayStart = jstDayStart();

  // 商談・受注は拠点スコープ（ADMIN は {}）
  const branchFilter = getBranchFilter(info);

  const [outreach, deals, won, todayOutreach, todayDeals, todayWon] = await Promise.all([
    db.leadLog.count({
      where: { createdAt: { gte: monthStart }, ...(isAdmin ? {} : { staffName: info.staffName }), OR: OUTREACH_ACTIONS },
    }),
    db.deal.count({ where: { ...branchFilter, createdAt: { gte: monthStart } } }),
    // 受注は受注日（closedAt）で数える。受注後にメモを足しただけの商談を今月の受注に入れない（2026-09-15）
    db.deal.count({ where: { ...branchFilter, status: "CLOSED_WON", closedAt: { gte: monthStart } } }),
    db.leadLog.count({ where: { createdAt: { gte: dayStart }, OR: OUTREACH_ACTIONS } }),
    db.deal.count({ where: { createdAt: { gte: dayStart } } }),
    db.deal.count({ where: { status: "CLOSED_WON", closedAt: { gte: dayStart } } }),
  ]);

  return {
    isAdmin,
    outreach,
    deals,
    won,
    today: { outreach: todayOutreach, deals: todayDeals, won: todayWon },
  };
}
