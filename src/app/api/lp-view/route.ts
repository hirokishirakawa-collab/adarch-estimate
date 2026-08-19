import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

export const runtime = "nodejs";

// 加盟開発LP（adarch.co.jp/intro/）からの計測ビーコンを受ける。
// GA4やMeta広告のAPI認証を経ずに、毎朝のブリーフィングで流入とコンバージョンを出すのが目的。
// 個人情報は受け取らない（匿名の visitorId のみ）。

const ALLOWED_ORIGINS = [
  "https://adarch.co.jp",
  "https://www.adarch.co.jp",
  "http://localhost:8899",
  "http://127.0.0.1:8899",
];

// 記録を許可するイベント。想定外の値でテーブルを汚さない。
const ALLOWED_EVENTS = new Set([
  "view",
  "doc_request_click",
  "form_start",
  "lead",
  "book_click",
  "booking_view",
]);

// IPごとの簡易レート制限（インメモリ。1分あたり30件まで）
const RATE_WINDOW_MS = 60 * 1000;
const RATE_MAX = 30;
const ipHits = new Map<string, { count: number; resetAt: number }>();

function isRateLimited(ip: string): boolean {
  const now = Date.now();
  const entry = ipHits.get(ip);
  if (!entry || entry.resetAt < now) {
    ipHits.set(ip, { count: 1, resetAt: now + RATE_WINDOW_MS });
    if (ipHits.size > 5000) {
      for (const [k, v] of ipHits) if (v.resetAt < now) ipHits.delete(k);
    }
    return false;
  }
  entry.count++;
  return entry.count > RATE_MAX;
}

function trim(v: unknown, max: number): string | null {
  if (typeof v !== "string") return null;
  const s = v.trim();
  return s ? s.slice(0, max) : null;
}

function corsHeaders(origin: string) {
  return {
    "Access-Control-Allow-Origin": ALLOWED_ORIGINS.includes(origin) ? origin : ALLOWED_ORIGINS[0],
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
  };
}

export async function POST(req: NextRequest) {
  const headers = corsHeaders(req.headers.get("origin") ?? "");

  const ip =
    req.headers.get("x-forwarded-for")?.split(",")[0].trim() ||
    req.headers.get("x-real-ip") ||
    "unknown";
  if (isRateLimited(ip)) {
    // 計測は落としても業務に影響しないので、静かに受け流す
    return NextResponse.json({ ok: true }, { status: 200, headers });
  }

  try {
    const body = await req.json();
    const event = trim(body.event, 40);
    if (!event || !ALLOWED_EVENTS.has(event)) {
      return NextResponse.json({ ok: false }, { status: 400, headers });
    }

    await db.lpView.create({
      data: {
        path: trim(body.path, 200) ?? "/intro/",
        event,
        utmSource: trim(body.utm_source, 100),
        utmMedium: trim(body.utm_medium, 100),
        utmCampaign: trim(body.utm_campaign, 100),
        utmContent: trim(body.utm_content, 100),
        referrer: trim(body.referrer, 300),
        visitorId: trim(body.visitor_id, 64),
        isMobile: typeof body.is_mobile === "boolean" ? body.is_mobile : null,
      },
    });

    return NextResponse.json({ ok: true }, { status: 200, headers });
  } catch (e) {
    console.error("[lp-view] error:", e instanceof Error ? e.message : e);
    // 計測の失敗でLP側の体験を壊さない
    return NextResponse.json({ ok: false }, { status: 200, headers });
  }
}

export async function OPTIONS() {
  return new NextResponse(null, {
    status: 204,
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type",
    },
  });
}
