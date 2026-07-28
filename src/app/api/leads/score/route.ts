import Anthropic from "@anthropic-ai/sdk";
import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { validateBody, leadScoreSchema } from "@/lib/validations";
import { checkRateLimit, AI_RATE_LIMIT } from "@/lib/rate-limit";
import type { PlaceLead, YouTubeChannelInfo } from "@/lib/constants/leads";
import { analyzeWebsite } from "@/lib/leads/analyze-website";
import { searchYouTubeChannel } from "@/lib/leads/search-youtube";
import { getSuccessProfileDual } from "@/lib/leads/success-profile";
import { getSessionInfo } from "@/lib/session";
import { db } from "@/lib/db";
import { normalizeCompanyName } from "@/lib/leads/match-score";

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
  const body = parsed.data as { places: PlaceLead[]; industry: string; area: string };

  // 拠点情報を取得（成功プロファイルの拠点フィルタ用）
  const sessionInfo = await getSessionInfo();
  const branchIds = sessionInfo
    ? [sessionInfo.branchId, sessionInfo.branchId2].filter((id): id is string => !!id)
    : [];

  try {
  // 全企業のWebサイト + YouTube + 成功プロファイルを並列で分析
  const allNames = body.places.map((p) => p.name);
  const youtubeApiKey = process.env.YOUTUBE_API_KEY;

  // 既存リード・顧客の照合クエリも並列で実行
  const [websiteResults, youtubeResults, dualProfile, existingLeads, existingCustomers] = await Promise.all([
    Promise.all(body.places.map((p) => analyzeWebsite(p.websiteUrl, p.name, allNames))),
    youtubeApiKey
      ? Promise.all(body.places.map((p) => searchYouTubeChannel(p.name, youtubeApiKey)))
      : Promise.resolve(body.places.map(() => null)),
    getSuccessProfileDual(body.industry, "GOOGLE_PLACES", branchIds),
    db.lead.findMany({
      where: { name: { in: allNames } },
      select: { name: true, status: true, scoreTotal: true },
    }).catch(() => [] as { name: string; status: string; scoreTotal: number }[]),
    db.customer.findMany({
      where: { name: { in: allNames } },
      select: { name: true, status: true },
    }).catch(() => [] as { name: string; status: string }[]),
  ]);

  // 既存データマップ（正規化名でもマッチ）
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
  // 検索対象企業名を正規化名でもルックアップ
  function getExistingTag(name: string): string | undefined {
    return existingMap.get(name) ?? normalizedExisting.get(normalizeCompanyName(name));
  }
  const successProfile = dualProfile?.primary ?? null;
  const analyses = websiteResults.map((r) => r.analysis);

  const SYSTEM_PROMPT = `あなたはアドアーチグループの営業支援AIです。
企業リストを受け取り、広告営業のリード（見込み客）としての優先度をスコアリングしてください。

【スコアリング基準（合計100点）】
1. 業種一致度（25点）: 指定業種とのマッチ度。業種が一致すれば高得点。Google業種ラベルやAIプレイスサマリーが付記されている場合はそれも参考にする。
2. 活発度（15点）: Googleレビュー数・評価から推測する事業活動レベル。AIレビューサマリーが付記されている場合は顧客の声・評判・活況度の手がかりとして活用する。
3. 規模感（15点）: 「地域拠点の代表が直接アプローチして決まる規模」に近いほど高得点。大きいほど高得点ではない。
   - 独立企業・オーナー社長が意思決定する規模で、広告予算は出せる（複数店舗展開・商業エリア所在・サイト整備済み） → 高得点（12-15点）
   - 中規模チェーン等、本部決裁だが接点は作れる → 中得点（7-11点）
   - 上場企業・全国規模の大手・大手代理店が既に入っている規模 → 低得点（0-4点）。地域拠点の営業では決裁に届かず、実際に商談化しない
   - 個人事業・住宅地所在・サイトなしで広告予算が出せない規模 → 低得点（0-4点）
4. 競合優位性（15点）: アドアーチの強み（映像制作・OOH広告）が活きそうか。
   ※ 対象企業自体が映像制作会社・動画制作会社・映像プロダクション・広告代理店・クリエイティブスタジオの場合は同業（競合）のため 0点 とし、コメント冒頭に「【同業】」と明記する
5. 接触しやすさ（10点）: 電話番号の有無、営業ステータス（OPERATIONAL等）から判定。近日開業予定（FUTURE_OPENING）の場合は開業前アプローチの好機として加点。
6. デジタル活用度（20点）: Webサイト分析結果から判定。以下の観点で採点する：
   - 動画を活用していない企業 → 映像提案チャンスが大きいため高得点（15-20点）
   - SNS運用が弱い企業 → SNS運用代行の提案余地があるため加点
   - サイトが古い・レスポンシブ非対応 → Web制作も含めた提案が可能で加点
   - 採用ページがある企業 → 採用動画の提案ができるため加点
   - 既に動画・SNSを活用している企業 → 提案余地が少ないため低得点（5-10点）
   - Webサイトがない企業 → デジタル全般の提案チャンスがあるため中得点（10-15点）
   ※ 重要: このスコアは「デジタルが進んでいる＝高得点」ではなく「アドアーチが提案できる余地が大きい＝高得点」
   ※ YouTube情報が付記されている場合: チャンネルなし→YouTube開設+動画制作の提案チャンス大、チャンネルあるが動画数少/更新停止→リブート提案、活発→追加制作ニーズはあるが提案余地は限定的

【Google AIサマリーの活用】
- 「Googleレビュー要約」が付記されている場合: 顧客の評判・サービス品質・繁盛度を判断材料に使う。ネガティブ評価が多い企業はブランディング提案の好機
- 「Google概要」が付記されている場合: 事業内容・業種の正確な把握に使う。typesフィールドだけでは分からない詳細を補完
- 「周辺エリア」が付記されている場合: 立地の商業的ポテンシャルの判断材料に使う
- 「近日開業」フラグがある場合: 新規開業=広告ニーズ最大のタイミング。コメントで開業前アプローチを提案

【営業対象として外すべき企業（該当したら合計を大きく下げ、コメント冒頭に理由を明記する）】
- 同業: 映像制作会社・動画制作会社・映像プロダクション・クリエイティブスタジオ・広告代理店 → 「【同業】」
- 規模過大: 上場企業・全国規模の大手・大手代理店が既に入っている → 「【規模過大】」
- 規模過小: 広告予算を出せる事業規模に達していない → 「【予算なし】」
※ これらは「営業しても取れない／取ってはいけない」相手であり、他の項目が高くても優先度は低い

【重要ルール】
- コメントに具体的な数値予測（「売上○％UP」「集客○倍」「○％改善」等）は絶対に書かない。効果は定性的な表現（「認知拡大が期待できる」「集客強化につながる」等）に留めること
- output_scores ツールを使って結果を出力してください
- 各企業に対して上記6項目の内訳スコアと合計スコア、1行コメントを付与
- 合計スコアは各項目の合計（最大100点）
- コメントは営業担当が読む想定で、デジタル活用状況を踏まえた具体的なアプローチのヒントを含める
- 企業タイプ（チェーン/FC/独立/支店）が付記されている場合、コメントに営業アプローチの違いを反映する：
  - チェーン・FC → 本部決裁の可能性、エリア限定施策の提案が有効
  - 独立企業 → オーナー直接提案が可能、意思決定が早い傾向
  - 支店 → 本社への紹介依頼 or 支店独自予算の確認が必要
- 「⚠️既存リード」「⚠️既存顧客」が付記されている企業は、コメントにその旨を明記し、重複アプローチを避けるよう注意喚起する

【出力JSON形式】
[
  {
    "name": "企業名",
    "total": 78,
    "breakdown": {
      "industryMatch": 22,
      "activity": 12,
      "scale": 12,
      "competitive": 10,
      "accessibility": 7,
      "digitalPresence": 15
    },
    "comment": "動画未活用・SNSなし。映像制作+YouTube運用の提案が効果的。採用ページあり、採用動画の提案も有力。"
  }
]`;

  // 企業情報を文字列に変換するヘルパー
  function formatPlace(p: PlaceLead, i: number) {
    const yt = youtubeResults[i];
    const ytInfo = yt
      ? `YouTube: ${yt.url} (登録者${yt.subscribers}人, ${yt.videoCount}本)`
      : "YouTube: チャンネルなし";
    const aiParts: string[] = [];
    if (p.reviewSummary) aiParts.push(`Googleレビュー要約:${p.reviewSummary}`);
    if (p.placeSummary) aiParts.push(`Google概要:${p.placeSummary}`);
    if (p.neighborhoodSummary) aiParts.push(`周辺エリア:${p.neighborhoodSummary}`);
    if (p.googleMapsTypeLabel) aiParts.push(`Google業種ラベル:${p.googleMapsTypeLabel}`);
    if (p.isFutureOpening) aiParts.push(`★近日開業予定★`);
    const aiInfo = aiParts.length > 0 ? ` | ${aiParts.join(" | ")}` : "";
    const existingInfo = getExistingTag(p.name);
    const existTag = existingInfo ? ` | ⚠️${existingInfo}` : "";
    return `${p.name} | ${p.address} | 電話:${p.phone || "なし"} | 評価:${p.rating}(${p.ratingCount}件) | ステータス:${p.businessStatus} | 業態:${p.types.slice(0, 5).join(",")} | Web:${p.websiteUrl || "なし"} | サイト分析:${analyses[i].summary} | 企業タイプ:${analyses[i].businessType}(${analyses[i].businessTypeReason}) | ${ytInfo}${aiInfo}${existTag}`;
  }

  const profileSection = successProfile
    ? `\n${successProfile.promptText}\n`
    : "";

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
                  industryMatch: { type: "number" },
                  activity: { type: "number" },
                  scale: { type: "number" },
                  competitive: { type: "number" },
                  accessibility: { type: "number" },
                  digitalPresence: { type: "number" },
                },
                required: ["industryMatch", "activity", "scale", "competitive", "accessibility", "digitalPresence"],
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
  const indices = body.places.map((_, i) => i);
  const batches: number[][] = [];
  for (let i = 0; i < indices.length; i += BATCH_SIZE) {
    batches.push(indices.slice(i, i + BATCH_SIZE));
  }

    const client = new Anthropic({ apiKey });

    async function scoreBatch(batchIndices: number[]) {
      const batchSummary = batchIndices
        .map((i, j) => `${j + 1}. ${formatPlace(body.places[i], i)}`)
        .join("\n");

      const userMessage = `【対象業種】${body.industry}
【対象エリア】${body.area}
${profileSection}
【企業リスト（Webサイト分析結果付き）】
${batchSummary}

上記の企業リストをスコアリングしてください。`;

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

    // 各企業のWebサイト分析結果とYouTube情報をインデックス付きで返す
    const analysisMap: Record<string, typeof analyses[number]> = {};
    const youtubeMap: Record<string, YouTubeChannelInfo | null> = {};
    body.places.forEach((p, i) => {
      analysisMap[p.name] = analyses[i];
      youtubeMap[p.name] = youtubeResults[i];
    });

    return NextResponse.json({
      scores,
      analyses: analysisMap,
      youtube: youtubeMap,
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
    console.error("Scoring error:", err);
    return NextResponse.json(
      { error: "スコアリング中にエラーが発生しました" },
      { status: 500 }
    );
  }
}
