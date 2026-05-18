import Anthropic from "@anthropic-ai/sdk";
import { db } from "@/lib/db";
import {
  TVCM_SEARCH_KEYWORDS,
  detectMajorAgency,
  isTargetIndustry,
  isExcludedArea,
  type TvcmLeadCandidate,
  type TvcmLeadResult,
} from "@/lib/constants/tvcm-leads";
import {
  fetchPrTimesByKeyword,
  fetchPrTimesArticle,
} from "@/lib/leads/tvcm-prtimes";
import {
  fetchAtPressByKeyword,
  fetchAtPressArticle,
} from "@/lib/leads/tvcm-atpress";
import {
  searchTvcmVideos,
  type YouTubeVideoCandidate,
} from "@/lib/leads/tvcm-youtube";

export interface TvcmCrawlOptions {
  // "both" は YouTube + PR TIMES（後方互換、@Press 含まず）
  // "all"  は YouTube + PR TIMES + @Press
  source: "youtube" | "prtimes" | "atpress" | "both" | "all";
  keywords?: string[];
  maxPerKeyword: number;
  totalLimit: number;
  maxSubscribers: number;
  publishedWithinDays: number;
  /**
   * 過去 N 日以内に判断（プール/却下/架電/アポ/受注）されたリードを
   * 結果から除外する。DB の auto-save は引き続き行う（後で履歴画面から見直せる）。
   * 0 を渡すと除外しない。default は呼び出し側で指定。
   */
  hideRecentlyDecidedDays?: number;
}

export interface TvcmCrawlOutcome {
  candidates: TvcmLeadResult[]; // 警告除外後（実質的に全件 — applyFilters は自動除外しない）
  results: TvcmLeadResult[]; // 全件（hidden を除く）
  stats: {
    fetched: number;
    extracted: number;
    kept: number;
    excluded: number;
    newlyCreated: number;
    updated: number;
    hidden: number; // 直近に判断済みで結果から除外した件数
    // 切り分け用: 各ソースが「生記事を何件拾えたか」（AI判定前）
    youtubeRaw: number;
    prTimesRaw: number;
    atPressRaw: number;
  };
}

// 「判断済み」とみなす LeadLog の action
const DECIDED_LOG_ACTIONS = [
  "POOLED",
  "REJECTED",
  "CLAIMED",
  "ASSIGNED",
  "STATUS_CHANGED",
  "CONVERTED",
] as const;

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
            "営業候補として残すかの判定。緩めに true。事業者・法人・店舗・団体・自治体が発信元で、動画コンテンツに何らかの形で紐づいていれば true。false は明確にノイズなものだけ: 個人Vlog・MV単体・ゲーム実況・タレント個人名チャンネル・第三者YouTuberの解説動画・新聞/TV局/ニュース媒体の報道動画・動画が一切紐付かないテキストのみの記事。判断に迷ったら true。",
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
PR TIMES / @Press プレスリリースまたは YouTube 動画情報を受け取り、対象企業情報を構造化抽出してください。

【最重要 — 配布モデルの考え方】
このシステムは「代表＋グループ加盟者が候補を見て判断」する設計です。
あなたは**ゲートキーパーではなく仕分け担当**。営業対象になる可能性が少しでもあれば true にして候補に残してください。
大手代理店絡み・上場企業・業種ターゲット外・大都市圏は、別途警告バッジで表示されるため、あなたは弾かなくて構いません。

【isVideoAnnouncement 判定 — 緩めに、ノイズ除去のみ】
true にする基準（次の2点を両方満たすなら true）:
1. 発信元が「事業者・法人・店舗・団体・自治体」である（個人ではない）
2. 動画コンテンツに何らかの形で紐づいている（自社公開・出演・紹介・活用、メイン主題か脇かは問わない）

false にする基準（明確に営業対象外のものだけ）:
- 個人投稿の Vlog / MV 単体 / ゲーム実況 / ペット動画 等の純粋な個人発信
- タレント名・芸能人名・YouTuber名の個人名チャンネル
- 第三者（YouTuber・レビュアー・解説者）による企業/商品の評論動画
- 新聞社・テレビ局・ニュースメディアのチャンネルが報道として出している動画
- 動画コンテンツが一切紐付いていない記事（純粋な資料DL・ウェビナー告知・テキストのみ）

【判断に迷ったら true】
- 「動画公開がメイン主題ではないが、新サービス発表と一緒に動画も公開」→ true
- 「製品紹介ページに動画が埋め込まれている発表」→ true
- 「採用情報の一環として動画も用意」→ true
- 「自治体・観光協会のPR動画」→ true（個人ではないので）
- 「上場企業のグローバルブランディング動画」→ true（警告バッジで判別する）

