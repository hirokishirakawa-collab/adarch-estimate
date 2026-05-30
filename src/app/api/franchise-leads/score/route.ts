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
企業リストを受け取り、「既存事業に広告媒体・動画を掛け合わせるフライホイール型パートナー」としての適性をスコアリングしてください。

【狙うパートナー像（フライホイール型）】
- 相手の本業が"作って終わり"のフロー型（店舗内装・リフォーム・看板・工務店・店舗用品・店舗不動産・開業支援・販促印刷・撮影・Web/SNS等）で、顧客に店舗/法人オーナー（＝広告の見込み客）を抱えている事業者。
- その本業に広告媒体の取扱い・動画提供を掛け合わせ、顧客の集客・成長まで伴走できる＝関係が続く（フライホイールが回る）。
- グループ参画費用は税込88万円・月額5万円。**理想は1〜2人体制（個人事業主・1人社長・2人体制）まで**。中規模以上は固定費構造で方針外（[feedback-partner-size-small-only]）。費用を払える経済力があり、成長意欲があり、輩感がなく、自己表現型の作家気質ではない商売気質の事業者。

【スコアリング基準（合計100点）※フライホイール適性で評価】
1. 地域ポテンシャル（20点）: 商圏・市場規模。既存パートナーとの地理重複は参考程度（媒体プランのダブル参画は地理制約が緩いため大きく減点しない）。
2. 営業力ポテンシャル（25点）: ★顧客基盤の太さ＝店舗/法人オーナー（広告の見込み客）をどれだけ抱えているか。フライホイールの源泉。単なる映像/広告会社ではなく「顧客に事業者を持つか」で評価する。
3. 事業規模（15点）: ★**1〜2人体制が理想**。1〜2人（個人事業主・1人社長・2人体制）=最高得点／3〜5人=中程度／6人以上=明確に減点／10人超・多数従業員・チェーンは大幅減点（方針外）。かつ参画費用を払える事業基盤があるか（メモリ feedback-partner-size-small-only / feedback-partner-economic-capacity 参照）。
4. デジタル活用度（15点）: Web/SNS/YouTube活用状況。活用している＝Ad ArchのOS・媒体運用を使いこなせる素地。
5. 独立動機の推定（15点）: 新規収益への意欲。★自社で店舗等を運営する型（お金が社内で回り外部資金が入らない）は減点。儲かりすぎ・完成され尽くした高収益事務所も動機が薄く減点。"他社（顧客）をサポートする立場"で外部資金（顧客の広告予算）を取り込める型を高評価。
6. 相性（10点）: フライホイール適性。本業がフロー型で顧客が広告見込み客、媒体/動画を自然に掛け合わせられるか。作家気質・輩感は減点。

【重要ルール】
- output_scores ツールを使って結果を出力してください
- 各企業に対して上記6項目の内訳スコアと合計スコア、1行コメントを付与
- コメントは加盟促進担当（白川代表）が読む想定で、フライホイール適性（顧客に事業者を持つか／本業がフロー型か）とアプローチのヒントを含める
- 保険代理店・大手スクール法人は対象外として低評価にする

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
    "comment": "店舗内装会社。飲食/美容の開業客を多数抱え、媒体/動画の掛け合わせでフライホイールが回る。小規模精鋭で動機も十分。"
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
      max_tokens: 8192,
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

    const scores = (toolBlock.input as { scores?: unknown[] }).scores ?? [];

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
