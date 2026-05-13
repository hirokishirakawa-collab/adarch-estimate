import Anthropic from "@anthropic-ai/sdk";
import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { validateBody, tvcmCrawlSchema } from "@/lib/validations";
import { checkRateLimit, TVCM_RATE_LIMIT } from "@/lib/rate-limit";
import {
  TVCM_SEARCH_KEYWORDS,
  detectMajorAgency,
  type TvcmLeadCandidate,
  type TvcmLeadResult,
} from "@/lib/constants/tvcm-leads";
import {
  fetchPrTimesByKeyword,
  fetchPrTimesArticle,
} from "@/lib/leads/tvcm-prtimes";
import {
  searchTvcmVideos,
  type YouTubeVideoCandidate,
} from "@/lib/leads/tvcm-youtube";

export const runtime = "nodejs";
export const maxDuration = 300;

const EXTRACT_TOOL = [
  {
    name: "extract_tvcm_lead" as const,
    description:
      "プレスリリースまたはYouTube動画の情報から、TVCM/動画PRに関する企業情報を構造化抽出する。",
    input_schema: {
      type: "object" as const,
      properties: {
        isVideoAnnouncement: {
          type: "boolean",
          description:
            "対象が『企業による新CM・ブランドムービー・PR動画・コンセプトムービー等の公開発表』に該当するか。広告・宣伝目的の動画コンテンツである場合のみ true。個人投稿・MV単体・ニュース報道などは false。",
        },
        companyName: {
          type: "string",
          description: "発表元の企業名。チャンネル名やプレスリリースの発信元から抽出。",
        },
        companyWebsite: {
          type: "string",
          description: "公式サイトURL（不明なら空文字）",
        },
        prefecture: {
          type: "string",
          description:
            "本社所在地の都道府県（例: 大阪府）。チャンネル概要や本文から推定。不明なら空文字。",
        },
        address: {
          type: "string",
          description: "市区町村レベルの所在地。不明なら空文字。",
        },
        videoUrl: {
          type: "string",
          description: "CM/動画のURL。なければ空文字。",
        },
        productionCompany: {
          type: "string",
          description:
            "制作会社・クリエイティブ担当などのクレジット記載。動画概要欄・本文の『制作:』『Production:』等から抽出。不明なら空文字。",
        },
        agencyDetected: {
          type: "string",
          description:
            "大手代理店名（電通・博報堂・ADK・サイバーエージェント等）が言及されていればその名前。なければ空文字。",
        },
        isListed: {
          type: "boolean",
          description:
            "発表企業が上場企業か。証券コード・東証プライム・(東1)等の記載で判断。",
        },
        capital: { type: "number", description: "資本金（円。不明なら0）" },
        employeeCount: { type: "number", description: "従業員数（不明なら0）" },
        industryGuess: {
          type: "string",
          description: "業種推定。不明なら空文字。",
        },
        summary: {
          type: "string",
          description:
            "営業担当が読む想定の1〜2文サマリー。『どんな動画を発表した会社か』『TVer営業の切り口』を含める。",
        },
      },
      required: [
        "isVideoAnnouncement",
        "companyName",
        "companyWebsite",
        "prefecture",
        "address",
        "videoUrl",
        "productionCompany",
        "agencyDetected",
        "isListed",
        "capital",
        "employeeCount",
        "industryGuess",
        "summary",
      ],
    },
  },
];

