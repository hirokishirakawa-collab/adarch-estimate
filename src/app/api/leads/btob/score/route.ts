import Anthropic from "@anthropic-ai/sdk";
import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { btobScoreSchema } from "@/lib/validations";
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

  const limited = checkRateLimit(session.user.email!, "leads/btob/score", AI_RATE_LIMIT);
  if (limited) return limited;

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return NextResponse.json(
      { error: "ANTHROPIC_API_KEY が設定されていません" },
      { status: 500 }
    );
  }

  // Read the full body once, then validate the companies part
  const rawBody = await req.json();
  const parseResult = btobScoreSchema.safeParse(rawBody);
  if (!parseResult.success) {
    return NextResponse.json(
      { error: "入力データが不正です", details: parseResult.error.format() },
      { status: 400 }
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
  const allNames = body.companies.map((c: any) => c.name);
  const [existingLeads, existingCustomers, dualProfile] = await Promise.all([
    db.lead.findMany({
      where: { name: { in: allNames } },
      select: { name: true, status: true, scoreTotal: true },
    }).catch(() => [] as { name: string; status: string; scoreTotal: number }[]),
    db.customer.findMany({
      where: { name: { in: allNames } },
      select: { name: true, status: true },
    }).catch(() => [] as { name: string; status: string }[]),
    getSuccessProfileDual(body.industry, "GBIZINFO", branchIds),
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

  const SYSTEM_PROMPT = `あなたはアドアーチグループの法人営業支援AIです。
BtoB企業リストを受け取り、動画制作・広告営業のリード（見込み客）としての優先度をスコアリングしてください。

【スコアリング基準（合計100点）】
1. 業種適合度（20点）: アドアーチの強み（動画制作・広告）が活きる業種か。製造業（工場紹介動画）、不動産（物件PR）、IT/SaaS（サービス紹介）、医療（施設紹介）、教育（PR動画）等は高得点。
2. 企業規模（20点）: 資本金・従業員数から広告予算の見込みを推定。資本金5,000万以上 or 従業員50名以上 → 高得点。零細企業でも成長期であれば中得点。
3. デジタル活用度（20点）: Webサイト分析結果から判定。
   - 動画を活用していない → 映像提案チャンス大で高得点（15-20点）
   - SNSが弱い → 運用代行の余地で加点
   - サイトが古い → Web刷新+動画の包括提案が可能
   - 既に動画・SNSを活用 → 提案余地少で低得点
   ※ 「デジタルが進んでいる＝高得点」ではなく「提案余地が大きい＝高得点」
4. YouTube活用余地（20点）:
   - YouTubeチャンネルなし → 企業YouTube開設+動画制作の提案で最高得点
   - チャンネルあるが更新停止・動画数少 → リブート提案で高得点
   - 活発にYouTube運用中 → 追加制作ニーズはあるが提案余地は限定的
5. 成長性（10点）: 補助金受給歴がある＝成長投資中で加点。採用ページあり＝拡大期で加点。
6. 接触しやすさ（10点）: 代表者名あり、Webサイトあり、法人番号で信頼性確認済み等。

【重要ルール】
- コメントに具体的な数値予測（「売上○％UP」等）は絶対に書かない
- output_scores ツールを使って結果を出力してください
- 各企業に対して6項目の内訳スコアと合計スコア、1行コメント
- コメントはBtoB営業向け：企業VP（企業紹介動画）、採用動画、商品PR動画、YouTube企業チャンネル、施設紹介動画等の具体的な提案ヒントを含める
- 「⚠️既存リード」「⚠️既存顧客」が付記されている企業は、コメントにその旨を明記し、重複アプローチを避けるよう注意喚起する

【出力JSON形式】
[
  {
    "name": "企業名",
    "total": 78,
    "breakdown": {
      "industryMatch": 18,
      "scale": 15,
      "digitalPresence": 17,
      "youtubeOpportunity": 18,
      "growthSignal": 5,
      "accessibility": 5
    },
    "comment": "製造業・従業員200名。YouTube未活用。工場紹介動画+企業VP+採用動画の提案が有効。"
  }
]`;

  function formatCompany(c: any, i: number) {
    const enrichment = enrichments[c.name] ?? {};
    const wa = enrichment.websiteAnalysis;
    const yt = enrichment.youtubeChannel;
    const existingInfo = getExistingTag(c.name);
    const existTag = existingInfo ? ` | ⚠️${existingInfo}` : "";
    const parts = [
      `${i + 1}. ${c.name}`,
      `住所: ${c.address}`,
      `法人番号: ${c.corporateNumber}`,
      c.capital ? `資本金: ${(c.capital / 10000).toLocaleString()}万円` : "資本金: 不明",
      c.employeeCount ? `従業員: ${c.employeeCount}名` : "従業員: 不明",
      c.representativeName ? `代表: ${c.representativeName}` : "",
      c.websiteUrl ? `Web: ${c.websiteUrl}` : "Web: なし",
      c.businessItems?.length ? `事業: ${c.businessItems.join(", ")}` : "",
      c.subsidies?.length ? `補助金: ${c.subsidies.slice(0, 3).join(", ")}` : "補助金: なし",
      wa ? `サイト分析: ${wa.summary}` : "",
      yt ? `YouTube: ${yt.url} (登録者${yt.subscribers}人, ${yt.videoCount}本)` : "YouTube: チャンネルなし",
    ].filter(Boolean);
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
                  industryMatch: { type: "number" },
                  scale: { type: "number" },
                  digitalPresence: { type: "number" },
                  youtubeOpportunity: { type: "number" },
                  growthSignal: { type: "number" },
                  accessibility: { type: "number" },
                },
                required: ["industryMatch", "scale", "digitalPresence", "youtubeOpportunity", "growthSignal", "accessibility"],
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
  const indices = body.companies.map((_: any, i: number) => i);
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
        .map((i, j) => formatCompany(body.companies[i], j))
        .join("\n");

      const userMessage = `【対象業種】${body.industry}
【対象エリア】${body.area}
${profileSection}
【企業リスト（エンリッチメント付き）】
${batchSummary}

上記のBtoB企業リストをスコアリングしてください。`;

      const response = await client.messages.create({
        model: "claude-sonnet-5",
        thinking: { type: "disabled" },
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
    console.error("[btob/score] error:", err);
    return NextResponse.json(
      { error: "スコアリング中にエラーが発生しました" },
      { status: 500 }
    );
  }
}
