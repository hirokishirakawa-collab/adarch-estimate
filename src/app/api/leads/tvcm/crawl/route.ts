import Anthropic from "@anthropic-ai/sdk";
import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { validateBody, tvcmCrawlSchema } from "@/lib/validations";
import { checkRateLimit, TVCM_RATE_LIMIT } from "@/lib/rate-limit";
import {
  TVCM_SEARCH_KEYWORDS,
  detectMajorAgency,
  isTokyo,
  type TvcmLeadCandidate,
  type TvcmLeadResult,
} from "@/lib/constants/tvcm-leads";
import {
  fetchPrTimesByKeyword,
  fetchPrTimesArticle,
  type PrTimesListItem,
} from "@/lib/leads/tvcm-prtimes";

export const runtime = "nodejs";
export const maxDuration = 300;

const EXTRACT_TOOL = [
  {
    name: "extract_tvcm_lead" as const,
    description:
      "プレスリリース本文から、TVCM/動画PRに関する企業情報を構造化抽出する。",
    input_schema: {
      type: "object" as const,
      properties: {
        isVideoAnnouncement: {
          type: "boolean",
          description:
            "このプレスリリースが『新CM・動画コンテンツの公開・発表』に関するものか。違う場合はfalse。",
        },
        companyName: { type: "string", description: "発表企業の正式名称" },
        companyWebsite: {
          type: "string",
          description: "発表企業の公式サイトURL（不明なら空文字）",
        },
        prefecture: {
          type: "string",
          description: "本社所在地の都道府県（例: 大阪府）。不明なら空文字。",
        },
        address: {
          type: "string",
          description: "本社所在地の住所（市区町村まで分かれば含める）。不明なら空文字。",
        },
        videoUrl: {
          type: "string",
          description:
            "CM/動画のURL（YouTube/Vimeo/自社特設等）。本文または埋め込みから読み取る。不明なら空文字。",
        },
        productionCompany: {
          type: "string",
          description:
            "制作会社・クリエイティブ担当・撮影会社など、プレスリリースに記載されたクレジット。不明なら空文字。",
        },
        agencyDetected: {
          type: "string",
          description:
            "プレスリリースで言及されている広告代理店名（電通・博報堂・ADK 等）。検出されなければ空文字。",
        },
        isListed: {
          type: "boolean",
          description: "発表企業が上場企業か。証券コードや『株式会社（XXX）』表記、東証プライム等で判断。",
        },
        capital: {
          type: "number",
          description: "資本金（円。不明なら0）",
        },
        employeeCount: {
          type: "number",
          description: "従業員数（不明なら0）",
        },
        industryGuess: {
          type: "string",
          description: "業種推定（例: 食品メーカー、地方銀行、ホテル、製造業 等）。不明なら空文字。",
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
PR TIMES から取得したプレスリリース本文を受け取り、対象企業情報を構造化抽出してください。

【目的】
- 中小企業・地方企業が、CMや動画コンテンツを自社で発表した案件を見つける
- 大手代理店（電通・博報堂 等）が噛んでいる案件は除外したい
- 上場企業は除外したい（既にエージェンシー関係を持つ可能性が高い）
- 「自社でWeb CM作ったが、TVには流していない企業」が最高の営業対象

【抽出ルール】
- isVideoAnnouncement: 本文がCM・ブランドムービー・PR動画・コンセプトムービー等の公開発表に該当する場合のみ true。
  人材募集動画・採用動画のみの場合も true で構わない。商品発表メイン（動画は付帯）の場合は false。
- companyName: 必ず発表元企業（プレスリリースの発信元）を抽出。共同発表の場合は主催側を抽出。
- prefecture / address: 本社所在地が記載されていればそれ。記載なければ空文字。
- videoUrl: 本文中のリンクや埋め込みから動画URLを最優先で抽出（YouTube > Vimeo > 自社サイト）。
- productionCompany: 「制作:」「Production:」「クリエイティブディレクター:」等のクレジット記載を抽出。
- agencyDetected: 大手代理店名が本文中に出てきたらその名前。なければ空文字。
- isListed: 「東証プライム」「証券コード」「上場」等の記載があればtrue。

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

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.email) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // レート制限: 1ユーザー 1分1回 / 1日3回
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

  const keywords = body.keywords?.length
    ? body.keywords
    : Array.from(TVCM_SEARCH_KEYWORDS).slice(0, 6);

  // 1) 各キーワードから記事URLリストを並列取得
  const listings = await Promise.all(
    keywords.map((kw) => fetchPrTimesByKeyword(kw, body.maxPerKeyword)),
  );

  const collected: PrTimesListItem[] = [];
  const seen = new Set<string>();
  for (const list of listings) {
    for (const item of list) {
      if (seen.has(item.url)) continue;
      seen.add(item.url);
      collected.push(item);
    }
  }

  if (collected.length === 0) {
    return NextResponse.json({
      candidates: [],
      results: [],
      stats: { fetched: 0, extracted: 0, kept: 0, excluded: 0 },
      message: "PR TIMES からプレスリリースを取得できませんでした",
    });
  }

  const targets = collected.slice(0, body.totalLimit);

  // 2) 各記事本文を並列フェッチ + AI抽出
  const client = new Anthropic({ apiKey });

  async function extractOne(item: PrTimesListItem): Promise<TvcmLeadResult | null> {
    const article = await fetchPrTimesArticle(item.url);
    if (!article) return null;

    const localAgency = detectMajorAgency(article.bodyText);
    const videoHint =
      article.videoEmbeds.length > 0
        ? `\n【検出された動画URL候補】${article.videoEmbeds.join(", ")}`
        : "";

    const userMessage = `【記事タイトル】${item.title}
【記事URL】${item.url}
【OGタイトル】${article.ogTitle ?? "（なし）"}
【OG説明】${article.ogDescription ?? "（なし）"}
${videoHint}
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
        announcedDate: null, // 詳細日付の正確抽出は次イテレーション
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

      // フィルタ
      let excluded = false;
      let reason: string | null = null;
      if (candidate.agencyDetected) {
        excluded = true;
        reason = `大手代理店検出: ${candidate.agencyDetected}`;
      } else if (candidate.isListed) {
        excluded = true;
        reason = "上場企業のため除外";
      } else if (isTokyo(candidate.prefecture, candidate.address)) {
        excluded = true;
        reason = "東京本社のため除外";
      }

      return { ...candidate, excluded, exclusionReason: reason };
    } catch (err) {
      console.error("TVCM extract error:", item.url, err);
      return null;
    }
  }

  // 同時実行数を抑える（5並列）
  const CONCURRENCY = 5;
  const results: TvcmLeadResult[] = [];
  for (let i = 0; i < targets.length; i += CONCURRENCY) {
    const slice = targets.slice(i, i + CONCURRENCY);
    const batch = await Promise.all(slice.map(extractOne));
    for (const r of batch) {
      if (r) results.push(r);
    }
  }

  const kept = results.filter((r) => !r.excluded);
  const excluded = results.filter((r) => r.excluded);

  return NextResponse.json({
    candidates: kept, // フィルタ通過した候補（営業対象）
    results, // 全結果（除外含む、デバッグ用）
    stats: {
      fetched: collected.length,
      extracted: results.length,
      kept: kept.length,
      excluded: excluded.length,
    },
  });
}
