import { db } from "@/lib/db";

// ----------------------------------------------------------------
// 成功プロファイル: 過去の営業実績からスコアリング傾向を分析
// ----------------------------------------------------------------

interface ScoreBreakdown {
  [key: string]: number;
}

interface SuccessProfile {
  /** 成功リード（DEAL_CONVERTED + APPOINTMENT）の件数 */
  successCount: number;
  /** スキップされたリードの件数 */
  skippedCount: number;
  /** 成功リードの平均スコア配分 */
  avgBreakdown: ScoreBreakdown;
  /** スキップリードの平均スコア配分 */
  skippedAvgBreakdown: ScoreBreakdown | null;
  /** 成功リードの平均合計スコア */
  avgTotal: number;
  /** 成功リードの平均レーティング */
  avgRating: number;
  /** プロンプト注入用テキスト */
  promptText: string;
  /** データソース: 自拠点 or グループ全体 */
  dataSource: "branch" | "group";
}

/** 拠点フィルタ: createdBy の branchId で絞る */
function branchWhere(branchIds: string[]) {
  if (branchIds.length === 0) return {};
  if (branchIds.length === 1) return { createdBy: { branchId: branchIds[0] } };
  return { createdBy: { branchId: { in: branchIds } } };
}

/** 拠点+グループ両方のプロファイルを返す */
export interface DualSuccessProfile {
  /** スコアリングに使用するプロファイル（自拠点優先） */
  primary: SuccessProfile;
  /** グループ全体のプロファイル（比較用、primaryと異なる場合のみ） */
  groupProfile: SuccessProfile | null;
}

export async function getSuccessProfileDual(
  industry: string,
  source?: "GOOGLE_PLACES" | "CINEMA_AD" | "GBIZINFO",
  branchIds?: string[]
): Promise<DualSuccessProfile | null> {
  // 自拠点プロファイル（スコアリングに使用）
  const primary = await getSuccessProfile(industry, source, branchIds);
  if (!primary) return null;

  // 自拠点データで済んでいる場合、グループ全体も別途取得（比較用）
  let groupProfile: SuccessProfile | null = null;
  if (primary.dataSource === "branch" && branchIds?.length) {
    groupProfile = await getSuccessProfile(industry, source);
  }

  return { primary, groupProfile };
}

/**
 * 指定業種の成功プロファイルをDBから生成する。
 * 自拠点優先で集計し、データが少なければグループ全体で補完する。
 */
export async function getSuccessProfile(
  industry: string,
  source?: "GOOGLE_PLACES" | "CINEMA_AD" | "GBIZINFO",
  branchIds?: string[]
): Promise<SuccessProfile | null> {
  try {
    const branchFilter = branchIds?.length ? branchWhere(branchIds) : {};

    // 成功リード: DEAL_CONVERTED または APPOINTMENT
    const successWhere = {
      status: { in: ["DEAL_CONVERTED" as const, "APPOINTMENT" as const] },
      scoreBreakdown: { not: null as unknown as undefined },
      scoreTotal: { gt: 0 },
      ...(source ? { source } : {}),
    };

    const selectFields = {
      scoreTotal: true,
      scoreBreakdown: true,
      rating: true,
      ratingCount: true,
      industry: true,
    } as const;

    // 1) 自拠点 × 業種一致で検索
    let successLeads = await db.lead.findMany({
      where: { ...successWhere, ...branchFilter, industry },
      select: selectFields,
      orderBy: { updatedAt: "desc" },
      take: 50,
    });
    let dataSource: "branch" | "group" = "branch";

    // 2) 自拠点で3件未満 → 自拠点 × 全業種
    if (successLeads.length < 3 && branchIds?.length) {
      successLeads = await db.lead.findMany({
        where: { ...successWhere, ...branchFilter },
        select: selectFields,
        orderBy: { updatedAt: "desc" },
        take: 50,
      });
    }

    // 3) まだ3件未満 → グループ全体 × 業種一致
    if (successLeads.length < 3) {
      successLeads = await db.lead.findMany({
        where: { ...successWhere, industry },
        select: selectFields,
        orderBy: { updatedAt: "desc" },
        take: 50,
      });
      dataSource = "group";
    }

    // 4) まだ3件未満 → グループ全体 × 全業種
    if (successLeads.length < 3) {
      successLeads = await db.lead.findMany({
        where: successWhere,
        select: selectFields,
        orderBy: { updatedAt: "desc" },
        take: 50,
      });
      dataSource = "group";
    }

    if (successLeads.length === 0) return null;

    // スキップリードも取得（同じ拠点優先ロジック）
    const skippedWhere = {
      status: "SKIPPED" as const,
      scoreBreakdown: { not: null as unknown as undefined },
      scoreTotal: { gt: 0 },
      ...(source ? { source } : {}),
    };
    let skippedLeads = await db.lead.findMany({
      where: { ...skippedWhere, ...(dataSource === "branch" ? branchFilter : {}) },
      select: { scoreTotal: true, scoreBreakdown: true, rating: true, industry: true },
      orderBy: { updatedAt: "desc" },
      take: 30,
    });
    if (skippedLeads.length < 3 && dataSource === "branch") {
      skippedLeads = await db.lead.findMany({
        where: skippedWhere,
        select: { scoreTotal: true, scoreBreakdown: true, rating: true, industry: true },
        orderBy: { updatedAt: "desc" },
        take: 30,
      });
    }

    // 成功リードの平均を計算
    const avgBreakdown = calcAvgBreakdown(successLeads.map((l) => l.scoreBreakdown as ScoreBreakdown));
    const avgTotal = Math.round(successLeads.reduce((s, l) => s + l.scoreTotal, 0) / successLeads.length);
    const avgRating = Math.round(successLeads.reduce((s, l) => s + l.rating, 0) / successLeads.length * 10) / 10;

    // スキップリードの平均
    let skippedAvgBreakdown: ScoreBreakdown | null = null;
    if (skippedLeads.length >= 3) {
      skippedAvgBreakdown = calcAvgBreakdown(skippedLeads.map((l) => l.scoreBreakdown as ScoreBreakdown));
    }

    // どの項目で成功/スキップの差が大きいかを分析
    const insights = generateInsights(avgBreakdown, skippedAvgBreakdown, successLeads.length, skippedLeads.length);

    // プロンプト用テキスト生成
    const promptText = buildPromptText(
      avgBreakdown,
      skippedAvgBreakdown,
      avgTotal,
      avgRating,
      successLeads.length,
      skippedLeads.length,
      insights,
      industry,
      dataSource
    );

    return {
      successCount: successLeads.length,
      skippedCount: skippedLeads.length,
      avgBreakdown,
      skippedAvgBreakdown,
      avgTotal,
      avgRating,
      promptText,
      dataSource,
    };
  } catch (err) {
    console.error("Success profile error:", err);
    return null;
  }
}

