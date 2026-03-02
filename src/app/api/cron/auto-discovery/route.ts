export const runtime = "nodejs";
export const maxDuration = 300;

import { NextRequest, NextResponse } from "next/server";
import * as cheerio from "cheerio";
import Anthropic from "@anthropic-ai/sdk";
import { db } from "@/lib/db";
import { DISCOVERY_KEYWORDS } from "@/lib/constants/video-achievements";

const GOOGLE_API_KEY = process.env.GOOGLE_API_KEY ?? "";
const GOOGLE_CSE_ID  = process.env.GOOGLE_CSE_ID ?? "";
const CRON_SECRET    = process.env.CRON_SECRET ?? "";

// ---------------------------------------------------------------
// GET /api/cron/auto-discovery
// Headers: Authorization: Bearer {CRON_SECRET}
// Query:   ?region=横浜市 (default: 神奈川県)
// ---------------------------------------------------------------
export async function GET(req: NextRequest) {
  // 認証
  const auth = req.headers.get("authorization") ?? "";
  if (!CRON_SECRET || auth !== `Bearer ${CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const region = req.nextUrl.searchParams.get("region") ?? "神奈川県";

  // Stage 1: Google Custom Search で競合サイトURLを収集
  const urls = await discoverCompetitorUrls(region);

  let sitesSearched   = 0;
  let achievementsFound = 0;
  let newlySaved      = 0;
  let skipped         = 0;

  for (const url of urls) {
    sitesSearched++;

    // Stage 2: Works ページを特定
    const worksUrl = await findWorksPage(url);
    if (!worksUrl) continue;

    // Stage 3: HTML を取得して AI で構造化
    let html: string;
    try {
      const res = await fetch(worksUrl, {
        headers: { "User-Agent": "Mozilla/5.0 (compatible; AdArchBot/1.0)" },
        signal: AbortSignal.timeout(10_000),
      });
      if (!res.ok) continue;
      html = await res.text();
    } catch {
      continue;
    }

    const productionCompany = extractCompanyName(html, url);
    const achievements = await extractAchievements(html, productionCompany, worksUrl);
    achievementsFound += achievements.length;

    // Stage 4: 地域フィルタリング + DB 保存
    for (const a of achievements) {
      if (!isPrefectureInRegion(a.prefecture, region)) {
        skipped++;
        continue;
      }
      try {
        const result = await db.videoAchievement.upsert({
          where: {
            companyName_productionCompany: {
              companyName:       a.clientName,
              productionCompany: productionCompany,
            },
          },
          update: {
            contentSummary: a.description ?? null,
            referenceUrl:   a.referenceUrl ?? null,
          },
          create: {
            companyName:       a.clientName,
            prefecture:        a.prefecture,
            industry:          a.industry,
            productionCompany: productionCompany,
            videoType:         a.videoType,
            referenceUrl:      a.referenceUrl ?? null,
            contentSummary:    a.description ?? null,
            sourceUrl:         worksUrl,
          },
        });
        if (result.createdAt.getTime() === result.updatedAt.getTime()) {
          newlySaved++;
        } else {
          skipped++;
        }
      } catch {
        skipped++;
      }
    }
  }

  return NextResponse.json({
    region,
    sitesSearched,
    achievementsFound,
    newlySaved,
    skipped,
  });
}

// ---------------------------------------------------------------
// Stage 1: Google Custom Search でURL収集
// ---------------------------------------------------------------
async function discoverCompetitorUrls(region: string): Promise<string[]> {
  if (!GOOGLE_API_KEY || !GOOGLE_CSE_ID) return [];

  const urls = new Set<string>();

  for (const keyword of DISCOVERY_KEYWORDS) {
    const q = encodeURIComponent(`${region} ${keyword}`);
    try {
      const res = await fetch(
        `https://www.googleapis.com/customsearch/v1?q=${q}&key=${GOOGLE_API_KEY}&cx=${GOOGLE_CSE_ID}&num=10`,
        { signal: AbortSignal.timeout(8_000) }
      );
      if (!res.ok) continue;
      const data = await res.json() as { items?: Array<{ link: string }> };
      for (const item of data.items ?? []) {
        try {
          const u = new URL(item.link);
          urls.add(`${u.protocol}//${u.host}`);
        } catch {
          // invalid URL
        }
      }
    } catch {
      // fetch error
    }
  }

  return [...urls];
}

