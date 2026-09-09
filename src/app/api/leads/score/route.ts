import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { validateBody, leadScoreSchema } from "@/lib/validations";
import { checkRateLimit, AI_RATE_LIMIT } from "@/lib/rate-limit";
import { getSessionInfo } from "@/lib/session";
import { runLeadScoring } from "@/lib/leads/score-pipeline";

export const runtime = "nodejs";
export const maxDuration = 120;

// ----------------------------------------------------------------
// POST /api/leads/score
// Webサイト分析 + YouTube分析 + Anthropic API で企業リストをスコアリング
// ----------------------------------------------------------------
export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const limited = checkRateLimit(session.user.email!, "leads/score", AI_RATE_LIMIT);
  if (limited) return limited;

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return NextResponse.json(
      { error: "ANTHROPIC_API_KEY が設定されていません" },
      { status: 500 }
    );
  }

  const parsed = await validateBody(req, leadScoreSchema);
  if (!parsed.success) return parsed.response;
  const body = parsed.data as { places: import("@/lib/constants/leads").PlaceLead[]; industry: string; area: string };

  // 拠点情報を取得（成功プロファイルの拠点フィルタ用）
  const sessionInfo = await getSessionInfo();
  const branchIds = sessionInfo
    ? [sessionInfo.branchId, sessionInfo.branchId2].filter((id): id is string => !!id)
    : [];

  try {
    const payload = await runLeadScoring(body, branchIds, apiKey);
    return NextResponse.json(payload);
  } catch (err) {
    console.error("Scoring error:", err);
    return NextResponse.json(
      { error: "スコアリング中にエラーが発生しました" },
      { status: 500 }
    );
  }
}