function calcAvgBreakdown(breakdowns: ScoreBreakdown[]): ScoreBreakdown {
  if (breakdowns.length === 0) return {};
  const keys = Object.keys(breakdowns[0]);
  const result: ScoreBreakdown = {};
  for (const key of keys) {
    const sum = breakdowns.reduce((s, b) => s + (b[key] ?? 0), 0);
    result[key] = Math.round((sum / breakdowns.length) * 10) / 10;
  }
  return result;
}

function generateInsights(
  success: ScoreBreakdown,
  skipped: ScoreBreakdown | null,
  successCount: number,
  skippedCount: number
): string[] {
  const insights: string[] = [];

  if (!skipped || skippedCount < 3) {
    // スキップデータ不足: 成功パターンのみ分析
    const sorted = Object.entries(success).sort(([, a], [, b]) => b - a);
    if (sorted.length >= 2) {
      insights.push(`成功リードでは「${keyToLabel(sorted[0][0])}」(平均${sorted[0][1]}点)が最も高スコア`);
      insights.push(`次いで「${keyToLabel(sorted[1][0])}」(平均${sorted[1][1]}点)`);
    }
    return insights;
  }

  // 成功とスキップの差分分析
  for (const key of Object.keys(success)) {
    const diff = (success[key] ?? 0) - (skipped[key] ?? 0);
    if (diff >= 3) {
      insights.push(`「${keyToLabel(key)}」が商談化の決め手（成功${success[key]}点 vs スキップ${skipped[key]}点、差+${diff.toFixed(1)}）`);
    } else if (diff <= -2) {
      insights.push(`「${keyToLabel(key)}」は商談化に影響しにくい（スキップ企業の方が高い傾向）`);
    }
  }

  return insights;
}

const LABEL_MAP: Record<string, string> = {
  industryMatch: "業種一致度",
  activity: "活発度",
  scale: "規模感",
  competitive: "競合優位性",
  accessibility: "接触しやすさ",
  digitalPresence: "デジタル活用度",
  proximity: "劇場距離",
  localFit: "地域密着度",
  youtubeOpportunity: "YouTube活用余地",
  growthSignal: "成長性",
};

function keyToLabel(key: string): string {
  return LABEL_MAP[key] ?? key;
}

function buildPromptText(
  success: ScoreBreakdown,
  skipped: ScoreBreakdown | null,
  avgTotal: number,
  avgRating: number,
  successCount: number,
  skippedCount: number,
  insights: string[],
  industry: string,
  dataSource: "branch" | "group"
): string {
  const lines: string[] = [];
  const scope = dataSource === "branch" ? "自拠点" : "グループ全体";
  lines.push(`【過去の営業実績データ（${industry}・${scope}）】`);
  lines.push(`商談化・アポ獲得した企業: ${successCount}件（平均スコア${avgTotal}点、平均Google評価${avgRating}）`);

  // 成功パターンの平均スコア配分
  const successEntries = Object.entries(success).filter(([, v]) => v > 0);
  if (successEntries.length > 0) {
    lines.push(`成功企業の平均スコア配分: ${successEntries.map(([k, v]) => `${keyToLabel(k)}=${v}`).join(", ")}`);
  }

  if (skipped && skippedCount >= 3) {
    lines.push(`スキップ（見送り）された企業: ${skippedCount}件`);
    const skippedEntries = Object.entries(skipped).filter(([, v]) => v > 0);
    if (skippedEntries.length > 0) {
      lines.push(`スキップ企業の平均スコア配分: ${skippedEntries.map(([k, v]) => `${keyToLabel(k)}=${v}`).join(", ")}`);
    }
  }

  if (insights.length > 0) {
    lines.push(`分析結果:`);
    for (const insight of insights) {
      lines.push(`- ${insight}`);
    }
  }

  lines.push(`※ 上記の実績傾向をスコアリングの参考にしてください。成功パターンに近い企業をより高く評価し、スキップパターンに近い企業は慎重に評価してください。`);

  return lines.join("\n");
}
