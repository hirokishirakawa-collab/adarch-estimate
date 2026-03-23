import Anthropic from "@anthropic-ai/sdk";
import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { validateBody, leadScoreSchema } from "@/lib/validations";
import { checkRateLimit, AI_RATE_LIMIT } from "@/lib/rate-limit";
import type { PlaceLead, WebsiteAnalysis, BusinessType, YouTubeChannelInfo } from "@/lib/constants/leads";

export const runtime = "nodejs";
export const maxDuration = 120;

// ----------------------------------------------------------------
// チェーン店・フランチャイズ判定
// ----------------------------------------------------------------

// 名前から支店パターンを検出
const BRANCH_PATTERNS = [
  /(.+?)[　\s]+(.*?店)$/,        // 「○○ 渋谷店」
  /(.+?)[　\s]+(.*?支店)$/,      // 「○○ 東京支店」
  /(.+?)[　\s]+(.*?営業所)$/,    // 「○○ 関東営業所」
  /(.+?)[　\s]+(.*?出張所)$/,
  /(.+?)(.*?[都道府県市区町村]店)$/,  // 「○○東京都店」
  /(.+?)[\s　]*[（(](.+?)[）)]$/,   // 「○○（渋谷）」
];

// Webサイトからチェーン/FC判定するキーワード
const CHAIN_SITE_KEYWORDS = [
  "店舗一覧", "店舗検索", "store-locator", "store-list", "shop-list",
  "全国の店舗", "お近くの店舗", "エリアから探す",
];
const FRANCHISE_SITE_KEYWORDS = [
  "フランチャイズ", "franchise", "fc加盟", "fc募集", "加盟店募集",
  "オーナー募集", "独立開業",
];

function extractBaseName(name: string): string {
  for (const pattern of BRANCH_PATTERNS) {
    const m = name.match(pattern);
    if (m) return m[1].trim();
  }
  return name.trim();
}

function detectBusinessType(
  name: string,
  allNames: string[],
  html: string | null,
): { type: BusinessType; reason: string } {
  const baseName = extractBaseName(name);
  const lower = html?.toLowerCase() ?? "";

  // 1) 同一バッチ内に同名ベースの企業が複数 → チェーンの可能性大
  const siblings = allNames.filter((n) => {
    const other = extractBaseName(n);
    return other === baseName && n !== name;
  });

  // 2) サイト内のFC/チェーンキーワード
  const hasFranchiseKeyword = FRANCHISE_SITE_KEYWORDS.some((kw) => lower.includes(kw));
  const hasChainKeyword = CHAIN_SITE_KEYWORDS.some((kw) => lower.includes(kw));

  // 3) 名前に支店パターンがあるか
  const hasBranchPattern = BRANCH_PATTERNS.some((p) => p.test(name));

  // 判定ロジック
  if (hasFranchiseKeyword) {
    return {
      type: "franchise",
      reason: "サイトにフランチャイズ関連の記載あり",
    };
  }

  if (siblings.length >= 2 || (siblings.length >= 1 && hasChainKeyword)) {
    return {
      type: "chain",
      reason: `同名店舗が${siblings.length + 1}件検出（${baseName}）`,
    };
  }

  if (hasChainKeyword && hasBranchPattern) {
    return {
      type: "chain",
      reason: "店舗一覧ページあり・支店名パターン検出",
    };
  }

  if (hasChainKeyword) {
    return {
      type: "chain",
      reason: "サイトに店舗一覧・店舗検索あり",
    };
  }

  if (hasBranchPattern && siblings.length >= 1) {
    return {
      type: "branch",
      reason: `支店名パターン検出（本体: ${baseName}）`,
    };
  }

  if (hasBranchPattern) {
    return {
      type: "branch",
      reason: `支店・店舗名パターン検出（本体: ${baseName}）`,
    };
  }

  return {
    type: "independent",
    reason: "チェーン・FC の特徴なし（独立企業の可能性が高い）",
  };
}