const SYSTEM_PROMPT = `あなたはアドアーチグループのTVer広告営業を支援するアシスタントです。
PR TIMES プレスリリースまたは YouTube 動画情報を受け取り、対象企業情報を構造化抽出してください。

【目的】
- 中小企業・地方企業が、CMや動画コンテンツを自社で発表した案件を見つける
- 大手代理店（電通・博報堂 等）が噛んでいる案件は除外したい
- 上場企業は除外したい
- 「自社で動画作ったが、TVには流していない地方中小企業」が最高の営業対象

【抽出ルール】
- isVideoAnnouncement: 本文または動画情報が『企業による広告・宣伝目的の動画コンテンツ公開』に該当する場合のみ true。
  ・採用動画・ブランドムービー・新商品CM等は true
  ・個人投稿のVlog・MV・ニュース報道・ゲーム実況・解説動画は false
  ・チャンネル名から明らかに企業の公式チャンネルではないものは false（個人名/タレント名チャンネル等）
- companyName: 必ず発表元の企業を抽出。YouTubeなら原則チャンネル名から判断。タレント名チャンネルや個人名なら false にする。
- prefecture / address: 本社所在地。チャンネル概要欄や本文から推定。
- videoUrl: 動画のURL。
- productionCompany: クレジット表記から抽出。
- agencyDetected: 大手代理店名が出てきたらその名前。
- isListed: 上場企業を示す表記があればtrue。

【summary の書き方】
- 1〜2文。営業担当が即判断できる内容に。
- 例: 「青森の地酒メーカーがブランドムービー公開。地元クリエイター制作、TV未放映。地域限定TVerが刺さる」`;

interface ExtractedRaw {
  isVideoAnnouncement: boolean;
  companyName: string;
  companyWebsite: string;
  prefecture: string;
  address: string;
  videoUrl: string;
  productionCompany: string;
  agencyDetected: string;
  isListed: boolean;
  capital: number;
  employeeCount: number;
  industryGuess: string;
  summary: string;
}

function emptyToNull(s: string): string | null {
  const trimmed = s?.trim() ?? "";
  return trimmed === "" ? null : trimmed;
}

function numToNullable(n: number): number | null {
  return !n || n <= 0 ? null : n;
}

