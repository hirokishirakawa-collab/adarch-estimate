// ---------------------------------------------------------------
// YouTubeチャンネル検索ユーティリティ（共有モジュール）
// ---------------------------------------------------------------

import type { YouTubeChannelInfo } from "@/lib/constants/leads";

// ----------------------------------------------------------------
// キャッシュ（インメモリ / 24時間TTL）
// ----------------------------------------------------------------

const cache = new Map<
  string,
  { result: YouTubeChannelInfo | null; expiresAt: number }
>();
const CACHE_TTL = 24 * 60 * 60 * 1000; // 24 hours

/** NFKC正規化してキャッシュキーを生成 */
function normalizeName(name: string): string {
  return name.normalize("NFKC").trim().toLowerCase();
}

function getCached(key: string): YouTubeChannelInfo | null | undefined {
  const entry = cache.get(key);
  if (!entry) return undefined; // キャッシュミス
  if (Date.now() > entry.expiresAt) {
    cache.delete(key);
    return undefined; // 期限切れ
  }
  return entry.result; // null（チャンネルなし）も有効なキャッシュ結果
}

function setCache(key: string, result: YouTubeChannelInfo | null): void {
  cache.set(key, { result, expiresAt: Date.now() + CACHE_TTL });
}

// ----------------------------------------------------------------
// チャンネルタイトル一致バリデーション
// ----------------------------------------------------------------

/**
 * チャンネルタイトルが企業名の一部を含んでいるか検証する。
 * NFKC正規化した上で比較。企業名を2文字以上の連続部分に分割し、
 * いずれかがチャンネルタイトルに含まれていれば一致とみなす。
 */
function isChannelRelevant(channelTitle: string, companyName: string): boolean {
  const normalizedTitle = normalizeName(channelTitle);
  const normalizedCompany = normalizeName(companyName);

  // 完全一致
  if (normalizedTitle.includes(normalizedCompany)) return true;
  if (normalizedCompany.includes(normalizedTitle)) return true;

  // 企業名をスペース区切りで分割し、各パートが2文字以上なら部分一致チェック
  const parts = normalizedCompany.split(/[\s　]+/).filter((p) => p.length >= 2);
  if (parts.length > 0) {
    return parts.some((part) => normalizedTitle.includes(part));
  }

  // スペースなしの場合、先頭から半分以上の文字列で部分一致チェック
  const halfLen = Math.max(2, Math.floor(normalizedCompany.length / 2));
  const prefix = normalizedCompany.slice(0, halfLen);
  return normalizedTitle.includes(prefix);
}

// ----------------------------------------------------------------
// YouTubeチャンネル検索
// ----------------------------------------------------------------

/**
 * 企業名でYouTubeチャンネルを検索し、チャンネル情報を返す。
 *
 * チャンネルが見つかった場合、チャンネルタイトルと企業名の関連性を
 * バリデーションし、無関係なチャンネルの誤マッチを防ぐ。
 *
 * @param companyName - 検索する企業名
 * @param apiKey      - YouTube Data API v3 のAPIキー
 * @returns チャンネル情報、見つからない場合は null
 */
export async function searchYouTubeChannel(
  companyName: string,
  apiKey: string,
): Promise<YouTubeChannelInfo | null> {
  const cacheKey = normalizeName(companyName);

  // キャッシュチェック
  const cached = getCached(cacheKey);
  if (cached !== undefined) {
    return cached;
  }

  try {
    // 1) チャンネル検索
    const searchUrl = new URL("https://www.googleapis.com/youtube/v3/search");
    searchUrl.searchParams.set("part", "snippet");
    searchUrl.searchParams.set("type", "channel");
    searchUrl.searchParams.set("q", companyName);
    searchUrl.searchParams.set("maxResults", "1");
    searchUrl.searchParams.set("key", apiKey);

    const searchRes = await fetch(searchUrl.toString());
    if (!searchRes.ok) {
      setCache(cacheKey, null);
      return null;
    }

    const searchData = await searchRes.json();
    const items = searchData.items ?? [];
    if (items.length === 0) {
      setCache(cacheKey, null);
      return null;
    }

    const channelId = items[0].snippet?.channelId ?? items[0].id?.channelId;
    if (!channelId) {
      setCache(cacheKey, null);
      return null;
    }

    // 2) チャンネルタイトルの関連性バリデーション
    const channelTitle: string = items[0].snippet?.channelTitle ?? items[0].snippet?.title ?? "";
    if (channelTitle && !isChannelRelevant(channelTitle, companyName)) {
      // チャンネルタイトルが企業名と無関係 → 誤マッチとして破棄
      setCache(cacheKey, null);
      return null;
    }

    // 3) チャンネル統計情報を取得
    const statsUrl = new URL("https://www.googleapis.com/youtube/v3/channels");
    statsUrl.searchParams.set("part", "statistics,contentDetails,snippet");
    statsUrl.searchParams.set("id", channelId);
    statsUrl.searchParams.set("key", apiKey);

    const statsRes = await fetch(statsUrl.toString());
    if (!statsRes.ok) {
      setCache(cacheKey, null);
      return null;
    }

    const statsData = await statsRes.json();
    const channel = statsData.items?.[0];
    if (!channel) {
      setCache(cacheKey, null);
      return null;
    }

    const result: YouTubeChannelInfo = {
      url: `https://www.youtube.com/channel/${channelId}`,
      subscribers: Number(channel.statistics?.subscriberCount ?? 0),
      videoCount: Number(channel.statistics?.videoCount ?? 0),
      lastUpload: channel.snippet?.publishedAt,
    };

    setCache(cacheKey, result);
    return result;
  } catch {
    setCache(cacheKey, null);
    return null;
  }
}