// ----------------------------------------------------------------
// Webサイトを取得して分析する
// ----------------------------------------------------------------
async function analyzeWebsite(
  url: string,
  name: string,
  allNames: string[],
): Promise<{ analysis: WebsiteAnalysis; html: string | null }> {
  const empty: WebsiteAnalysis = {
    hasWebsite: false,
    hasVideo: false,
    hasYouTube: false,
    hasSns: [],
    siteAge: "unknown",
    hasRecruitPage: false,
    businessType: "unknown",
    businessTypeReason: "",
    summary: "Webサイトなし",
  };

  if (!url) {
    const bt = detectBusinessType(name, allNames, null);
    return {
      analysis: { ...empty, businessType: bt.type, businessTypeReason: bt.reason },
      html: null,
    };
  }

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

    if (!res.ok) {
      const bt = detectBusinessType(name, allNames, null);
      return {
        analysis: {
          ...empty,
          hasWebsite: true,
          businessType: bt.type,
          businessTypeReason: bt.reason,
          summary: "サイトアクセス不可",
        },
        html: null,
      };
    }

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

    // サイトの新しさ
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

    // チェーン/独立判定
    const bt = detectBusinessType(name, allNames, html);

    // サマリー生成
    const parts: string[] = [];
    if (hasVideo) parts.push(hasYouTube ? "YouTube動画あり" : "動画コンテンツあり");
    else parts.push("動画未活用");
    if (hasSns.length > 0) parts.push(`SNS: ${hasSns.join(",")}`);
    else parts.push("SNSリンクなし");
    if (siteAge === "outdated") parts.push("サイト古め");
    if (hasRecruitPage) parts.push("採用ページあり");

    return {
      analysis: {
        hasWebsite: true,
        hasVideo,
        hasYouTube,
        hasSns,
        siteAge,
        hasRecruitPage,
        businessType: bt.type,
        businessTypeReason: bt.reason,
        summary: parts.join(" / "),
      },
      html,
    };
  } catch {
    const bt = detectBusinessType(name, allNames, null);
    return {
      analysis: {
        ...empty,
        hasWebsite: true,
        businessType: bt.type,
        businessTypeReason: bt.reason,
        summary: "サイト取得タイムアウト",
      },
      html: null,
    };
  }
}

