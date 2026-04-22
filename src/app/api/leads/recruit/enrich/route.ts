import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { checkRateLimit, AI_RATE_LIMIT } from "@/lib/rate-limit";
import type {
  WebsiteAnalysis,
  YouTubeChannelInfo,
  RecruitmentAnalysis,
  RecruitType,
} from "@/lib/constants/leads";

export const runtime = "nodejs";
export const maxDuration = 120;

// ----------------------------------------------------------------
// 中途 / 新卒 判定キーワード
// ----------------------------------------------------------------
const MIDCAREER_KEYWORDS = [
  "中途採用", "キャリア採用", "経験者採用", "即戦力", "転職",
  "mid-career", "career", "experienced",
  "中途", "社会人採用", "経験者歓迎", "ブランクOK",
];
const NEWGRAD_KEYWORDS = [
  "新卒採用", "新卒", "卒業見込", "エントリー", "会社説明会",
  "インターン", "インターンシップ", "25卒", "26卒", "27卒",
  "新卒者", "学生", "fresh graduate", "new graduate",
  "マイナビ2", "リクナビ2",
];

// ----------------------------------------------------------------
// 採用ページ関連リンクの検出パターン
// ----------------------------------------------------------------
const RECRUIT_LINK_PATTERNS = [
  /href=["']([^"']*(?:recruit|career|saiyou|hiring|jobs|採用)[^"']*)["']/gi,
];

// ----------------------------------------------------------------
// 求人プラットフォーム検出
// ----------------------------------------------------------------
const PLATFORM_PATTERNS: [string, RegExp][] = [
  ["Indeed", /indeed\.com|indeed\.jp/i],
  ["マイナビ", /mynavi\.jp/i],
  ["リクナビ", /rikunabi\.com/i],
  ["エン転職", /employment\.en-japan/i],
  ["doda", /doda\.jp/i],
  ["Wantedly", /wantedly\.com/i],
  ["Green", /green-japan\.com/i],
  ["求人ボックス", /xn--pckua2a7gp15o\.jp|求人ボックス/i],
  ["タウンワーク", /townwork\.net/i],
  ["バイトル", /baitoru\.com/i],
  ["ハローワーク", /hellowork|ハローワーク/i],
  ["engage", /engage\.en-japan/i],
];

// ----------------------------------------------------------------
// 急募シグナル
// ----------------------------------------------------------------
const URGENCY_PATTERNS = [
  "急募", "積極採用", "増員", "大量募集", "オープニング",
  "即日勤務", "即日スタート", "欠員補充", "人員拡大",
];

// ----------------------------------------------------------------
// Website 基本分析（BtoB enrich と同等）
// ----------------------------------------------------------------
async function analyzeWebsiteSimple(url: string): Promise<{ analysis: WebsiteAnalysis; html: string | null }> {
  const empty: WebsiteAnalysis = {
    hasWebsite: false,
    hasVideo: false,
    hasYouTube: false,
    hasSns: [],
    siteAge: "unknown",
    hasRecruitPage: false,
    businessType: "independent",
    businessTypeReason: "",
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
    const hasVideo =
      hasYouTube ||
      lower.includes("<video") ||
      lower.includes("vimeo.com") ||
      lower.includes("tiktok.com/embed");

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

    const hasViewport = lower.includes('name="viewport"') || lower.includes("name='viewport'");
    const hasModernFramework =
      lower.includes("next") || lower.includes("nuxt") ||
      lower.includes("react") || lower.includes("vue") || lower.includes("__next");
    const siteAge: WebsiteAnalysis["siteAge"] =
      hasModernFramework ? "modern" : hasViewport ? "modern" : "outdated";

    const hasRecruitPage =
      lower.includes("recruit") || lower.includes("career") ||
      lower.includes("採用") || lower.includes("求人");

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
        businessType: "independent",
        businessTypeReason: "",
        summary: parts.join(" / "),
      },
      html,
    };
  } catch {
    return { analysis: { ...empty, hasWebsite: true, summary: "サイト取得タイムアウト" }, html: null };
  }
}

