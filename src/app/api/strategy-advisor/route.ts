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
以下の取り扱い媒体データを元に、クライアント条件に最適な長期広告プランをプロとして提案してください。

【取り扱い媒体マトリクス】
${MATRIX_TEXT}

【重要なルール】
- 単発ではなく「長期的な取引・成長」を前提にした複合提案を行う
- 第1推奨・第2推奨を明示し、両者の組み合わせ相乗効果も示す
- combinationPlans は2〜3パターン（予算帯別）を提案する
- longTermRoadmap は3フェーズで半年程度のロードマップを描く（初月SNSで認知→2ヶ月目以降に別媒体へ展開等）
- 初期フェーズで制作したクリエイティブを後のフェーズ・別媒体に転用する方法を必ず示す（コスト削減×接触頻度向上）
- 最低予算を下回る媒体は推奨しない
- mediaId は必ず上記8つから選ぶ: tver / skylark / aeon-cinema / taxi / golfcart / omochannel / sns / web
- 数字・根拠を具体的に含める（「〜万回リーチ」「〜%の認知向上」「制作費〜万円節約」等）
- 必ずJSON形式のみで返答（前置きや後書き一切不要）

【出力JSON形式】
{
  "strategyConcept": "全体の広告戦略コンセプト（業界特性を踏まえた2〜3文）",
  "creativeStrategy": "クリエイティブの横断活用方針（例: 1ヶ月目にSNS用15秒素材を2〜3パターン制作し、2ヶ月目にそのままTVerへ転用。3ヶ月目に静止画切り出しでWeb広告にも活用することで追加制作費ゼロで媒体展開可能）",
  "primaryRecommendation": {
    "mediaId": "sns",
    "allocatedBudget": 500000,
    "reason": "なぜ第1推奨か（業界特性・ターゲット適合性・初動効果を踏まえた2〜3文）",
    "expectedEffect": "期待効果・KPI（具体的数字必須。例: 月間インプレッション300万回、クリック率2.5%、フォロワー増加1,000人）"
  },
  "secondaryRecommendation": {
    "mediaId": "tver",
    "allocatedBudget": 1500000,
    "reason": "なぜ第2推奨か（第1との相乗効果・ターゲット補完を含む2〜3文）",
    "expectedEffect": "期待効果・KPI（具体的数字必須）"
  },
  "combinationPlans": [
    {
      "name": "スタンダードプラン（〜150万円/月）",
      "media": [
        {"mediaId": "sns", "budget": 500000},
        {"mediaId": "tver", "budget": 1000000}
      ],
      "totalBudget": 1500000,
      "synergy": "SNSで獲得した認知層がTVerで再接触することで記憶定着率2倍・指名検索増加が見込める"
    },
    {
      "name": "フルファネルプラン（〜250万円/月）",
      "media": [
        {"mediaId": "sns", "budget": 500000},
        {"mediaId": "tver", "budget": 1500000},
        {"mediaId": "web", "budget": 500000}
      ],
      "totalBudget": 2500000,
      "synergy": "SNS認知→TVer記憶定着→Web刈り取りの完全なファネル設計。TVerで興味を持った層をWebでリターゲティングしコンバージョンへ転換"
    }
  ],
  "longTermRoadmap": [
    {
      "phase": 1,
      "period": "1〜2ヶ月目",
      "theme": "認知基盤構築",
      "mediaIds": ["sns"],
      "monthlyBudget": 500000,
      "actions": "このフェーズで実施すること（ターゲット設定・A/Bテスト・データ収集等）",
      "objective": "達成目標・KPI（数字必須）",
      "creativeNote": "制作すべきクリエイティブ素材と後続フェーズへの転用計画"
    },
    {
      "phase": 2,
      "period": "3〜4ヶ月目",
      "theme": "認知拡大・ブランドリフト",
      "mediaIds": ["tver"],
      "monthlyBudget": 1500000,
      "actions": "前フェーズの知見を活かした展開内容",
      "objective": "達成目標・KPI（数字必須）",
      "creativeNote": "1ヶ月目素材をどう転用するか（費用削減額・手間の軽減）"
    },
    {
      "phase": 3,
      "period": "5〜6ヶ月目",
      "theme": "刈り取り・ROI最大化",
      "mediaIds": ["tver", "web"],
      "monthlyBudget": 2000000,
      "actions": "複数媒体連携で売上・採用数を最大化する施策",
      "objective": "達成目標・KPI（数字必須）",
      "creativeNote": "前フェーズ素材の横展開・リターゲティング活用"
    }
  ],
  "upsellAdvice": "あと〇〇万円追加すると〜できる（具体的数字・追加施策必須）",
  "budgetAdvice": "現予算内での最適化アドバイス（1〜2文）",
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
    max_tokens: 6000,
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
