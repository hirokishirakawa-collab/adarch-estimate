import { NextRequest, NextResponse } from "next/server";
import { getAvailability, getBookingTypeBySlug } from "@/lib/booking/service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// ---------------------------------------------------------------
// GET /api/book/[slug]/slots — 公開（認証不要）
//   統合空き枠を返す。どのホストが空いているかは外に出さない。
// ---------------------------------------------------------------

// IPごとの簡易レート制限（10分あたり60回）
const RATE_WINDOW_MS = 10 * 60 * 1000;
const RATE_MAX = 60;
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

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  const ip =
    req.headers.get("x-forwarded-for")?.split(",")[0].trim() ||
    req.headers.get("x-real-ip") ||
    "unknown";
  if (isRateLimited(ip)) {
    return NextResponse.json(
      { error: "アクセスが集中しています。しばらく経ってからお試しください。" },
      { status: 429 }
    );
  }

  const { slug } = await params;
  if (!/^[a-z0-9-]{1,50}$/.test(slug)) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  try {
    const bt = await getBookingTypeBySlug(slug);
    if (!bt || !bt.isActive) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }
    const slots = await getAvailability(bt);
    return NextResponse.json({
      slots: slots.map((s) => s.startAt.toISOString()),
    });
  } catch (e) {
    console.error("[book/slots] error:", e instanceof Error ? e.message : e);
    return NextResponse.json(
      { error: "空き枠の取得に失敗しました" },
      { status: 500 }
    );
  }
}
