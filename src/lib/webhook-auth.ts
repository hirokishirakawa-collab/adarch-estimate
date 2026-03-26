// ==============================================================
// Webhook API Key 認証ヘルパー
// ==============================================================

import { NextRequest, NextResponse } from "next/server";
import { timingSafeEqual } from "crypto";

const API_KEY = process.env.GROUP_SUPPORT_API_KEY;

/** タイミングセーフな文字列比較 */
function safeCompare(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  return timingSafeEqual(Buffer.from(a), Buffer.from(b));
}

/**
 * x-api-key ヘッダーを検証する。
 * 一致すれば null、不一致なら 401 レスポンスを返す。
 */
export function verifyWebhookApiKey(
  req: NextRequest
): NextResponse | null {
  if (!API_KEY) {
    console.error("[webhook-auth] GROUP_SUPPORT_API_KEY is not set");
    return NextResponse.json(
      { error: "Server configuration error" },
      { status: 500 }
    );
  }

  const provided = req.headers.get("x-api-key");
  if (!provided || !safeCompare(provided, API_KEY)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  return null; // OK
}
