import { db } from "@/lib/db";
import { getSessionInfo, getBranchFilter } from "@/lib/session";

export interface ActivityKpi {
  /** 全社集計を見ているか（ADMIN）。false の場合は本人ぶんのみ。 */
  isAdmin: boolean;
  /** 今月の声かけ数（アウトリーチ送付＝LeadLog FORM_SENT） */
  outreach: number;
  /** 今月 新規作成された商談数 */
  deals: number;
  /** 今月 受注した商談数 */
  won: number;
}

/**
 * 各ダッシュボードのトップに出す「今月の活動」KPI を取得する。
 * - ADMIN: 全拠点・全員の集計
 * - それ以外: 本人（声かけ）／自拠点（商談・受注）のぶんのみ
 * 個人名は返さない（件数のみ）。本部と数字が共有されている前提の指標。
 */
export async function getActivityKpi(): Promise<ActivityKpi | null> {
  const info = await getSessionInfo();
  if (!info) return null;

  const isAdmin = info.role === "ADMIN";

  // 今月の開始時刻（月初 00:00）
  const ref = new Date();
  const monthStart = new Date(ref.getFullYear(), ref.getMonth(), 1);

  // 商談・受注は拠点スコープ（ADMIN は {}）
  const branchFilter = getBranchFilter(info);
  // 声かけ = 営業フォーム送付(FORM_SENT) ＋ リードを「連絡済み」にした操作。
  // CSV一括取込はCREATEDで入るため二重計上されない。
  // staffName で本人ぶんに絞る（ADMIN は全件）。
  const outreachWhere = {
    createdAt: { gte: monthStart },
    ...(isAdmin ? {} : { staffName: info.staffName }),
    OR: [
      { action: "FORM_SENT" },
      { action: "STATUS_CHANGED", detail: { contains: "「連絡済み」に変更" } },
    ],
  };

  const [outreach, deals, won] = await Promise.all([
    db.leadLog.count({ where: outreachWhere }),
    db.deal.count({
      where: { ...branchFilter, createdAt: { gte: monthStart } },
    }),
    db.deal.count({
      where: {
        ...branchFilter,
        status: "CLOSED_WON",
        updatedAt: { gte: monthStart },
      },
    }),
  ]);

  return { isAdmin, outreach, deals, won };
}