function applyFilters(c: TvcmLeadCandidate): TvcmLeadResult {
  // 配布モデルでは代表が全候補を見て判断するため、自動除外しない。
  // 大手代理店検出・上場企業はメインリストに警告バッジ付きで表示する。
  const warnings: string[] = [];
  if (c.agencyDetected) warnings.push(`⚠️大手代理店: ${c.agencyDetected}`);
  if (c.isListed) warnings.push("⚠️上場企業");
  return {
    ...c,
    excluded: false,
    exclusionReason: warnings.length > 0 ? warnings.join(" / ") : null,
  };
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.email) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // 配布モデル: クロールは ADMIN（代表）のみ
  const user = await db.user.findUnique({
    where: { email: session.user.email },
    select: { id: true, role: true },
  });
  if (user?.role !== "ADMIN") {
    return NextResponse.json(
      { error: "クロール機能は管理者専用です" },
      { status: 403 },
    );
  }

  const limited = checkRateLimit(
    session.user.email,
    "leads/tvcm/crawl",
    TVCM_RATE_LIMIT,
  );
  if (limited) return limited;

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return NextResponse.json(
      { error: "ANTHROPIC_API_KEY が設定されていません" },
      { status: 500 },
    );
  }

  const parsed = await validateBody(req, tvcmCrawlSchema);
  if (!parsed.success) return parsed.response;
  const body = parsed.data;

  // YouTube ソースが指定されているが API キーが無い場合は明示エラー
  if ((body.source === "youtube" || body.source === "both") && !process.env.YOUTUBE_API_KEY) {
    if (body.source === "youtube") {
      return NextResponse.json(
        {
          error:
            "YOUTUBE_API_KEY が未設定です。Railway の環境変数に追加してください（Google Cloud Console > APIキー）。",
        },
        { status: 500 },
      );
    }
    // both の場合は警告のみで PR TIMES だけ実行
    console.warn("YOUTUBE_API_KEY 未設定 → YouTube ソースをスキップして PR TIMES のみで実行");
  }

  const keywords = body.keywords?.length
    ? body.keywords
    : Array.from(TVCM_SEARCH_KEYWORDS).slice(0, 4);
  const client = new Anthropic({ apiKey });

  // ----------------------------------------------------------------
  // YouTube 抽出
  // ----------------------------------------------------------------
  async function collectFromYouTube(): Promise<TvcmLeadResult[]> {
    const youtubeApiKey = process.env.YOUTUBE_API_KEY;
    if (!youtubeApiKey) {
      console.error("YOUTUBE_API_KEY 未設定 → YouTube ソースをスキップ");
      return [];
    }

    const publishedAfter = new Date();
    publishedAfter.setDate(publishedAfter.getDate() - body.publishedWithinDays);

    const searches = await Promise.all(
      keywords.map((kw) =>
        searchTvcmVideos(youtubeApiKey, {
          query: kw,
          publishedAfter: publishedAfter.toISOString(),
          maxResults: body.maxPerKeyword,
          maxSubscribers: body.maxSubscribers,
        }),
      ),
    );

    // ユニークな動画を集約（channel単位でも重複排除）
    const videoMap = new Map<string, YouTubeVideoCandidate>();
    const seenChannels = new Set<string>();
    for (const list of searches) {
      for (const v of list) {
        if (seenChannels.has(v.channelId)) continue; // 同一チャンネル1動画に絞る
        if (videoMap.has(v.videoId)) continue;
        videoMap.set(v.videoId, v);
        seenChannels.add(v.channelId);
      }
    }
    const videos = Array.from(videoMap.values()).slice(0, body.totalLimit);
    if (videos.length === 0) return [];

    async function extractVideo(v: YouTubeVideoCandidate): Promise<TvcmLeadResult | null> {
      const haystack = `${v.title}\n${v.description}\n${v.channelTitle}\n${v.channelDescription}`;
      const localAgency = detectMajorAgency(haystack);

      const userMessage = `【ソース】YouTube
【動画タイトル】${v.title}
【動画URL】${v.videoUrl}
【動画概要（先頭5000字）】
${v.description.slice(0, 5000)}

【チャンネル名】${v.channelTitle}
【チャンネル登録者数】${v.channelSubscribers.toLocaleString()} 人
【チャンネル動画数】${v.channelVideoCount}
【チャンネル概要（先頭3000字）】
${v.channelDescription.slice(0, 3000)}

【公開日】${v.publishedAt}`;

      try {
        const response = await client.messages.create({
          model: "claude-sonnet-4-6",
          max_tokens: 1500,
          system: [
            { type: "text", text: SYSTEM_PROMPT, cache_control: { type: "ephemeral" } },
          ],
          messages: [{ role: "user", content: userMessage }],
          tools: EXTRACT_TOOL,
          tool_choice: { type: "tool", name: "extract_tvcm_lead" },
        });
        const toolBlock = response.content.find(
          (b): b is Anthropic.Messages.ToolUseBlock => b.type === "tool_use",
        );
        if (!toolBlock) return null;
        const raw = toolBlock.input as ExtractedRaw;
        if (!raw.isVideoAnnouncement) return null;
        if (!raw.companyName?.trim()) return null;

        const candidate: TvcmLeadCandidate = {
          pressReleaseUrl: v.videoUrl,
          pressReleaseTitle: v.title,
          announcedDate: v.publishedAt ? new Date(v.publishedAt).toISOString() : null,
          companyName: raw.companyName.trim(),
          companyWebsite: emptyToNull(raw.companyWebsite),
          prefecture: emptyToNull(raw.prefecture),
          address: emptyToNull(raw.address),
          videoUrl: v.videoUrl,
          productionCompany: emptyToNull(raw.productionCompany),
          agencyDetected: emptyToNull(raw.agencyDetected) ?? localAgency,
          isListed: !!raw.isListed,
          capital: numToNullable(raw.capital),
          employeeCount: numToNullable(raw.employeeCount),
          industryGuess: emptyToNull(raw.industryGuess),
          summary: raw.summary?.trim() ?? "",
        };
        return applyFilters(candidate);
      } catch (err) {
        console.error("YouTube extract error:", v.videoUrl, err);
        return null;
      }
    }

    const CONCURRENCY = 5;
    const out: TvcmLeadResult[] = [];
    for (let i = 0; i < videos.length; i += CONCURRENCY) {
      const slice = videos.slice(i, i + CONCURRENCY);
      const batch = await Promise.all(slice.map(extractVideo));
      for (const r of batch) if (r) out.push(r);
    }
    return out;
  }

  // ----------------------------------------------------------------
  // PR TIMES 抽出
  // ----------------------------------------------------------------
  async function collectFromPrTimes(): Promise<TvcmLeadResult[]> {
    const listings = await Promise.all(
      keywords.map((kw) => fetchPrTimesByKeyword(kw, body.maxPerKeyword)),
    );
    const collected: { url: string; title: string }[] = [];
    const seen = new Set<string>();
    for (const list of listings) {
      for (const item of list) {
        if (seen.has(item.url)) continue;
        seen.add(item.url);
        collected.push(item);
      }
    }
    if (collected.length === 0) return [];

    const targets = collected.slice(0, body.totalLimit);

    async function extractPr(
      item: { url: string; title: string },
    ): Promise<TvcmLeadResult | null> {
      const article = await fetchPrTimesArticle(item.url);
      if (!article) return null;
      const localAgency = detectMajorAgency(article.bodyText);
      const videoHint =
        article.videoEmbeds.length > 0
          ? `\n【検出された動画URL候補】${article.videoEmbeds.join(", ")}`
          : "";

      const userMessage = `【ソース】PR TIMES
【記事タイトル】${item.title}
【記事URL】${item.url}
【OGタイトル】${article.ogTitle ?? "（なし）"}
【OG説明】${article.ogDescription ?? "（なし）"}${videoHint}
【本文（先頭9000字）】
${article.bodyText}`;

      try {
        const response = await client.messages.create({
          model: "claude-sonnet-4-6",
          max_tokens: 1500,
          system: [
            { type: "text", text: SYSTEM_PROMPT, cache_control: { type: "ephemeral" } },
          ],
          messages: [{ role: "user", content: userMessage }],
          tools: EXTRACT_TOOL,
          tool_choice: { type: "tool", name: "extract_tvcm_lead" },
        });
        const toolBlock = response.content.find(
          (b): b is Anthropic.Messages.ToolUseBlock => b.type === "tool_use",
        );
        if (!toolBlock) return null;
        const raw = toolBlock.input as ExtractedRaw;
        if (!raw.isVideoAnnouncement) return null;
        if (!raw.companyName?.trim()) return null;

        const candidate: TvcmLeadCandidate = {
          pressReleaseUrl: item.url,
          pressReleaseTitle: item.title,
          announcedDate: null,
          companyName: raw.companyName.trim(),
          companyWebsite: emptyToNull(raw.companyWebsite),
          prefecture: emptyToNull(raw.prefecture),
          address: emptyToNull(raw.address),
          videoUrl: emptyToNull(raw.videoUrl) ?? article.videoEmbeds[0] ?? null,
          productionCompany: emptyToNull(raw.productionCompany),
          agencyDetected: emptyToNull(raw.agencyDetected) ?? localAgency,
          isListed: !!raw.isListed,
          capital: numToNullable(raw.capital),
          employeeCount: numToNullable(raw.employeeCount),
          industryGuess: emptyToNull(raw.industryGuess),
          summary: raw.summary?.trim() ?? "",
        };
        return applyFilters(candidate);
      } catch (err) {
        console.error("TVCM extract error:", item.url, err);
        return null;
      }
    }

    const CONCURRENCY = 5;
    const out: TvcmLeadResult[] = [];
    for (let i = 0; i < targets.length; i += CONCURRENCY) {
      const slice = targets.slice(i, i + CONCURRENCY);
      const batch = await Promise.all(slice.map(extractPr));
      for (const r of batch) if (r) out.push(r);
    }
    return out;
  }

  // ----------------------------------------------------------------
  // ソース別実行
  // ----------------------------------------------------------------
  const tasks: Promise<TvcmLeadResult[]>[] = [];
  if (body.source === "youtube" || body.source === "both") {
    tasks.push(collectFromYouTube());
  }
  if (body.source === "prtimes" || body.source === "both") {
    tasks.push(collectFromPrTimes());
  }

  const allResults = (await Promise.all(tasks)).flat();

  // 同一企業名の重複排除（最初に出現したものを残す）
  const dedupedMap = new Map<string, TvcmLeadResult>();
  for (const r of allResults) {
    const key = r.companyName;
    if (!dedupedMap.has(key)) dedupedMap.set(key, r);
  }
  const results = Array.from(dedupedMap.values());

  // 全候補を「クロール済」として自動保存（データ保全）
  // 既存リードのstatusは保持（CRAWLED → UNTOUCHED → SKIPPED 等の上書きを防ぐ）
  for (const r of results) {
    const address = r.address ?? "";
    try {
      const existing = await db.lead.findUnique({
        where: { name_address: { name: r.companyName, address } },
        select: {
          id: true,
          status: true,
          assignee: { select: { name: true, email: true } },
        },
      });

      if (existing) {
        // 既存: TVCM関連の最新情報のみ更新、statusは維持
        await db.lead.update({
          where: { id: existing.id },
          data: {
            source: "PR_TIMES_TVCM",
            pressReleaseUrl: r.pressReleaseUrl,
            pressReleaseTitle: r.pressReleaseTitle,
            videoUrl: r.videoUrl,
            productionCompany: r.productionCompany,
            announcedDate: r.announcedDate ? new Date(r.announcedDate) : null,
            prefecture: r.prefecture,
            agencyDetected: r.agencyDetected,
            isListed: r.isListed,
            capital: r.capital !== null ? BigInt(r.capital) : null,
            employeeCount: r.employeeCount,
            industry: r.industryGuess,
            area: r.prefecture,
            scoreComment: r.summary,
            websiteUrl: r.companyWebsite,
          },
        });
        r.leadId = existing.id;
        r.currentStatus = existing.status;
        r.currentAssigneeName =
          existing.assignee?.name ?? existing.assignee?.email ?? null;
      } else {
        // 新規: CRAWLED で作成
        const created = await db.lead.create({
          data: {
            name: r.companyName,
            address: address || null,
            websiteUrl: r.companyWebsite,
            industry: r.industryGuess,
            area: r.prefecture,
            source: "PR_TIMES_TVCM",
            status: "CRAWLED",
            scoreComment: r.summary,
            capital: r.capital !== null ? BigInt(r.capital) : null,
            employeeCount: r.employeeCount,
            pressReleaseUrl: r.pressReleaseUrl,
            pressReleaseTitle: r.pressReleaseTitle,
            videoUrl: r.videoUrl,
            productionCompany: r.productionCompany,
            announcedDate: r.announcedDate ? new Date(r.announcedDate) : null,
            prefecture: r.prefecture,
            agencyDetected: r.agencyDetected,
            isListed: r.isListed,
            createdById: user.id,
            assigneeId: null,
          },
        });
        await db.leadLog.create({
          data: {
            leadId: created.id,
            action: "CRAWLED",
            detail: `TVCM/動画PR 自動保存（${r.prefecture ?? "地域不明"}・${r.industryGuess ?? "業種不明"}）`,
            staffName: session.user.name ?? session.user.email ?? "ADMIN",
          },
        });
        r.leadId = created.id;
        r.currentStatus = "CRAWLED";
        r.currentAssigneeName = null;
      }
    } catch (err) {
      console.error("[tvcm/crawl] auto-save error for", r.companyName, err);
    }
  }

  const kept = results.filter((r) => !r.excluded);
  const excluded = results.filter((r) => r.excluded);

  return NextResponse.json({
    candidates: kept,
    results,
    stats: {
      fetched: allResults.length,
      extracted: results.length,
      kept: kept.length,
      excluded: excluded.length,
    },
  });
}
