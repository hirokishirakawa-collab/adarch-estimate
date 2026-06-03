// ---------------------------------------------------------------
// YouTube Data API v3 を使った TVCM/動画PR 候補検索
// ---------------------------------------------------------------

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/**
 * YouTube が 429（レート/クォータ上限）を返し、リトライしても回復しなかったときに投げる。
 * 呼び出し側はこれを捕捉して「YouTube はレート制限中」と判断し、残りのキーワード検索を中断する。
 */
export const YOUTUBE_RATE_LIMITED = "YOUTUBE_RATE_LIMITED";

export interface YouTubeVideoCandidate {
  videoId: string;
  videoUrl: string;
  title: string;
  description: string;
  channelId: string;
  channelTitle: string;
  channelDescription: string;
  channelSubscribers: number;
  channelVideoCount: number;
  publishedAt: string; // ISO 8601
}

interface SearchOptions {
  query: string;
  publishedAfter?: string; // ISO 8601 — 例: "2026-04-13T00:00:00Z"
  maxResults?: number; // 1-50
  /** チャンネル登録者数の上限。これより多いチャンネルは除外（中小判定用）。0=制限なし */
  maxSubscribers?: number;
}

interface YouTubeSearchItem {
  id?: { videoId?: string };
  snippet?: {
    title?: string;
    description?: string;
    channelId?: string;
    channelTitle?: string;
    publishedAt?: string;
  };
}

interface YouTubeChannelItem {
  id: string;
  snippet?: { title?: string; description?: string };
  statistics?: { subscriberCount?: string; videoCount?: string };
}

/**
 * YouTube 動画検索（地域=日本、言語=日本語、新着順）。
 * 検索後、ユニークなチャンネル情報を一括取得し、登録者数で中小フィルタを適用する。
 *
 * APIコスト目安:
 *  - search.list = 100ユニット
 *  - channels.list = 1ユニット
 *  → 1キーワード検索につき約101ユニット消費（10000ユニット/日無料枠で約99回可能）
 */
export async function searchTvcmVideos(
  apiKey: string,
  options: SearchOptions,
): Promise<YouTubeVideoCandidate[]> {
  const {
    query,
    publishedAfter,
    maxResults = 25,
    maxSubscribers = 50000,
  } = options;

  // 1) 動画検索
  const searchUrl = new URL("https://www.googleapis.com/youtube/v3/search");
  searchUrl.searchParams.set("part", "snippet");
  searchUrl.searchParams.set("type", "video");
  searchUrl.searchParams.set("q", query);
  searchUrl.searchParams.set("regionCode", "JP");
  searchUrl.searchParams.set("relevanceLanguage", "ja");
  searchUrl.searchParams.set("maxResults", String(Math.min(50, maxResults)));
  searchUrl.searchParams.set("order", "date");
  if (publishedAfter) {
    searchUrl.searchParams.set("publishedAfter", publishedAfter);
  }
  searchUrl.searchParams.set("key", apiKey);

  // 429（レート/クォータ上限）は指数バックオフでリトライし、それでも続くなら
  // 専用エラーを投げて呼び出し側に伝える（残りのキーワード検索を中断させ、無駄打ちを防ぐ）。
  const MAX_RETRIES = 2;
  let searchData: { items?: YouTubeSearchItem[] };
  for (let attempt = 0; ; attempt++) {
    const searchRes = await fetch(searchUrl.toString());
    if (searchRes.ok) {
      searchData = (await searchRes.json()) as { items?: YouTubeSearchItem[] };
      break;
    }
    const status = searchRes.status;
    const body = await searchRes.text();
    const rateLimited =
      status === 429 ||
      (status === 403 && /quota|rateLimit|userRateLimit/i.test(body));
    if (rateLimited) {
      if (attempt < MAX_RETRIES) {
        await sleep(1000 * 2 ** attempt); // 1s, 2s
        continue;
      }
      console.error("YouTube search.list rate limited:", status, body.slice(0, 200));
      throw new Error(YOUTUBE_RATE_LIMITED);
    }
    console.error("YouTube search.list failed:", status, body.slice(0, 200));
    return [];
  }
  const items = searchData.items ?? [];
  if (items.length === 0) return [];

  // 2) ユニークなチャンネルIDを集めてバッチ取得
  const channelIds = Array.from(
    new Set(
      items
        .map((i) => i.snippet?.channelId)
        .filter((v): v is string => !!v),
    ),
  );
  if (channelIds.length === 0) return [];

  // channels.list は id を50個までカンマ区切りで一括取得可能
  const channelMap = new Map<string, YouTubeChannelItem>();
  for (let i = 0; i < channelIds.length; i += 50) {
    const batch = channelIds.slice(i, i + 50);
    const channelsUrl = new URL("https://www.googleapis.com/youtube/v3/channels");
    channelsUrl.searchParams.set("part", "snippet,statistics");
    channelsUrl.searchParams.set("id", batch.join(","));
    channelsUrl.searchParams.set("key", apiKey);

    const channelsRes = await fetch(channelsUrl.toString());
    if (!channelsRes.ok) {
      console.error("YouTube channels.list failed:", channelsRes.status);
      continue;
    }
    const channelsData = (await channelsRes.json()) as {
      items?: YouTubeChannelItem[];
    };
    for (const ch of channelsData.items ?? []) {
      channelMap.set(ch.id, ch);
    }
  }

  // 3) 動画 + チャンネル情報を統合し、登録者数フィルタを適用
  const result: YouTubeVideoCandidate[] = [];
  for (const item of items) {
    const videoId = item.id?.videoId;
    const channelId = item.snippet?.channelId;
    if (!videoId || !channelId) continue;

    const channel = channelMap.get(channelId);
    if (!channel) continue;

    const subscribers = Number(channel.statistics?.subscriberCount ?? 0);
    if (maxSubscribers > 0 && subscribers > maxSubscribers) continue;

    result.push({
      videoId,
      videoUrl: `https://www.youtube.com/watch?v=${videoId}`,
      title: item.snippet?.title ?? "",
      description: item.snippet?.description ?? "",
      channelId,
      channelTitle: channel.snippet?.title ?? "",
      channelDescription: channel.snippet?.description ?? "",
      channelSubscribers: subscribers,
      channelVideoCount: Number(channel.statistics?.videoCount ?? 0),
      publishedAt: item.snippet?.publishedAt ?? "",
    });
  }

  return result;
}
