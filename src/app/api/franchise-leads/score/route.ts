import Anthropic from "@anthropic-ai/sdk";
import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { validateBody, franchiseLeadScoreSchema } from "@/lib/validations";
import { checkRateLimit, AI_RATE_LIMIT } from "@/lib/rate-limit";
import type { UserRole } from "@/types/roles";
import { analyzeWebsiteSimple } from "@/lib/leads/analyze-website";
import { searchYouTubeChannel } from "@/lib/leads/search-youtube";
import type { YouTubeChannelInfo } from "@/lib/constants/leads";

// ----------------------------------------------------------------
// POST /api/franchise-leads/score
// Webサイト分析 + YouTube分析 + Claude AIで加盟候補スコアリング
// ADMIN限定
// ----------------------------------------------------------------
export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const role = (session.user.role ?? "USER") as UserRole;
  if (role !== "ADMIN") {
    return NextResponse.json({ error: "管理者権限が必要です" }, { status: 403 });
  }

  const limited = checkRateLimit(session.user.email!, "franchise-leads/score", AI_RATE_LIMIT);
  if (limited) return limited;

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ error: "ANTHROPIC_API_KEY が設定されていません" }, { status: 500 });
  }

  const parsed = await validateBody(req, franchiseLeadScoreSchema);
  if (!parsed.success) return parsed.response;
  const body = parsed.data;

  // Webサイト + YouTube 並列分析
  const youtubeApiKey = process.env.YOUTUBE_API_KEY;
  const [websiteResults, youtubeResults] = await Promise.all([
    Promise.all(body.places.map((p) => analyzeWebsiteSimple(p.websiteUrl))),
    youtubeApiKey
      ? Promise.all(body.places.map((p) => searchYouTubeChannel(p.name, youtubeApiKey)))
      : Promise.resolve(body.places.map(() => null as YouTubeChannelInfo | null)),
  ]);
  const analyses = websiteResults.map((r) => r.analysis);

  const SYSTEM_PROMPT = `あなたはAd Arch株式会社の加盟促進AIアドバイザーです。
企業リストを受け取り、Ad Archグループへの加盟候補としての適性をスコアリングしてください。

【Ad Archグループについて】
- OOH広告（屋外広告・デジタルサイネージ・タクシー広告等）と映像制作を主力とする広告会社グループ
- 全国に加盟パートナー26社を展開中、さらに20拠点の拡大を目指している
- 加盟条件: 加盟金80万円+税（税込88万円）、ロイヤリティ月額5万円（初月から）
- 加盟メリット: 本部からのOOH媒体提供、制作ツール、営業支援AI、グループ連携

【スコアリング基準（合計100点）】
1. 地域ポテンシャル（20点）: 既存パートナーとの重複がないか、人口規模、広告市場の大きさ
2. 営業力ポテンシャル（25点）: 業種（映像制作・広告代理店は高得点）、法人営業経験の推定、既存クライアント基盤
3. 事業規模（15点）: 従業員数の推定、設立年数の推定、安定した事業基盤があるか
4. デジタル活用度（15点）: Web/SNS/YouTube活用状況。活用している=デジタルリテラシーが高い=Ad ArchのOSを使いこなせる
5. 独立動機の推定（15点）: 業種のトレンド（印刷業の縮小傾向、Web制作の競争激化等）、新規事業への意欲がありそうか
6. 相性（10点）: Ad Archグループのモデル（広告媒体営業+制作）との親和性

【重要ルール】
- output_scores ツールを使って結果を出力してください
- 各企業に対して上記6項目の内訳スコアと合計スコア、1行コメントを付与
- コメントは加盟促進の営業担当（白川代表）が読む想定で、アプローチのヒントを含める

【出力JSON形式】
[
  {
    "name": "企業名",
    "total": 78,
    "breakdown": {
      "regionPotential": 18,
      "salesPotential": 22,
      "businessScale": 12,
      "digitalLiteracy": 13,
      "motivationEstimate": 8,
      "compatibility": 5
    },
    "comment": "映像制作会社で営業力あり。OOH媒体の取扱いで収益拡大を提案可能。"
  }
]`;

  const placeSummary = body.places
    .map((p, i) => {
      const yt = youtubeResults[i];
      const ytInfo = yt
        ? `YouTube: ${yt.url} (登録者${yt.subscribers}人, ${yt.videoCount}本)`
        : "YouTube: チャンネルなし";
      const aiParts: string[] = [];
      if (p.reviewSummary) aiParts.push(`Googleレビュー要約:${p.reviewSummary}`);
      if (p.placeSummary) aiParts.push(`Google概要:${p.placeSummary}`);
      if (p.neighborhoodSummary) aiParts.push(`周辺エリア:${p.neighborhoodSummary}`);
      if (p.googleMapsTypeLabel) aiParts.push(`Google業種ラベル:${p.googleMapsTypeLabel}`);
      if (p.isFutureOpening) aiParts.push(`近日開業予定`);
      const aiInfo = aiParts.length > 0 ? ` | ${aiParts.join(" | ")}` : "";
      return `${i + 1}. ${p.name} | ${p.address} | 電話:${p.phone || "なし"} | 評価:${p.rating}(${p.ratingCount}件) | Web:${p.websiteUrl || "なし"} | サイト分析:${analyses[i].summary} | ${ytInfo}${aiInfo}`;
    })
    .join("\n");

  const userMessage = `【対象業種】${body.businessType}
【対象エリア】${body.area}

【企業リスト（Webサイト分析結果付き）】
${placeSummary}

上記の企業リストをAd Archグループ加盟候補としてスコアリングしてください。`;

  try {
    const client = new Anthropic({ apiKey });
    const response = await client.messages.create({
      model: "claude-sonnet-4-6",
      max_tokens: 4096,
      system: [
        { type: "text", text: SYSTEM_PROMPT, cache_control: { type: "ephemeral" } },
      ],
      messages: [{ role: "user", content: userMessage }],
      tools: [{
        name: "output_scores",
        description: "スコアリング結果を出力する",
        input_schema: {
          type: "object" as const,
          properties: {
            scores: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  name: { type: "string" },
                  total: { type: "number" },
                  breakdown: {
                    type: "object",
                    properties: {
                      regionPotential: { type: "number" },
                      salesPotential: { type: "number" },
                      businessScale: { type: "number" },
                      digitalLiteracy: { type: "number" },
                      motivationEstimate: { type: "number" },
                      compatibility: { type: "number" },
                    },
                    required: ["regionPotential", "salesPotential", "businessScale", "digitalLiteracy", "motivationEstimate", "compatibility"],
                  },
                  comment: { type: "string" },
                },
                required: ["name", "total", "breakdown", "comment"],
              },
            },
          },
          required: ["scores"],
        },
      }],
      tool_choice: { type: "tool", name: "output_scores" },
    });

    const toolBlock = response.content.find(
      (b): b is Anthropic.Messages.ToolUseBlock => b.type === "tool_use"
    );
    if (!toolBlock) {
      return NextResponse.json({ error: "AIレスポンスのパースに失敗しました" }, { status: 500 });
    }

    const scores = (toolBlock.input as { scores: unknown[] }).scores;

    const analysisMap: Record<string, typeof analyses[number]> = {};
    const youtubeMap: Record<string, YouTubeChannelInfo | null> = {};
    body.places.forEach((p, i) => {
      analysisMap[p.name] = analyses[i];
      youtubeMap[p.name] = youtubeResults[i];
    });

    return NextResponse.json({ scores, analyses: analysisMap, youtube: youtubeMap });
  } catch (err) {
    console.error("Franchise lead scoring error:", err);
    return NextResponse.json({ error: "スコアリング中にエラーが発生しました" }, { status: 500 });
  }
}