【companyName】
- 発信元の企業・団体名を抽出
- YouTubeなら原則チャンネル名から判断
- タレント名・個人名チャンネルだけは false（isVideoAnnouncement=false）

【他フィールド】
- prefecture / address: 本社・拠点の所在地。チャンネル概要欄や本文から推定。不明なら空文字でOK
- videoUrl: 動画のURL。記事に動画リンクがあれば優先
- productionCompany: クレジット表記から抽出（不明なら空文字）
- agencyDetected: 大手代理店名（電通・博報堂等）が出てきたらその名前（無ければ空文字）
- isListed: 上場企業を示す表記（証券コード・東証プライム・(東1)等）があれば true
- industryGuess: 業種推定（飲食・建設・製造・観光 等）。不明なら空文字

【summary】
- 1〜2文。営業担当が即判断できる内容に
- 「何を作って公開した会社か」「TVer営業の切り口（地域限定配信が刺さる、等）」を含める
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
  // 全ての要警戒条件は警告バッジ付きで表示する。
  const warnings: string[] = [];
  if (c.agencyDetected) warnings.push(`⚠️大手代理店: ${c.agencyDetected}`);
  if (c.isListed) warnings.push("⚠️上場企業");
  if (!isTargetIndustry(c.industryGuess)) warnings.push("⚠️業種ターゲット外");
  if (isExcludedArea(c.prefecture, c.address)) warnings.push("⚠️大都市圏（東京/大阪/名古屋）");
  return {
    ...c,
    excluded: false,
    exclusionReason: warnings.length > 0 ? warnings.join(" / ") : null,
  };
}

/**
 * TVCM/動画PRリードのクロール本体。
 * - source: youtube / prtimes / both
 * - DBに「CRAWLED」ステータスで自動保存
 * - 既存リードは TVCM 関連フィールドを更新（statusは保持）
 *
 * context.userId が null の場合は createdById=null（cron 用途）
 */
