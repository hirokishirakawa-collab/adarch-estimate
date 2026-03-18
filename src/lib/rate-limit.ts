import { NextResponse } from "next/server";

/**
 * レート制限（インメモリ）
 * - 分間リクエスト制限（バースト防止）
 * - 日次リクエスト制限（API費用管理）
 */

// === インメモリストア ===
const minuteStore = new Map<string, { count: number; resetAt: number }>();
const dailyStore = new Map<string, { count: number; resetAt: number }>();

const CLEANUP_INTERVAL = 5 * 60 * 1000;
let lastCleanup = Date.now();

function cleanup() {
  const now = Date.now();
  if (now - lastCleanup < CLEANUP_INTERVAL) return;
  lastCleanup = now;
  for (const [key, entry] of minuteStore) {
    if (entry.resetAt < now) minuteStore.delete(key);
  }
  for (const [key, entry] of dailyStore) {
    if (entry.resetAt < now) dailyStore.delete(key);
  }
}

// === 設定 ===
export interface RateLimitConfig {
  /** 分間の最大リクエスト数 */
  maxPerMinute: number;
  /** 日次の最大リクエスト数（0 = 無制限） */
  maxPerDay: number;
}

function getEnvNumber(key: string, fallback: number): number {
  const val = process.env[key];
  if (!val) return fallback;
  const num = parseInt(val, 10);
  return isNaN(num) ? fallback : num;
}

/** プリセット: AI API */
export const AI_RATE_LIMIT: RateLimitConfig = {
  maxPerMinute: getEnvNumber("RATE_LIMIT_AI_PER_MINUTE", 5),
  maxPerDay: getEnvNumber("RATE_LIMIT_AI_PER_DAY", 200),
};

/** プリセット: スクレイピング */
export const SCRAPE_RATE_LIMIT: RateLimitConfig = {
  maxPerMinute: getEnvNumber("RATE_LIMIT_SCRAPE_PER_MINUTE", 3),
  maxPerDay: getEnvNumber("RATE_LIMIT_SCRAPE_PER_DAY", 50),
};

// === チェック関数 ===

function getDayResetAt(): number {
  const now = new Date();
  const tomorrow = new Date(now);
  tomorrow.setDate(tomorrow.getDate() + 1);
  tomorrow.setHours(0, 0, 0, 0);
  return tomorrow.getTime();
}

/**
 * レート制限チェック
 * @returns null = OK, NextResponse = 制限超過
 */
export function checkRateLimit(
  userId: string,
  endpoint: string,
  config: RateLimitConfig
): NextResponse | null {
  cleanup();

  const now = Date.now();

  // 分間チェック
  const minuteKey = `${userId}:${endpoint}:min`;
  const minuteEntry = minuteStore.get(minuteKey);

  if (!minuteEntry || minuteEntry.resetAt < now) {
    minuteStore.set(minuteKey, { count: 1, resetAt: now + 60 * 1000 });
  } else {
    minuteEntry.count++;
    if (minuteEntry.count > config.maxPerMinute) {
      const retryAfter = Math.ceil((minuteEntry.resetAt - now) / 1000);
      return NextResponse.json(
        {
          error: "リクエスト回数の制限に達しました。しばらく経ってから再度お試しください。",
          retryAfter,
          limit: "minute",
        },
        {
          status: 429,
          headers: { "Retry-After": String(retryAfter) },
        }
      );
    }
  }

  // 日次チェック
  if (config.maxPerDay > 0) {
    const dailyKey = `${userId}:${endpoint}:day`;
    const dailyEntry = dailyStore.get(dailyKey);

    if (!dailyEntry || dailyEntry.resetAt < now) {
      dailyStore.set(dailyKey, { count: 1, resetAt: getDayResetAt() });
    } else {
      dailyEntry.count++;
      if (dailyEntry.count > config.maxPerDay) {
        return NextResponse.json(
          {
            error: "本日のリクエスト上限に達しました。明日以降にお試しください。",
            limit: "daily",
            maxPerDay: config.maxPerDay,
          },
          { status: 429 }
        );
      }
    }
  }

  return null;
}