// ----------------------------------------------------------------
// YouTubeチャンネル検索
// ----------------------------------------------------------------
async function searchYouTubeChannel(
  companyName: string,
  apiKey: string
): Promise<YouTubeChannelInfo | null> {
  try {
    const searchUrl = new URL("https://www.googleapis.com/youtube/v3/search");
    searchUrl.searchParams.set("part", "snippet");
    searchUrl.searchParams.set("type", "channel");
    searchUrl.searchParams.set("q", companyName);
    searchUrl.searchParams.set("maxResults", "1");
    searchUrl.searchParams.set("key", apiKey);

    const searchRes = await fetch(searchUrl.toString());
    if (!searchRes.ok) return null;

    const searchData = await searchRes.json();
    const items = searchData.items ?? [];
    if (items.length === 0) return null;

    const channelId = items[0].snippet?.channelId ?? items[0].id?.channelId;
    if (!channelId) return null;

    const statsUrl = new URL("https://www.googleapis.com/youtube/v3/channels");
    statsUrl.searchParams.set("part", "statistics,contentDetails,snippet");
    statsUrl.searchParams.set("id", channelId);
    statsUrl.searchParams.set("key", apiKey);

    const statsRes = await fetch(statsUrl.toString());
    if (!statsRes.ok) return null;

    const statsData = await statsRes.json();
    const channel = statsData.items?.[0];
    if (!channel) return null;

    return {
      url: `https://www.youtube.com/channel/${channelId}`,
      subscribers: Number(channel.statistics?.subscriberCount ?? 0),
      videoCount: Number(channel.statistics?.videoCount ?? 0),
      lastUpload: channel.snippet?.publishedAt,
    };
  } catch {
    return null;
  }
}

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

  // 全企業のWebサイト + YouTubeを並列で分析
  const allNames = body.places.map((p) => p.name);
  const youtubeApiKey = process.env.YOUTUBE_API_KEY;

  const [websiteResults, youtubeResults] = await Promise.all([
    Promise.all(body.places.map((p) => analyzeWebsite(p.websiteUrl, p.name, allNames))),
    youtubeApiKey
      ? Promise.all(body.places.map((p) => searchYouTubeChannel(p.name, youtubeApiKey)))
      : Promise.resolve(body.places.map(() => null)),
  ]);
  const analyses = websiteResults.map((r) => r.analysis);

  const SYSTEM_PROMPT = `あなたはアドアーチグループの営業支援AIです。
企業リストを受け取り、広告営業のリード（見込み客）としての優先度をスコアリングしてください。

【スコアリング基準（合計100点）】
1. 業種一致度（25点）: 指定業種とのマッチ度。業種が一致すれば高得点。
2. 活発度（15点）: Googleレビュー数・評価から推測する事業活動レベル。
3. 規模感（15点）: 広告予算を出せる企業規模か。複数店舗展開・商業エリア所在・採用ページあり・Webサイト整備済み → 高得点。個人事業・住宅地所在・サイトなし → 低得点。
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
   ※ YouTube情報が付記されている場合: チャンネルなし→YouTube開設+動画制作の提案チャンス大、チャンネルあるが動画数少/更新停止→リブート提案、活発→追加制作ニーズはあるが提案余地は限定的

【重要ルール】
- コメントに具体的な数値予測（「売上○％UP」「集客○倍」「○％改善」等）は絶対に書かない。効果は定性的な表現（「認知拡大が期待できる」「集客強化につながる」等）に留めること
- 必ずJSON配列のみで返答（前置きや後書き一切不要）
- 各企業に対して上記6項目の内訳スコアと合計スコア、1行コメントを付与
- 合計スコアは各項目の合計（最大100点）
- コメントは営業担当が読む想定で、デジタル活用状況を踏まえた具体的なアプローチのヒントを含める
- 企業タイプ（チェーン/FC/独立/支店）が付記されている場合、コメントに営業アプローチの違いを反映する：
  - チェーン・FC → 本部決裁の可能性、エリア限定施策の提案が有効
  - 独立企業 → オーナー直接提案が可能、意思決定が早い傾向
  - 支店 → 本社への紹介依頼 or 支店独自予算の確認が必要

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
      (p, i) => {
        const yt = youtubeResults[i];
        const ytInfo = yt
          ? `YouTube: ${yt.url} (登録者${yt.subscribers}人, ${yt.videoCount}本)`
          : "YouTube: チャンネルなし";
        return `${i + 1}. ${p.name} | ${p.address} | 電話:${p.phone || "なし"} | 評価:${p.rating}(${p.ratingCount}件) | ステータス:${p.businessStatus} | 業態:${p.types.slice(0, 5).join(",")} | Web:${p.websiteUrl || "なし"} | サイト分析:${analyses[i].summary} | 企業タイプ:${analyses[i].businessType}(${analyses[i].businessTypeReason}) | ${ytInfo}`;
      }
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

    // 各企業のWebサイト分析結果とYouTube情報をインデックス付きで返す
    const analysisMap: Record<string, typeof analyses[number]> = {};
    const youtubeMap: Record<string, YouTubeChannelInfo | null> = {};
    body.places.forEach((p, i) => {
      analysisMap[p.name] = analyses[i];
      youtubeMap[p.name] = youtubeResults[i];
    });

    return NextResponse.json({ scores, analyses: analysisMap, youtube: youtubeMap });
  } catch (err) {
    console.error("Scoring error:", err);
    return NextResponse.json(
      { error: "スコアリング中にエラーが発生しました" },
      { status: 500 }
    );
  }
}
