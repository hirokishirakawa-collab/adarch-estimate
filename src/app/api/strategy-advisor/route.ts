import Anthropic from "@anthropic-ai/sdk";
import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { MEDIA_MATRIX, MEDIA_ORDER } from "@/lib/strategy-matrix";

export const runtime = "nodejs";
export const maxDuration = 60;

// ----------------------------------------------------------------
// 媒体マトリクス文字列（プロンプト用）
// ----------------------------------------------------------------
const MATRIX_TEXT = MEDIA_ORDER.map((id) => {
  const m = MEDIA_MATRIX[id];
  return `### ${m.emoji} ${m.name}（mediaId: "${m.id}"）
- 最低予算: ${(m.minBudget / 10_000).toFixed(0)}万円 / 4週推奨: ${(m.recommendedBudget / 10_000).toFixed(0)}万円
- シミュレーターURL: ${m.simulatorPath}
- ターゲット: ${m.targetFit.ageRange}、男性${m.targetFit.male}/5・女性${m.targetFit.female}/5、ビジネス層${m.targetFit.businessLayer}/5、インバウンド${m.targetFit.inbound}/5
- 目的スコア: 認知拡大${m.purposeScore.awareness}/5・理解促進${m.purposeScore.understanding}/5・来店販促${m.purposeScore.conversion}/5・ブランドリフト${m.purposeScore.brandlift}/5・採用${m.purposeScore.recruitment}/5
- 強み: ${m.strengths.join(" / ")}
- 注意: ${m.considerations.join(" / ")}`;
}).join("\n\n");

const SYSTEM_PROMPT = `あなたはアドアーチグループの広告提案戦略アドバイザーです。
以下の取り扱い媒体データを元に、クライアント条件に最適な広告プランをプロとして提案してください。

【取り扱い媒体マトリクス】
${MATRIX_TEXT}

【重要なルール】
- 推奨プランは予算に応じて1〜3媒体を選ぶ（予算が少ない場合は1媒体に絞る）
- 最低予算を下回る媒体は推奨しない
- allocatedBudget の合計は入力予算を超えない
- mediaId は必ず上記8つから選ぶ: tver / skylark / aeon-cinema / taxi / golfcart / omochannel / sns / web
- reason・expectedEffect は具体的な数字・根拠を含める（「〜万回リーチ」「〜%の認知向上」等）
- upsellAdvice は「あと〇〇万円追加すると〜が倍増する」という具体的な提案
- 必ずJSON形式のみで返答（前置きや後書き一切不要）

【出力JSON形式】
{
  "recommendedPlans": [
    {
      "mediaId": "tver",
      "rank": 1,
      "allocatedBudget": 1500000,
      "reason": "なぜこの媒体を選んだかの論理的背景（2〜3文）",
      "expectedEffect": "期待できる効果・リーチ数の目安（具体的数字入り）",
      "crossEffect": "他の推奨媒体との相乗効果（なければ省略可）"
    }
  ],
  "schedule": {
    "week1_2": "準備フェーズ（素材制作・審査申請等）の内容",
    "week3_6": "実施フェーズの配信内容",
    "week7_8": "効果測定・最適化の内容"
  },
  "upsellAdvice": "予算をあと〇〇万円追加すると〜という形のアップセル提案（具体的数字必須）",
  "budgetAdvice": "現在予算内での最適化アドバイス（1〜2文）",
  "summary": "プラン全体の戦略サマリー（3〜4文）"
}`;

// ----------------------------------------------------------------
// POST /api/strategy-advisor
// ----------------------------------------------------------------
export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return NextResponse.json(
      { error: "ANTHROPIC_API_KEY が設定されていません" },
      { status: 500 }
    );
  }

  const body = await req.json() as {
    industry: string;
    gender: string;
    ageRange: string[];
    layer: string;
    inbound: boolean;
    purposes: string[];
    region: string;
    budget: number;
  };

  const budgetMan = body.budget ? `${Math.round(body.budget / 10_000)}万円` : "未入力";

  const userMessage = `【クライアント条件】
- 業種・業界: ${body.industry || "未指定"}
- ターゲット性別: ${body.gender}
- ターゲット年代: ${body.ageRange.length > 0 ? body.ageRange.join("・") : "指定なし"}
- 層: ${body.layer}
- インバウンド対象: ${body.inbound ? "あり（訪日外国人含む）" : "なし（国内のみ）"}
- 主要目的: ${body.purposes.length > 0 ? body.purposes.join("・") : "指定なし"}
- 実施地域: ${body.region}
- 予定予算: ${budgetMan}

上記条件、特に業種・業界の特性を踏まえ、最適な広告プランをJSON形式で提案してください。業界特有の購買行動・ターゲット接点・競合状況を考慮して具体的に提案してください。`;

  const client = new Anthropic({ apiKey });

  const stream = await client.messages.stream({
    model: "claude-sonnet-4-6",
    max_tokens: 2048,
    system: SYSTEM_PROMPT,
    messages: [{ role: "user", content: userMessage }],
  });

  const encoder = new TextEncoder();
  const readable = new ReadableStream({
    async start(controller) {
      try {
        for await (const event of stream) {
          if (
            event.type === "content_block_delta" &&
            event.delta.type === "text_delta"
          ) {
            controller.enqueue(encoder.encode(event.delta.text));
          }
        }
      } catch (e) {
        controller.error(e);
      } finally {
        controller.close();
      }
    },
    cancel() {
      stream.abort();
    },
  });

  return new Response(readable, {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Cache-Control": "no-cache",
      "X-Accel-Buffering": "no",
    },
  });
}