export async function runTvcmCrawl(
  options: TvcmCrawlOptions,
  context: { userId: string | null; staffName: string },
): Promise<TvcmCrawlOutcome> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    throw new Error("ANTHROPIC_API_KEY が設定されていません");
  }

  const youtubeApiKey = process.env.YOUTUBE_API_KEY;
  const wantsYoutube =
    options.source === "youtube" ||
    options.source === "both" ||
    options.source === "all";
  const wantsPrTimes =
    options.source === "prtimes" ||
    options.source === "both" ||
    options.source === "all";
  const wantsAtPress =
    options.source === "atpress" || options.source === "all";

  if (options.source === "youtube" && !youtubeApiKey) {
    throw new Error(
      "YOUTUBE_API_KEY が未設定です。Railway の環境変数に追加してください（Google Cloud Console > APIキー）。",
    );
  }

  const keywords = options.keywords?.length
    ? options.keywords
    : Array.from(TVCM_SEARCH_KEYWORDS).slice(0, 12);
  const client = new Anthropic({ apiKey });

  // 切り分け診断: 各ソースの「生記事数」（AI判定前）を記録
  let youtubeRaw = 0;
  let prTimesRaw = 0;
  let atPressRaw = 0;

  async function collectFromYouTube(): Promise<TvcmLeadResult[]> {
    if (!youtubeApiKey) {
      console.error("YOUTUBE_API_KEY 未設定 → YouTube ソースをスキップ");
      return [];
    }

    const publishedAfter = new Date();
    publishedAfter.setDate(publishedAfter.getDate() - options.publishedWithinDays);

    const searches = await Promise.all(
      keywords.map((kw) =>
        searchTvcmVideos(youtubeApiKey, {
          query: kw,
          publishedAfter: publishedAfter.toISOString(),
          maxResults: options.maxPerKeyword,
          maxSubscribers: options.maxSubscribers,
        }),
      ),
    );

    const videoMap = new Map<string, YouTubeVideoCandidate>();
    const seenChannels = new Set<string>();
    for (const list of searches) {
      for (const v of list) {
        if (seenChannels.has(v.channelId)) continue;
        if (videoMap.has(v.videoId)) continue;
        videoMap.set(v.videoId, v);
        seenChannels.add(v.channelId);
      }
    }
    const videos = Array.from(videoMap.values()).slice(0, options.totalLimit);
    youtubeRaw = videos.length;
    console.log(`[tvcm-crawler] YouTube raw: ${youtubeRaw} videos (after dedupe + sub filter)`);
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

  async function collectFromPrTimes(): Promise<TvcmLeadResult[]> {
    const listings = await Promise.all(
      keywords.map((kw) => fetchPrTimesByKeyword(kw, options.maxPerKeyword)),
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
    prTimesRaw = collected.length;
    console.log(`[tvcm-crawler] PR TIMES raw: ${prTimesRaw} articles (${keywords.length} keywords)`);
    if (collected.length === 0) return [];

    const targets = collected.slice(0, options.totalLimit);

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

  async function collectFromAtPress(): Promise<TvcmLeadResult[]> {
    const listings = await Promise.all(
      keywords.map((kw) => fetchAtPressByKeyword(kw, options.maxPerKeyword)),
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
    atPressRaw = collected.length;
    console.log(`[tvcm-crawler] @Press raw: ${atPressRaw} articles (${keywords.length} keywords)`);
    if (collected.length === 0) return [];

    const targets = collected.slice(0, options.totalLimit);

    async function extractAtPress(
      item: { url: string; title: string },
    ): Promise<TvcmLeadResult | null> {
      const article = await fetchAtPressArticle(item.url);
      if (!article) return null;
      const localAgency = detectMajorAgency(article.bodyText);
      const videoHint =
        article.videoEmbeds.length > 0
          ? `\n【検出された動画URL候補】${article.videoEmbeds.join(", ")}`
          : "";

      const userMessage = `【ソース】@Press
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
        console.error("@Press extract error:", item.url, err);
        return null;
      }
    }

    const CONCURRENCY = 5;
    const out: TvcmLeadResult[] = [];
    for (let i = 0; i < targets.length; i += CONCURRENCY) {
      const slice = targets.slice(i, i + CONCURRENCY);
      const batch = await Promise.all(slice.map(extractAtPress));
      for (const r of batch) if (r) out.push(r);
    }
    return out;
  }

  const tasks: Promise<TvcmLeadResult[]>[] = [];
  if (wantsYoutube) tasks.push(collectFromYouTube());
  if (wantsPrTimes) tasks.push(collectFromPrTimes());
  if (wantsAtPress) tasks.push(collectFromAtPress());

  const allResults = (await Promise.all(tasks)).flat();

  // 同一企業名の重複排除
  const dedupedMap = new Map<string, TvcmLeadResult>();
  for (const r of allResults) {
    const key = r.companyName;
    if (!dedupedMap.has(key)) dedupedMap.set(key, r);
  }
  const results = Array.from(dedupedMap.values());

  // DB自動保存
  let newlyCreated = 0;
  let updated = 0;
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
        updated++;
      } else {
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
            createdById: context.userId,
            assigneeId: null,
          },
        });
        await db.leadLog.create({
          data: {
            leadId: created.id,
            action: "CRAWLED",
            detail: `TVCM/動画PR 自動保存（${r.prefecture ?? "地域不明"}・${r.industryGuess ?? "業種不明"}）`,
            staffName: context.staffName,
          },
        });
        r.leadId = created.id;
        r.currentStatus = "CRAWLED";
        r.currentAssigneeName = null;
        newlyCreated++;
      }
    } catch (err) {
      console.error("[tvcm-crawler] auto-save error for", r.companyName, err);
    }
  }

  // 直近 N 日以内に判断済み（POOLED/REJECTED/CLAIMED/ASSIGNED/STATUS_CHANGED/CONVERTED）の
  // リードは結果から除外する。DB 更新は既に行われているため、履歴画面からは見える。
  const hideDays = options.hideRecentlyDecidedDays ?? 0;
  let visibleResults: TvcmLeadResult[] = results;
  let hidden = 0;

  if (hideDays > 0) {
    const leadIds = results
      .map((r) => r.leadId)
      .filter((id): id is string => !!id);

    if (leadIds.length > 0) {
      const cutoff = new Date();
      cutoff.setDate(cutoff.getDate() - hideDays);
      const recentLogs = await db.leadLog.findMany({
        where: {
          leadId: { in: leadIds },
          action: { in: [...DECIDED_LOG_ACTIONS] },
          createdAt: { gte: cutoff },
        },
        select: { leadId: true },
      });
      const recentlyDecidedSet = new Set(recentLogs.map((l) => l.leadId));

      visibleResults = results.filter(
        (r) => !r.leadId || !recentlyDecidedSet.has(r.leadId),
      );
      hidden = results.length - visibleResults.length;
    }
  }

  const kept = visibleResults.filter((r) => !r.excluded);
  const excluded = visibleResults.filter((r) => r.excluded);

  return {
    candidates: kept,
    results: visibleResults,
    stats: {
      fetched: allResults.length,
      extracted: results.length,
      kept: kept.length,
      excluded: excluded.length,
      newlyCreated,
      updated,
      hidden,
      youtubeRaw,
      prTimesRaw,
      atPressRaw,
    },
  };
}
