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
}

/**
 * 指定業種の成功プロファイルをDBから生成する。
 * 業種単位で集計し、データが少なければ全業種で補完する。
 */
export async function getSuccessProfile(
  industry: string,
  source?: "GOOGLE_PLACES" | "CINEMA_AD" | "GBIZINFO"
): Promise<SuccessProfile | null> {
  try {
    // 成功リード: DEAL_CONVERTED または APPOINTMENT
    const successWhere = {
      status: { in: ["DEAL_CONVERTED" as const, "APPOINTMENT" as const] },
      scoreBreakdown: { not: null as unknown as undefined },
      scoreTotal: { gt: 0 },
      ...(source ? { source } : {}),
    };

    // まず業種一致で検索
    let successLeads = await db.lead.findMany({
      where: { ...successWhere, industry },
      select: {
        scoreTotal: true,
        scoreBreakdown: true,
        rating: true,
        ratingCount: true,
        industry: true,
      },
      orderBy: { updatedAt: "desc" },
      take: 50,
    });

    // 業種一致が3件未満なら全業種で補完
    if (successLeads.length < 3) {
      successLeads = await db.lead.findMany({
        where: successWhere,
        select: {
          scoreTotal: true,
          scoreBreakdown: true,
          rating: true,
          ratingCount: true,
          industry: true,
        },
        orderBy: { updatedAt: "desc" },
        take: 50,
      });
    }

    if (successLeads.length === 0) return null;

    // スキップリードも取得（負の学習）
    const skippedLeads = await db.lead.findMany({
      where: {
        status: "SKIPPED",
        scoreBreakdown: { not: null as unknown as undefined },
        scoreTotal: { gt: 0 },
        ...(source ? { source } : {}),
      },
      select: {
        scoreTotal: true,
        scoreBreakdown: true,
        rating: true,
        industry: true,
      },
      orderBy: { updatedAt: "desc" },
      take: 30,
    });

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
      industry
    );

    return {
      successCount: successLeads.length,
      skippedCount: skippedLeads.length,
      avgBreakdown,
      skippedAvgBreakdown,
      avgTotal,
      avgRating,
      promptText,
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
  industry: string
): string {
  const lines: string[] = [];
  lines.push(`【過去の営業実績データ（${industry}）】`);
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
