import Anthropic from "@anthropic-ai/sdk";
import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { recruitScoreSchema } from "@/lib/validations";
import { checkRateLimit, AI_RATE_LIMIT } from "@/lib/rate-limit";
import { db } from "@/lib/db";
import { normalizeCompanyName } from "@/lib/leads/match-score";
import { getSuccessProfileDual } from "@/lib/leads/success-profile";
import { getSessionInfo } from "@/lib/session";

export const runtime = "nodejs";
export const maxDuration = 120;

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const limited = checkRateLimit(session.user.email!, "leads/recruit/score", AI_RATE_LIMIT);
  if (limited) return limited;

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return NextResponse.json(
      { error: "ANTHROPIC_API_KEY が設定されていません" },
      { status: 500 },
    );
  }

  const rawBody = await req.json();
  const parseResult = recruitScoreSchema.safeParse(rawBody);
  if (!parseResult.success) {
    return NextResponse.json(
      { error: "入力データが不正です", details: parseResult.error.format() },
      { status: 400 },
    );
  }
  const body = parseResult.data;
  const enrichments: Record<string, any> = rawBody.enrichments ?? {};

  // 拠点情報を取得
  const sessionInfo = await getSessionInfo();
  const branchIds = sessionInfo
    ? [sessionInfo.branchId, sessionInfo.branchId2].filter((id): id is string => !!id)
    : [];

  // 既存リード・顧客の照合 + 成功プロファイル
  const allNames = body.places.map((p: any) => p.name);
  const [existingLeads, existingCustomers, dualProfile] = await Promise.all([
    db.lead.findMany({
      where: { name: { in: allNames } },
      select: { name: true, status: true, scoreTotal: true },
    }).catch(() => [] as { name: string; status: string; scoreTotal: number }[]),
    db.customer.findMany({
      where: { name: { in: allNames } },
      select: { name: true, status: true },
    }).catch(() => [] as { name: string; status: string }[]),
    getSuccessProfileDual(body.industry, "GOOGLE_PLACES", branchIds),
  ]);
  const successProfile = dualProfile?.primary ?? null;

  const existingMap = new Map<string, string>();
  const normalizedExisting = new Map<string, string>();
  for (const l of existingLeads) {
    const tag = `既存リード（${l.status}・スコア${l.scoreTotal}点）`;
    existingMap.set(l.name, tag);
    normalizedExisting.set(normalizeCompanyName(l.name), tag);
  }
  for (const c of existingCustomers) {
    const tag = `既存顧客（${c.status}）`;
    existingMap.set(c.name, tag);
    normalizedExisting.set(normalizeCompanyName(c.name), tag);
  }
  function getExistingTag(name: string): string | undefined {
    return existingMap.get(name) ?? normalizedExisting.get(normalizeCompanyName(name));
  }

  const SYSTEM_PROMPT = `あなたはアドアーチグループの採用マーケティング支援AIです。
企業リストを受け取り、「採用動画・採用SNS・採用ブランディング」の提案先としての優先度をスコアリングしてください。

【スコアリング基準（合計100点）】
1. 採用活動度（20点）: 採用ページの充実度、求人職種数、急募シグナル。活発に採用中 → 高得点。
2. 採用手法の旧さ（20点）: テキストのみの求人、写真なし、動画なし → アドアーチの提案余地大で高得点。既に採用動画を活用中 → 低得点。
   ※ 「進んでいる＝高得点」ではなく「提案余地が大きい＝高得点」
3. 採用動画チャンス（20点）:
   - 採用ページに動画なし → 採用動画制作の提案で最高得点
   - YouTube未活用 → 企業YouTube+採用コンテンツの提案で高得点
   - 既に動画活用中 → 追加制作やリニューアルの余地を評価
4. 採用SNSチャンス（15点）:
   - 採用ページにSNSリンクなし → 採用SNS運用の提案で高得点
   - SNSはあるが採用コンテンツなし → 採用特化コンテンツの提案
   - TikTok/Instagram未活用 → 若年層リーチの提案チャンス
5. 企業規模・予算感（15点）: レビュー数・評価・事業所数・採用規模から推定。複数職種の大量募集 → 高得点。
6. 接触しやすさ（10点）: 電話番号の有無、採用担当窓口の有無、営業ステータス。

【採用タイプ別の提案ヒント】
- 中途採用中心: 経験者向け採用動画（社員インタビュー・1日の流れ）、転職者向けSNS発信
- 新卒採用中心: 会社説明会動画、インターンPR、TikTok/Instagram Reelsでの企業文化発信
- 両方: 包括的な採用ブランディング動画+SNS運用の提案が有効

【使用中の求人プラットフォーム別ヒント】
- Indeed/タウンワーク等のテキスト求人サイトのみ → 動画で差別化の余地大
- Wantedly/Green → ITリテラシー高め、採用動画・SNSの費用対効果を訴求
- ハローワークのみ → デジタル採用全般の提案チャンス

【重要ルール】
- コメントに具体的な数値予測（「応募○倍」等）は絶対に書かない
- output_scores ツールを使って結果を出力してください
- 各企業に対して6項目の内訳スコアと合計スコア、1行コメントを付与
- コメントには採用タイプ（中途/新卒/両方）を踏まえた具体的な提案ヒントを含める
- 「⚠️既存リード」「⚠️既存顧客」が付記されている企業は、コメントにその旨を明記し、重複アプローチを避けるよう注意喚起する

【出力JSON形式】
[
  {
    "name": "企業名",
    "total": 78,
    "breakdown": {
      "recruitActivity": 18,
      "recruitMethodAge": 16,
      "videoOpportunity": 18,
      "snsOpportunity": 12,
      "companyScale": 9,
      "accessibility": 5
    },
    "comment": "中途採用中心・3職種募集中。採用動画なし。社員インタビュー動画+Instagram採用アカウントの提案が有効。"
  }
]`;

  function formatPlace(p: any, i: number) {
    const enrichment = enrichments[p.name] ?? {};
    const wa = enrichment.websiteAnalysis;
    const yt = enrichment.youtubeChannel;
    const ra = enrichment.recruitAnalysis;
    const existingInfo = getExistingTag(p.name);
    const existTag = existingInfo ? ` | ⚠️${existingInfo}` : "";

    const parts = [
      `${i + 1}. ${p.name}`,
      `住所: ${p.address}`,
      `電話: ${p.phone || "なし"}`,
      `評価: ${p.rating}(${p.ratingCount}件)`,
      `ステータス: ${p.businessStatus}`,
      `業態: ${p.types?.slice(0, 5).join(",")}`,
      `Web: ${p.websiteUrl || "なし"}`,
    ];

    if (wa) parts.push(`サイト分析: ${wa.summary}`);

    if (ra) {
      parts.push(`採用分析: ${ra.summary}`);
      if (ra.recruitType !== "unknown") {
        const typeLabel = ra.recruitType === "both" ? "中途+新卒"
          : ra.recruitType === "midcareer" ? "中途採用"
          : "新卒採用";
        parts.push(`採用タイプ: ${typeLabel}`);
      }
      if (ra.recruitTypeSignals?.length > 0) {
        parts.push(`採用シグナル: ${ra.recruitTypeSignals.join(", ")}`);
      }
      if (ra.jobTypes?.length > 0) parts.push(`募集職種: ${ra.jobTypes.join(",")}`);
      if (ra.usesRecruitPlatform?.length > 0) parts.push(`求人サイト: ${ra.usesRecruitPlatform.join(",")}`);
      if (ra.urgencySignals?.length > 0) parts.push(`急募: ${ra.urgencySignals.join(",")}`);
      parts.push(`採用動画: ${ra.hasRecruitVideo ? "あり" : "なし"}`);
      if (ra.hasRecruitSns?.length > 0) parts.push(`採用SNS: ${ra.hasRecruitSns.join(",")}`);
    }

    if (yt) parts.push(`YouTube: ${yt.url} (登録者${yt.subscribers}人, ${yt.videoCount}本)`);
    else parts.push("YouTube: チャンネルなし");

    if (p.reviewSummary) parts.push(`レビュー要約: ${p.reviewSummary}`);
    if (p.placeSummary) parts.push(`概要: ${p.placeSummary}`);
    if (p.googleMapsTypeLabel) parts.push(`業種ラベル: ${p.googleMapsTypeLabel}`);

    return parts.join(" | ") + existTag;
  }

  const SCORE_TOOLS = [{
    name: "output_scores" as const,
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
                  recruitActivity: { type: "number" },
                  recruitMethodAge: { type: "number" },
                  videoOpportunity: { type: "number" },
                  snsOpportunity: { type: "number" },
                  companyScale: { type: "number" },
                  accessibility: { type: "number" },
                },
                required: ["recruitActivity", "recruitMethodAge", "videoOpportunity", "snsOpportunity", "companyScale", "accessibility"],
              },
              comment: { type: "string" },
            },
            required: ["name", "total", "breakdown", "comment"],
          },
        },
      },
      required: ["scores"],
    },
  }];

  // 分割並列スコアリング（15件以上は分割して並列実行）
  const BATCH_SIZE = 15;
  const indices = body.places.map((_: any, i: number) => i);
  const batches: number[][] = [];
  for (let i = 0; i < indices.length; i += BATCH_SIZE) {
    batches.push(indices.slice(i, i + BATCH_SIZE));
  }

  const profileSection = successProfile
    ? `\n${successProfile.promptText}\n`
    : "";

  try {
    const client = new Anthropic({ apiKey });

    async function scoreBatch(batchIndices: number[]) {
      const batchSummary = batchIndices
        .map((i, j) => formatPlace(body.places[i], j))
        .join("\n");

      const userMessage = `【対象業種】${body.industry}
【対象エリア】${body.area}
${profileSection}
【企業リスト（採用ページ分析・エンリッチメント付き）】
${batchSummary}

上記の企業リストを採用マーケティングの観点でスコアリングしてください。`;

      const response = await client.messages.create({
        model: "claude-sonnet-4-6",
        max_tokens: 4096,
        system: [
          { type: "text", text: SYSTEM_PROMPT, cache_control: { type: "ephemeral" } },
        ],
        messages: [{ role: "user", content: userMessage }],
        tools: SCORE_TOOLS,
        tool_choice: { type: "tool", name: "output_scores" },
      });

      const toolBlock = response.content.find(
        (b): b is Anthropic.Messages.ToolUseBlock => b.type === "tool_use"
      );
      if (!toolBlock) return [];
      return (toolBlock.input as { scores: unknown[] }).scores;
    }

    // 並列実行してマージ
    const batchResults = await Promise.all(batches.map(scoreBatch));
    const scores = batchResults.flat();

    return NextResponse.json({
      scores,
      successProfile: successProfile
        ? {
            successCount: successProfile.successCount,
            skippedCount: successProfile.skippedCount,
            avgTotal: successProfile.avgTotal,
            avgBreakdown: successProfile.avgBreakdown,
            dataSource: successProfile.dataSource,
          }
        : null,
      groupProfile: dualProfile?.groupProfile
        ? {
            successCount: dualProfile.groupProfile.successCount,
            avgTotal: dualProfile.groupProfile.avgTotal,
            avgBreakdown: dualProfile.groupProfile.avgBreakdown,
          }
        : null,
    });
  } catch (err) {
    console.error("[recruit/score] error:", err);
    return NextResponse.json(
      { error: "スコアリング中にエラーが発生しました" },
      { status: 500 },
    );
  }
}
