import { NextResponse } from "next/server";

/**
 * レート制限（インメモリ）
 * - 分間リクエスト制限（バースト防止）
 * - 日次リクエスト制限（API費用管理）
 * - ユーザー横断日次制限（全エンドポイント合計）
 * - グローバル日次制限（システム全体の費用上限）
 */

// === インメモリストア ===
const minuteStore = new Map<string, { count: number; resetAt: number }>();
const dailyStore = new Map<string, { count: number; resetAt: number }>();
/** ユーザー横断: 全AI APIエンドポイント合計の日次カウント */
const userDailyTotalStore = new Map<string, { count: number; resetAt: number }>();
/** グローバル: システム全体の日次カウント */
const globalDailyStore = new Map<string, { count: number; resetAt: number }>();

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
  for (const [key, entry] of userDailyTotalStore) {
    if (entry.resetAt < now) userDailyTotalStore.delete(key);
  }
  for (const [key, entry] of globalDailyStore) {
    if (entry.resetAt < now) globalDailyStore.delete(key);
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

/** プリセット: TVCM/動画PRクロール（ADMIN専用配布モデルに合わせて緩和） */
export const TVCM_RATE_LIMIT: RateLimitConfig = {
  maxPerMinute: getEnvNumber("RATE_LIMIT_TVCM_PER_MINUTE", 5),
  maxPerDay: getEnvNumber("RATE_LIMIT_TVCM_PER_DAY", 30),
};

/** ユーザーあたり全AI API合計の日次上限（デフォルト: 30回/日） */
const USER_DAILY_TOTAL_LIMIT = getEnvNumber("RATE_LIMIT_USER_DAILY_TOTAL", 30);

/** システム全体の日次上限（デフォルト: 200回/日） */
const GLOBAL_DAILY_LIMIT = getEnvNumber("RATE_LIMIT_GLOBAL_DAILY", 200);

// === チェック関数 ===

function getDayResetAt(): number {
  const now = new Date();
  const tomorrow = new Date(now);
  tomorrow.setDate(tomorrow.getDate() + 1);
  tomorrow.setHours(0, 0, 0, 0);
  return tomorrow.getTime();
}

function incrementDailyCounter(
  store: Map<string, { count: number; resetAt: number }>,
  key: string,
  now: number,
): number {
  const entry = store.get(key);
  if (!entry || entry.resetAt < now) {
    store.set(key, { count: 1, resetAt: getDayResetAt() });
    return 1;
  }
  entry.count++;
  return entry.count;
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

  // グローバル日次チェック（システム全体）
  if (GLOBAL_DAILY_LIMIT > 0) {
    const globalCount = incrementDailyCounter(globalDailyStore, "global:ai:day", now);
    if (globalCount > GLOBAL_DAILY_LIMIT) {
      return NextResponse.json(
        {
          error: "システム全体の本日のAPI利用上限に達しました。明日以降にお試しください。",
          limit: "global_daily",
          maxPerDay: GLOBAL_DAILY_LIMIT,
        },
        { status: 429 }
      );
    }
  }

  // ユーザー横断日次チェック（全エンドポイント合計）
  if (USER_DAILY_TOTAL_LIMIT > 0) {
    const userTotalCount = incrementDailyCounter(userDailyTotalStore, `${userId}:all:day`, now);
    if (userTotalCount > USER_DAILY_TOTAL_LIMIT) {
      return NextResponse.json(
        {
          error: "本日のAI機能の利用上限に達しました。明日以降にお試しください。",
          limit: "user_daily_total",
          maxPerDay: USER_DAILY_TOTAL_LIMIT,
        },
        { status: 429 }
      );
    }
  }

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

  // エンドポイント別日次チェック
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
