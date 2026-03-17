import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { checkRateLimit, AI_RATE_LIMIT } from "@/lib/rate-limit";
import type { WebsiteAnalysis, YouTubeChannelInfo } from "@/lib/constants/leads";

export const runtime = "nodejs";
export const maxDuration = 120;

// ---- Website analysis (simplified, same logic as score route) ----
async function analyzeWebsiteSimple(url: string): Promise<WebsiteAnalysis> {
  const empty: WebsiteAnalysis = {
    hasWebsite: false,
    hasVideo: false,
    hasYouTube: false,
    hasSns: [],
    siteAge: "unknown",
    hasRecruitPage: false,
    businessType: "independent",
    businessTypeReason: "BtoB企業",
    summary: "Webサイトなし",
  };

  if (!url) return empty;

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
      return { ...empty, hasWebsite: true, summary: "サイトアクセス不可" };
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
      hasWebsite: true,
      hasVideo,
      hasYouTube,
      hasSns,
      siteAge,
      hasRecruitPage,
      businessType: "independent",
      businessTypeReason: "BtoB企業",
      summary: parts.join(" / "),
    };
  } catch {
    return { ...empty, hasWebsite: true, summary: "サイト取得タイムアウト" };
  }
}

// ---- YouTube channel search ----
async function searchYouTubeChannel(
  companyName: string,
  apiKey: string
): Promise<YouTubeChannelInfo | null> {
  try {
    // Search for channel
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

    // Get channel statistics
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

// ---- POST /api/leads/btob/enrich ----
export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const limited = checkRateLimit(session.user.email!, "leads/btob/enrich", AI_RATE_LIMIT);
  if (limited) return limited;

  const youtubeApiKey = process.env.YOUTUBE_API_KEY;

  const body = await req.json();
  const companies: Array<{ name: string; websiteUrl?: string }> = body.companies ?? [];

  if (companies.length === 0) {
    return NextResponse.json({ error: "企業リストが空です" }, { status: 400 });
  }

  // Parallel enrichment
  const results = await Promise.all(
    companies.map(async (company) => {
      const [websiteAnalysis, youtubeChannel] = await Promise.all([
        analyzeWebsiteSimple(company.websiteUrl ?? ""),
        youtubeApiKey
          ? searchYouTubeChannel(company.name, youtubeApiKey)
          : Promise.resolve(null),
      ]);
      return {
        name: company.name,
        websiteAnalysis,
        youtubeChannel,
      };
    })
  );

  const enrichmentMap: Record<string, { websiteAnalysis: WebsiteAnalysis; youtubeChannel: YouTubeChannelInfo | null }> = {};
  for (const r of results) {
    enrichmentMap[r.name] = {
      websiteAnalysis: r.websiteAnalysis,
      youtubeChannel: r.youtubeChannel,
    };
  }

  return NextResponse.json({ enrichments: enrichmentMap });
}
