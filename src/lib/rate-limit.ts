import { NextResponse } from "next/server";

/**
 * インメモリ レート制限（サーバーレス対応の簡易版）
 * ユーザーごと・エンドポイントごとにリクエスト数を制限
 */
const store = new Map<string, { count: number; resetAt: number }>();

// 5分ごとにストアをクリーンアップ
const CLEANUP_INTERVAL = 5 * 60 * 1000;
let lastCleanup = Date.now();

function cleanup() {
  const now = Date.now();
  if (now - lastCleanup < CLEANUP_INTERVAL) return;
  lastCleanup = now;
  for (const [key, entry] of store) {
    if (entry.resetAt < now) store.delete(key);
  }
}

interface RateLimitConfig {
  /** ウィンドウ内の最大リクエスト数 */
  maxRequests: number;
  /** ウィンドウサイズ（ミリ秒） */
  windowMs: number;
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

  const key = `${userId}:${endpoint}`;
  const now = Date.now();
  const entry = store.get(key);

  if (!entry || entry.resetAt < now) {
    store.set(key, { count: 1, resetAt: now + config.windowMs });
    return null;
  }

  entry.count++;
  if (entry.count > config.maxRequests) {
    const retryAfter = Math.ceil((entry.resetAt - now) / 1000);
    return NextResponse.json(
      {
        error: "リクエスト回数の制限に達しました。しばらく経ってから再度お試しください。",
        retryAfter,
      },
      {
        status: 429,
        headers: { "Retry-After": String(retryAfter) },
      }
    );
  }

  return null;
}

/** プリセット: AI API（1分あたり5回） */
export const AI_RATE_LIMIT: RateLimitConfig = {
  maxRequests: 5,
  windowMs: 60 * 1000,
};

/** プリセット: スクレイピング（1分あたり3回） */
export const SCRAPE_RATE_LIMIT: RateLimitConfig = {
  maxRequests: 3,
  windowMs: 60 * 1000,
};