// ----------------------------------------------------------------
// 採用ページの深堀り分析（中途/新卒判定含む）
// ----------------------------------------------------------------
async function analyzeRecruitPage(
  baseUrl: string,
  mainHtml: string | null,
): Promise<RecruitmentAnalysis> {
  const empty: RecruitmentAnalysis = {
    recruitPageUrl: null,
    recruitType: "unknown",
    recruitTypeSignals: [],
    jobCount: 0,
    jobTypes: [],
    hasRecruitVideo: false,
    hasRecruitSns: [],
    usesRecruitPlatform: [],
    urgencySignals: [],
    summary: "採用ページなし",
  };

  if (!mainHtml) return empty;

  const mainLower = mainHtml.toLowerCase();

  // 1) メインページから採用ページへのリンクを探す
  let recruitUrl: string | null = null;
  for (const pattern of RECRUIT_LINK_PATTERNS) {
    pattern.lastIndex = 0;
    const match = pattern.exec(mainHtml);
    if (match?.[1]) {
      try {
        recruitUrl = new URL(match[1], baseUrl).href;
      } catch {
        // invalid URL
      }
      break;
    }
  }

  // 採用ページをフェッチ（見つかった場合）
  let recruitHtml: string | null = null;
  if (recruitUrl) {
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 8000);
      const res = await fetch(recruitUrl, {
        signal: controller.signal,
        headers: {
          "User-Agent": "Mozilla/5.0 (compatible; AdArchBot/1.0; +https://adarch.co.jp)",
          Accept: "text/html",
        },
        redirect: "follow",
      });
      clearTimeout(timeout);
      if (res.ok) {
        recruitHtml = await res.text();
      }
    } catch {
      // タイムアウト等
    }
  }

  // 分析対象のHTML（採用ページが取れなければメインページをフォールバック）
  const targetHtml = recruitHtml ?? mainHtml;
  const lower = targetHtml.toLowerCase();

  // 2) 中途 / 新卒 判定
  const midcareerHits = MIDCAREER_KEYWORDS.filter((kw) => lower.includes(kw.toLowerCase()));
  const newgradHits = NEWGRAD_KEYWORDS.filter((kw) => lower.includes(kw.toLowerCase()));

  let recruitType: RecruitType = "unknown";
  const signals: string[] = [];

  if (midcareerHits.length > 0 && newgradHits.length > 0) {
    recruitType = "both";
    signals.push(`中途: ${midcareerHits.slice(0, 3).join(",")}`);
    signals.push(`新卒: ${newgradHits.slice(0, 3).join(",")}`);
  } else if (midcareerHits.length > 0) {
    recruitType = "midcareer";
    signals.push(`中途: ${midcareerHits.slice(0, 3).join(",")}`);
  } else if (newgradHits.length > 0) {
    recruitType = "newgrad";
    signals.push(`新卒: ${newgradHits.slice(0, 3).join(",")}`);
  }

  // メインページにも「採用」が見つからなければ採用ページなし
  if (!mainLower.includes("採用") && !mainLower.includes("recruit") &&
      !mainLower.includes("求人") && !mainLower.includes("career")) {
    return empty;
  }

  // 3) 求人職種の検出（簡易: dt/li要素内の職種名パターン）
  const jobTypePatterns = [
    "営業", "事務", "エンジニア", "デザイナー", "ドライバー", "看護師",
    "介護士", "調理師", "販売スタッフ", "施工管理", "現場監督",
    "店長", "マネージャー", "受付", "経理", "総務", "人事",
    "コンサルタント", "プランナー", "ディレクター", "Webデザイナー",
    "フロントエンド", "バックエンド", "インフラ", "保育士", "教員",
    "薬剤師", "理学療法士", "作業療法士", "管理栄養士", "美容師",
  ];
  const foundJobTypes = jobTypePatterns.filter((jt) => lower.includes(jt.toLowerCase()));

  // 職種数は最低でも見つかった数、もしくはリスト構造から推定
  const listItemMatches = lower.match(/<li[^>]*>.*?(?:募集|職種|ポジション)/gi);
  const jobCount = Math.max(foundJobTypes.length, listItemMatches?.length ?? 0);

  // 4) 動画の有無
  const hasRecruitVideo =
    lower.includes("youtube.com/embed") ||
    lower.includes("youtube.com/watch") ||
    lower.includes("youtu.be/") ||
    lower.includes("<video");

  // 5) 採用SNS検出
  const snsPatterns: [string, RegExp][] = [
    ["Instagram", /instagram\.com\/[a-zA-Z0-9_.]+/],
    ["Twitter/X", /(?:twitter\.com|x\.com)\/[a-zA-Z0-9_]+/],
    ["TikTok", /tiktok\.com\/@[a-zA-Z0-9_.]+/],
    ["LINE", /line\.me\//],
  ];
  const hasRecruitSns = snsPatterns
    .filter(([, re]) => re.test(lower))
    .map(([name]) => name);

  // 6) 求人プラットフォーム検出
  const usesRecruitPlatform = PLATFORM_PATTERNS
    .filter(([, re]) => re.test(targetHtml))
    .map(([name]) => name);

  // 7) 急募シグナル
  const urgencySignals = URGENCY_PATTERNS.filter((s) => lower.includes(s));

  // 8) サマリー生成
  const summaryParts: string[] = [];
  const typeLabel = recruitType === "both" ? "中途+新卒"
    : recruitType === "midcareer" ? "中途採用中心"
    : recruitType === "newgrad" ? "新卒採用中心"
    : "採用タイプ不明";
  summaryParts.push(typeLabel);

  if (jobCount > 0) summaryParts.push(`${jobCount}職種`);
  if (hasRecruitVideo) summaryParts.push("採用動画あり");
  else summaryParts.push("採用動画なし");
  if (hasRecruitSns.length > 0) summaryParts.push(`採用SNS: ${hasRecruitSns.join(",")}`);
  if (usesRecruitPlatform.length > 0) summaryParts.push(`求人サイト: ${usesRecruitPlatform.join(",")}`);
  if (urgencySignals.length > 0) summaryParts.push(`急募シグナル: ${urgencySignals.join(",")}`);

  return {
    recruitPageUrl: recruitUrl,
    recruitType,
    recruitTypeSignals: signals,
    jobCount,
    jobTypes: foundJobTypes.slice(0, 10),
    hasRecruitVideo,
    hasRecruitSns,
    usesRecruitPlatform,
    urgencySignals,
    summary: summaryParts.join(" / "),
  };
}

