import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { deleteCalendarEvent } from "@/lib/booking/google";
import { sendBookingCancelledEmails } from "@/lib/booking/emails";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// ---------------------------------------------------------------
// /api/book/cancel/[token] — 公開（cancelToken が認可そのもの）
//   GET : 予約内容の確認（キャンセルページ表示用）
//   POST: キャンセル実行（カレンダー削除＋通知メール）
// ---------------------------------------------------------------

const RATE_WINDOW_MS = 10 * 60 * 1000;
const RATE_MAX = 10;
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

function clientIp(req: NextRequest): string {
  return (
    req.headers.get("x-forwarded-for")?.split(",")[0].trim() ||
    req.headers.get("x-real-ip") ||
    "unknown"
  );
}

async function findBooking(token: string) {
  if (!/^[a-z0-9]{20,40}$/i.test(token)) return null;
  return db.booking.findUnique({
    where: { cancelToken: token },
    include: { host: true, bookingType: true },
  });
}

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  if (isRateLimited(clientIp(req))) {
    return NextResponse.json({ error: "Too many requests" }, { status: 429 });
  }
  const { token } = await params;
  const booking = await findBooking(token);
  if (!booking) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  return NextResponse.json({
    title: booking.bookingType.title,
    startAt: booking.startAt.toISOString(),
    name: booking.name,
    status: booking.status,
  });
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  if (isRateLimited(clientIp(req))) {
    return NextResponse.json({ error: "Too many requests" }, { status: 429 });
  }
  const { token } = await params;
  try {
    const booking = await findBooking(token);
    if (!booking) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }
    if (booking.status === "CANCELLED") {
      return NextResponse.json({ ok: true, already: true });
    }

    if (booking.googleEventId) {
      await deleteCalendarEvent(booking.host, booking.googleEventId);
    }

    await db.booking.update({
      where: { id: booking.id },
      data: { status: "CANCELLED", cancelledAt: new Date() },
    });

    await sendBookingCancelledEmails({
      bookingTitle: booking.bookingType.title,
      startAt: booking.startAt,
      endAt: booking.endAt,
      applicantName: booking.name,
      applicantCompany: booking.company,
      applicantEmail: booking.email,
      applicantPhone: booking.phone,
      hostName: booking.host.name,
      hostEmail: booking.host.email,
      meetUrl: booking.meetUrl,
      cancelToken: booking.cancelToken,
    });

    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error("[book/cancel] error:", e instanceof Error ? e.message : e);
    return NextResponse.json(
      { error: "キャンセルに失敗しました" },
      { status: 500 }
    );
  }
}