// ---------------------------------------------------------------
// Stage 2: Works ページ特定
// ---------------------------------------------------------------
async function findWorksPage(baseUrl: string): Promise<string | null> {
  const candidates = [
    "/works", "/case", "/cases", "/portfolio",
    "/実績", "/制作事例", "/achievement",
  ];

  for (const path of candidates) {
    const url = baseUrl + path;
    try {
      const res = await fetch(url, {
        method: "HEAD",
        headers: { "User-Agent": "Mozilla/5.0 (compatible; AdArchBot/1.0)" },
        signal: AbortSignal.timeout(5_000),
      });
      if (res.ok) return url;
    } catch {
      // try next
    }
  }
  return null;
}

// ---------------------------------------------------------------
// Stage 3: HTML → Claude AI → 構造化 JSON
// ---------------------------------------------------------------
interface AchievementItem {
  clientName:   string;
  prefecture:   string;
  industry:     string;
  videoType:    string;
  description:  string | null;
  referenceUrl: string | null;
}

async function extractAchievements(
  html: string,
  productionCompany: string,
  sourceUrl: string
): Promise<AchievementItem[]> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return [];

  // テキスト抽出（cheerio）
  const $ = cheerio.load(html);
  $("script, style, nav, footer, header").remove();
  const text = $("body").text().replace(/\s+/g, " ").slice(0, 8000);

  const client = new Anthropic({ apiKey });

  const prompt = `【システム】
あなたは映像制作会社のWebサイトから「クライアント実績」を抽出する専門AIです。

【ルール】
1. 入力テキストから映像制作の「クライアント」情報のみを抽出する
2. 制作会社自身の宣材や採用情報は除外する
3. クライアント名が不明な場合はそのケースをスキップする（null にしない）
4. 業種は以下から選ぶ: 食品・飲料 / 小売・EC / 不動産 / 建設・工事 / 医療・介護 / 教育 / 製造業 / IT・テクノロジー / 飲食店 / 美容・サロン / 観光・ホテル / 金融・保険 / 人材・採用 / 自動車 / アパレル / その他
5. videoTypeは: TVCM / WEB_VIDEO / RECRUITMENT / EXHIBITION / SNS / CORPORATE / OTHER のいずれか
6. prefecture は「〇〇都/道/府/県」形式。記載がない・不明の場合は「不明」
7. 出力は配列のJSONのみ。前置き・後書き・Markdownコードブロック不要

【出力形式】
[
  {
    "clientName": "クライアント企業名（例: 株式会社山田食品）",
    "prefecture": "神奈川県",
    "industry": "食品・飲料",
    "videoType": "WEB_VIDEO",
    "description": "採用強化のためのWEB動画を制作。工場見学シーンを中心に社員インタビューを組み込み...",
    "referenceUrl": null
  }
]

【制作会社】${productionCompany}
【参照URL】${sourceUrl}

【入力テキスト】
${text}`;

  try {
    const message = await client.messages.create({
      model:      "claude-haiku-4-5-20251001",
      max_tokens: 2048,
      messages:   [{ role: "user", content: prompt }],
    });

    const content = message.content[0];
    if (content.type !== "text") return [];

    const parsed = JSON.parse(content.text) as AchievementItem[];
    return Array.isArray(parsed) ? parsed.filter((a) => a.clientName) : [];
  } catch {
    return [];
  }
}

// ---------------------------------------------------------------
// ヘルパー: ページタイトルから制作会社名を抽出
// ---------------------------------------------------------------
function extractCompanyName(html: string, baseUrl: string): string {
  const $ = cheerio.load(html);
  const title = $("title").first().text().trim();
  if (title) return title.split(/[|\-–—]/)[0].trim().slice(0, 50);
  try {
    return new URL(baseUrl).hostname.replace(/^www\./, "");
  } catch {
    return baseUrl;
  }
}

// ---------------------------------------------------------------
// ヘルパー: 都道府県がターゲット地域に含まれるか
// ---------------------------------------------------------------
function isPrefectureInRegion(prefecture: string, region: string): boolean {
  if (prefecture === "不明") return false;
  return prefecture.includes(region) || region.includes(prefecture.replace(/[都道府県]$/, ""));
}