// ----------------------------------------------------------------
// YouTube チャンネル検索
// ----------------------------------------------------------------
async function searchYouTubeChannel(
  companyName: string,
  apiKey: string,
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
// POST /api/leads/recruit/enrich
// ----------------------------------------------------------------
export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const limited = checkRateLimit(session.user.email!, "leads/recruit/enrich", AI_RATE_LIMIT);
  if (limited) return limited;

  const youtubeApiKey = process.env.YOUTUBE_API_KEY;

  const body = await req.json();
  const companies: Array<{ name: string; websiteUrl?: string }> = body.companies ?? [];

  if (companies.length === 0) {
    return NextResponse.json({ error: "企業リストが空です" }, { status: 400 });
  }

  const results = await Promise.all(
    companies.map(async (company) => {
      const [websiteResult, youtubeChannel] = await Promise.all([
        analyzeWebsiteSimple(company.websiteUrl ?? ""),
        youtubeApiKey
          ? searchYouTubeChannel(company.name, youtubeApiKey)
          : Promise.resolve(null),
      ]);

      // 採用ページ深堀り分析
      const recruitAnalysis = await analyzeRecruitPage(
        company.websiteUrl ?? "",
        websiteResult.html,
      );

      return {
        name: company.name,
        websiteAnalysis: websiteResult.analysis,
        youtubeChannel,
        recruitAnalysis,
      };
    }),
  );

  const enrichmentMap: Record<
    string,
    {
      websiteAnalysis: WebsiteAnalysis;
      youtubeChannel: YouTubeChannelInfo | null;
      recruitAnalysis: RecruitmentAnalysis;
    }
  > = {};
  for (const r of results) {
    enrichmentMap[r.name] = {
      websiteAnalysis: r.websiteAnalysis,
      youtubeChannel: r.youtubeChannel,
      recruitAnalysis: r.recruitAnalysis,
    };
  }

  return NextResponse.json({ enrichments: enrichmentMap });
}
