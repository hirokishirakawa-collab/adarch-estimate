import Anthropic from "@anthropic-ai/sdk";
import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import type { PlaceLead, WebsiteAnalysis } from "@/lib/constants/leads";

export const runtime = "nodejs";
export const maxDuration = 120;

// ----------------------------------------------------------------
// Webサイトを取得して分析する
// ----------------------------------------------------------------
async function analyzeWebsite(url: string): Promise<WebsiteAnalysis> {
  const empty: WebsiteAnalysis = {
    hasWebsite: false,
    hasVideo: false,
    hasYouTube: false,
    hasSns: [],
    siteAge: "unknown",
    hasRecruitPage: false,
    summary: "Webサイトなし",
  };

  if (!url) return empty;

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 8000);

    const res = await fetch(url, {
      signal: controller.signal,
      headers: {
        "User-Agent":
          "Mozilla/5.0 (compatible; AdArchBot/1.0; +https://adarch.co.jp)",
        Accept: "text/html",
      },
      redirect: "follow",
    });
    clearTimeout(timeout);

    if (!res.ok) return { ...empty, hasWebsite: true, summary: "サイトアクセス不可" };

    const html = await res.text();
    const lower = html.toLowerCase();

    // 動画関連
    const hasYouTube =
      lower.includes("youtube.com/embed") ||
      lower.includes("youtube.com/watch") ||
      lower.includes("youtu.be/");
    const hasVideo =
      hasYouTube ||
      lower.includes("<video") ||
      lower.includes("vimeo.com") ||
      lower.includes("tiktok.com/embed");

    // SNS
    const snsPatterns: [string, RegExp][] = [
      ["Instagram", /instagram\.com\/[a-zA-Z0-9_.]+/],
      ["Twitter/X", /(?:twitter\.com|x\.com)\/[a-zA-Z0-9_]+/],
      ["Facebook", /facebook\.com\/[a-zA-Z0-9_.]+/],
      ["TikTok", /tiktok\.com\/@[a-zA-Z0-9_.]+/],
      ["LINE", /line\.me\//],
    ];
    const hasSns = snsPatterns
      .filter(([, re]) => re.test(lower))
      .map(([name]) => name);

    // サイトの新しさ（viewport meta = レスポンシブ対応の有無で簡易判定）
    const hasViewport = lower.includes('name="viewport"') || lower.includes("name='viewport'");
    const hasModernFramework =
      lower.includes("next") ||
      lower.includes("nuxt") ||
      lower.includes("react") ||
      lower.includes("vue") ||
      lower.includes("__next");
    const siteAge: WebsiteAnalysis["siteAge"] =
      hasModernFramework ? "modern" : hasViewport ? "modern" : "outdated";

    // 採用ページ
    const hasRecruitPage =
      lower.includes("recruit") ||
      lower.includes("career") ||
      lower.includes("採用") ||
      lower.includes("求人");

    // サマリー生成
    const parts: string[] = [];
    if (hasVideo) parts.push(hasYouTube ? "YouTube動画あり" : "動画コンテンツあり");
    else parts.push("動画未活用");
    if (hasSns.length > 0) parts.push(`SNS: ${hasSns.join(",")}`);
    else parts.push("SNSリンクなし");
    if (siteAge === "outdated") parts.push("サイト古め");
    if (hasRecruitPage) parts.push("採用ページあり");

    return {
      hasWebsite: true,
      hasVideo,
      hasYouTube,
      hasSns,
      siteAge,
      hasRecruitPage,
      summary: parts.join(" / "),
    };
  } catch {
    return { ...empty, hasWebsite: true, summary: "サイト取得タイムアウト" };
  }
}

// ----------------------------------------------------------------
// POST /api/leads/score
// Webサイト分析 + Anthropic API で企業リストをスコアリング
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

  const body = (await req.json()) as {
    places: PlaceLead[];
    industry: string;
    area: string;
  };

  // 全企業のWebサイトを並列で分析
  const analyses = await Promise.all(
    body.places.map((p) => analyzeWebsite(p.websiteUrl))
  );

  const SYSTEM_PROMPT = `あなたはアドアーチグループの営業支援AIです。
企業リストを受け取り、広告営業のリード（見込み客）としての優先度をスコアリングしてください。

【スコアリング基準（合計100点）】
1. 業種一致度（25点）: 指定業種とのマッチ度。業種が一致すれば高得点。
2. 活発度（15点）: Googleレビュー数・評価から推測する事業活動レベル。
3. 規模感（15点）: 住所・レビュー数・業態から推測する企業規模。
4. 競合優位性（15点）: アドアーチの強み（映像制作・OOH広告）が活きそうか。
5. 接触しやすさ（10点）: 電話番号の有無、営業ステータス（OPERATIONAL等）から判定。
6. デジタル活用度（20点）: Webサイト分析結果から判定。以下の観点で採点する：
   - 動画を活用していない企業 → 映像提案チャンスが大きいため高得点（15-20点）
   - SNS運用が弱い企業 → SNS運用代行の提案余地があるため加点
   - サイトが古い・レスポンシブ非対応 → Web制作も含めた提案が可能で加点
   - 採用ページがある企業 → 採用動画の提案ができるため加点
   - 既に動画・SNSを活用している企業 → 提案余地が少ないため低得点（5-10点）
   - Webサイトがない企業 → デジタル全般の提案チャンスがあるため中得点（10-15点）
   ※ 重要: このスコアは「デジタルが進んでいる＝高得点」ではなく「アドアーチが提案できる余地が大きい＝高得点」

【重要ルール】
- 必ずJSON配列のみで返答（前置きや後書き一切不要）
- 各企業に対して上記6項目の内訳スコアと合計スコア、1行コメントを付与
- 合計スコアは各項目の合計（最大100点）
- コメントは営業担当が読む想定で、デジタル活用状況を踏まえた具体的なアプローチのヒントを含める

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

  const placeSummary = body.places
    .map(
      (p, i) =>
        `${i + 1}. ${p.name} | ${p.address} | 電話:${p.phone || "なし"} | 評価:${p.rating}(${p.ratingCount}件) | ステータス:${p.businessStatus} | 業態:${p.types.slice(0, 5).join(",")} | Web:${p.websiteUrl || "なし"} | サイト分析:${analyses[i].summary}`
    )
    .join("\n");

  const userMessage = `【対象業種】${body.industry}
【対象エリア】${body.area}

【企業リスト（Webサイト分析結果付き）】
${placeSummary}

上記の企業リストをスコアリングしてください。JSON配列のみで返答してください。`;

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

    // JSON部分を抽出（万が一マークダウンで囲まれていた場合も対応）
    const jsonMatch = text.match(/\[[\s\S]*\]/);
    if (!jsonMatch) {
      return NextResponse.json(
        { error: "AIレスポンスのパースに失敗しました" },
        { status: 500 }
      );
    }

    const scores = JSON.parse(jsonMatch[0]);

    // 各企業のWebサイト分析結果をインデックス付きで返す
    const analysisMap: Record<string, typeof analyses[number]> = {};
    body.places.forEach((p, i) => {
      analysisMap[p.name] = analyses[i];
    });

    return NextResponse.json({ scores, analyses: analysisMap });
  } catch (err) {
    console.error("Scoring error:", err);
    return NextResponse.json(
      { error: "スコアリング中にエラーが発生しました" },
      { status: 500 }
    );
  }
}
