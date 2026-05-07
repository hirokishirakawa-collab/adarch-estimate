import Anthropic from "@anthropic-ai/sdk";
import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { validateBody, franchiseLeadScoreSchema } from "@/lib/validations";
import { checkRateLimit, AI_RATE_LIMIT } from "@/lib/rate-limit";
import type { UserRole } from "@/types/roles";

export const runtime = "nodejs";
export const maxDuration = 120;

// ----------------------------------------------------------------
// Webサイト分析（簡易版）
// ----------------------------------------------------------------
interface WebAnalysis {
  hasWebsite: boolean;
  hasYoutube: boolean;
  hasSns: string[];
  siteAge: "modern" | "outdated" | "unknown";
  hasRecruitPage: boolean;
  summary: string;
}

async function analyzeWebsite(url: string): Promise<{ analysis: WebAnalysis; html: string | null }> {
  const empty: WebAnalysis = {
    hasWebsite: false,
    hasYoutube: false,
    hasSns: [],
    siteAge: "unknown",
    hasRecruitPage: false,
    summary: "Webサイトなし",
  };

  if (!url) return { analysis: empty, html: null };

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 8000);

    const res = await fetch(url, {
      signal: controller.signal,
      headers: {
        "User-Agent": "Mozilla/5.0 (compatible; AdArchBot/1.0; +https://adarch.co.jp)",
        Accept: "text/html",
      },
      redirect: "follow",
    });
    clearTimeout(timeout);

    if (!res.ok) {
      return { analysis: { ...empty, hasWebsite: true, summary: "サイトアクセス不可" }, html: null };
    }

    const html = await res.text();
    const lower = html.toLowerCase();

    const hasYouTube =
      lower.includes("youtube.com/embed") ||
      lower.includes("youtube.com/watch") ||
      lower.includes("youtu.be/");
    const hasVideo = hasYouTube || lower.includes("<video") || lower.includes("vimeo.com");

    const snsPatterns: [string, RegExp][] = [
      ["Instagram", /instagram\.com\/[a-zA-Z0-9_.]+/],
      ["Twitter/X", /(?:twitter\.com|x\.com)\/[a-zA-Z0-9_]+/],
      ["Facebook", /facebook\.com\/[a-zA-Z0-9_.]+/],
      ["TikTok", /tiktok\.com\/@[a-zA-Z0-9_.]+/],
      ["LINE", /line\.me\//],
    ];
    const hasSns = snsPatterns.filter(([, re]) => re.test(lower)).map(([name]) => name);

    const hasViewport = lower.includes('name="viewport"') || lower.includes("name='viewport'");
    const hasModernFramework =
      lower.includes("next") || lower.includes("nuxt") || lower.includes("react") || lower.includes("vue") || lower.includes("__next");
    const siteAge: WebAnalysis["siteAge"] = hasModernFramework ? "modern" : hasViewport ? "modern" : "outdated";

    const hasRecruitPage =
      lower.includes("recruit") || lower.includes("career") || lower.includes("採用") || lower.includes("求人");

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
        hasYoutube: hasYouTube,
        hasSns,
        siteAge,
        hasRecruitPage,
        summary: parts.join(" / "),
      },
      html,
    };
  } catch {
    return { analysis: { ...empty, hasWebsite: true, summary: "サイト取得タイムアウト" }, html: null };
  }
}

// ----------------------------------------------------------------
// YouTubeチャンネル検索
// ----------------------------------------------------------------
interface YouTubeInfo {
  url: string;
  subscribers: number;
  videoCount: number;
}

async function searchYouTubeChannel(companyName: string, apiKey: string): Promise<YouTubeInfo | null> {
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
    statsUrl.searchParams.set("part", "statistics");
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
    };
  } catch {
    return null;
  }
}

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
    Promise.all(body.places.map((p) => analyzeWebsite(p.websiteUrl))),
    youtubeApiKey
      ? Promise.all(body.places.map((p) => searchYouTubeChannel(p.name, youtubeApiKey)))
      : Promise.resolve(body.places.map(() => null)),
  ]);
  const analyses = websiteResults.map((r) => r.analysis);

  const SYSTEM_PROMPT = `あなたはAd Arch株式会社の加盟促進AIアドバイザーです。
企業リストを受け取り、Ad Archグループへの加盟候補としての適性をスコアリングしてください。

【Ad Archグループについて】
- OOH広告（屋外広告・デジタルサイネージ・タクシー広告等）と映像制作を主力とする広告会社グループ
- 全国に加盟パートナー26社を展開中、さらに20拠点の拡大を目指している
- 加盟条件: 加盟金50万円+税、ロイヤリティ月額5万円（初月から）
- 加盟メリット: 本部からのOOH媒体提供、制作ツール、営業支援AI、グループ連携

【スコアリング基準（合計100点）】
1. 地域ポテンシャル（20点）: 既存パートナーとの重複がないか、人口規模、広告市場の大きさ
2. 営業力ポテンシャル（25点）: 業種（映像制作・広告代理店は高得点）、法人営業経験の推定、既存クライアント基盤
3. 事業規模（15点）: 従業員数の推定、設立年数の推定、安定した事業基盤があるか
4. デジタル活用度（15点）: Web/SNS/YouTube活用状況。活用している=デジタルリテラシーが高い=Ad ArchのOSを使いこなせる
5. 独立動機の推定（15点）: 業種のトレンド（印刷業の縮小傾向、Web制作の競争激化等）、新規事業への意欲がありそうか
6. 相性（10点）: Ad Archグループのモデル（広告媒体営業+制作）との親和性

【重要ルール】
- 必ずJSON配列のみで返答（前置きや後書き一切不要）
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

上記の企業リストをAd Archグループ加盟候補としてスコアリングしてください。JSON配列のみで返答してください。`;

  try {
    const client = new Anthropic({ apiKey });
    const response = await client.messages.create({
      model: "claude-sonnet-4-6",
      max_tokens: 4096,
      system: [
        { type: "text", text: SYSTEM_PROMPT, cache_control: { type: "ephemeral" } },
      ],
      messages: [{ role: "user", content: userMessage }],
    });

    const text = response.content[0].type === "text" ? response.content[0].text : "";

    const jsonMatch = text.match(/\[[\s\S]*\]/);
    if (!jsonMatch) {
      return NextResponse.json({ error: "AIレスポンスのパースに失敗しました" }, { status: 500 });
    }

    const scores = JSON.parse(jsonMatch[0]);

    const analysisMap: Record<string, WebAnalysis> = {};
    const youtubeMap: Record<string, YouTubeInfo | null> = {};
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
