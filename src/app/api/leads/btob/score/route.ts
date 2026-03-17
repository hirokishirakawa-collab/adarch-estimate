import Anthropic from "@anthropic-ai/sdk";
import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { btobScoreSchema } from "@/lib/validations";
import { checkRateLimit, AI_RATE_LIMIT } from "@/lib/rate-limit";

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
- 必ずJSON配列のみで返答（前置きや後書き不要）
- 各企業に対して6項目の内訳スコアと合計スコア、1行コメント
- コメントはBtoB営業向け：企業VP（企業紹介動画）、採用動画、商品PR動画、YouTube企業チャンネル、施設紹介動画等の具体的な提案ヒントを含める

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

  const companySummary = body.companies
    .map((c: any, i: number) => {
      const enrichment = enrichments[c.name] ?? {};
      const wa = enrichment.websiteAnalysis;
      const yt = enrichment.youtubeChannel;
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
      return parts.join(" | ");
    })
    .join("\n");

  const userMessage = `【対象業種】${body.industry}
【対象エリア】${body.area}

【企業リスト（エンリッチメント付き）】
${companySummary}

上記のBtoB企業リストをスコアリングしてください。JSON配列のみで返答してください。`;

  try {
    const client = new Anthropic({ apiKey });
    const response = await client.messages.create({
      model: "claude-sonnet-4-20250514",
      max_tokens: 4096,
      system: SYSTEM_PROMPT,
      messages: [{ role: "user", content: userMessage }],
    });

    const text =
      response.content[0].type === "text" ? response.content[0].text : "";

    const jsonMatch = text.match(/\[[\s\S]*\]/);
    if (!jsonMatch) {
      return NextResponse.json(
        { error: "AIレスポンスのパースに失敗しました" },
        { status: 500 }
      );
    }

    const scores = JSON.parse(jsonMatch[0]);
    return NextResponse.json({ scores });
  } catch (err) {
    console.error("[btob/score] error:", err);
    return NextResponse.json(
      { error: "スコアリング中にエラーが発生しました" },
      { status: 500 }
    );
  }
}
