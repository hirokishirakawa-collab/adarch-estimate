import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { createMeetEvent } from "@/lib/booking/google";
import {
  connectableHosts,
  getAvailability,
  getBookingTypeBySlug,
  parseQuestions,
} from "@/lib/booking/service";
import {
  sendBookingConfirmedToApplicant,
  sendBookingConfirmedToHost,
  type BookingMailPayload,
} from "@/lib/booking/emails";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// ---------------------------------------------------------------
// POST /api/book/[slug] — 公開（認証不要）予約確定
//   1. 申込内容を検証
//   2. 空き枠を再計算して該当スロットの空きホストを特定
//   3. priority 順にカレンダーイベント作成（Meet付き）を試行
//   4. Booking + Lead + LeadLog を作成、確認メール送信
// ---------------------------------------------------------------

const RATE_WINDOW_MS = 10 * 60 * 1000;
const RATE_MAX = 5;
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

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  const ip =
    req.headers.get("x-forwarded-for")?.split(",")[0].trim() ||
    req.headers.get("x-real-ip") ||
    "unknown";
  if (isRateLimited(ip)) {
    return NextResponse.json(
      { error: "送信回数の上限に達しました。しばらく経ってからお試しください。" },
      { status: 429 }
    );
  }

  const { slug } = await params;
  if (!/^[a-z0-9-]{1,50}$/.test(slug)) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  let body: {
    startAt?: string;
    name?: string;
    company?: string;
    email?: string;
    phone?: string;
    answers?: Record<string, string>;
  };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const { startAt, name, company, email, phone } = body;

  // ---- 入力検証 ----
  if (!startAt || !name || !email) {
    return NextResponse.json(
      { error: "必須項目が入力されていません" },
      { status: 400 }
    );
  }
  if (typeof email !== "string" || !EMAIL_RE.test(email) || email.length > 255) {
    return NextResponse.json(
      { error: "メールアドレスの形式が正しくありません" },
      { status: 400 }
    );
  }
  if (
    typeof name !== "string" || name.length > 100 ||
    (company != null && String(company).length > 100) ||
    (phone != null && String(phone).length > 30)
  ) {
    return NextResponse.json(
      { error: "入力内容が長すぎます。内容をご確認ください。" },
      { status: 400 }
    );
  }
  const startDate = new Date(startAt);
  if (isNaN(startDate.getTime())) {
    return NextResponse.json({ error: "日時の形式が不正です" }, { status: 400 });
  }

  try {
    const bt = await getBookingTypeBySlug(slug);
    if (!bt || !bt.isActive) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    // ---- スクリーニング質問の検証・正規化 ----
    const questions = parseQuestions(bt);
    const answers: { label: string; value: string }[] = [];
    for (const q of questions) {
      const raw = body.answers?.[q.id];
      const value = typeof raw === "string" ? raw.trim().slice(0, 2000) : "";
      if (q.required && !value) {
        return NextResponse.json(
          { error: `「${q.label}」が入力されていません` },
          { status: 400 }
        );
      }
      if (q.type === "select" && value && !(q.options ?? []).includes(value)) {
        return NextResponse.json(
          { error: `「${q.label}」の選択値が不正です` },
          { status: 400 }
        );
      }
      if (value) answers.push({ label: q.label, value });
    }

    // ---- 空き再確認 → 空きホスト特定 ----
    const slots = await getAvailability(bt);
    const slot = slots.find((s) => s.startAt.getTime() === startDate.getTime());
    if (!slot) {
      return NextResponse.json(
        { error: "選択された枠は埋まってしまいました。別の枠をお選びください。", code: "SLOT_TAKEN" },
        { status: 409 }
      );
    }

    // priority 昇順（小さいほど優先）で空きホストを並べる
    const hosts = connectableHosts(bt)
      .filter((h) => slot.freeHostIds.includes(h.id))
      .sort((a, b) => a.priority - b.priority);

    const endDate = slot.endAt;
    const summary = `【${bt.title}】${name}様${company ? `（${company}）` : ""}`;
    const description = [
      `${bt.title} の予約が入りました。`,
      ``,
      `お名前: ${name}`,
      company ? `会社名: ${company}` : null,
      `メール: ${email}`,
      phone ? `電話: ${phone}` : null,
      ...answers.map((a) => `${a.label}: ${a.value}`),
      ``,
      `（Ad Arch OS 予約システムより自動作成）`,
    ]
      .filter((l) => l !== null)
      .join("\n");

    // ---- priority 順にイベント作成を試行 ----
    let assigned: (typeof hosts)[number] | null = null;
    let eventId: string | null = null;
    let meetUrl: string | null = null;
    for (const host of hosts) {
      try {
        const result = await createMeetEvent(host, {
          summary,
          description,
          startAt: startDate,
          endAt: endDate,
          attendeeEmail: email,
        });
        assigned = host;
        eventId = result.eventId;
        meetUrl = result.meetUrl;
        break;
      } catch (e) {
        console.error(
          `[book] イベント作成失敗 host=${host.id}:`,
          e instanceof Error ? e.message : e
        );
      }
    }
    if (!assigned) {
      return NextResponse.json(
        { error: "予約の確定に失敗しました。お手数ですが時間をおいてお試しください。" },
        { status: 500 }
      );
    }

    // ---- Booking 作成 ----
    const booking = await db.booking.create({
      data: {
        bookingTypeId: bt.id,
        hostId: assigned.id,
        startAt: startDate,
        endAt: endDate,
        name,
        company: company || null,
        email,
        phone: phone || null,
        answers,
        googleEventId: eventId,
        meetUrl,
      },
    });

    // ※ Lead連携は意図的に行わない（2026-06-11代表判断）。
    //   リード管理は全代表が閲覧できるため、加盟面談の申込情報を流すと
    //   本部＋一村さん以外にも見えてしまう。予約データの正本は
    //   ADMIN専用の /dashboard/admin/bookings のみとする。

    // ---- 確認メール（失敗しても予約は成立。カレンダー招待は別途届いている） ----
    const mailPayload: BookingMailPayload = {
      bookingTitle: bt.title,
      startAt: startDate,
      endAt: endDate,
      applicantName: name,
      applicantCompany: company || null,
      applicantEmail: email,
      applicantPhone: phone || null,
      hostName: assigned.name,
      hostEmail: assigned.email,
      meetUrl,
      cancelToken: booking.cancelToken,
      answers,
    };
    await Promise.allSettled([
      sendBookingConfirmedToApplicant(mailPayload),
      sendBookingConfirmedToHost(mailPayload),
    ]);

    return NextResponse.json({
      ok: true,
      startAt: startDate.toISOString(),
      hostName: assigned.name,
      meetUrl,
    });
  } catch (e) {
    console.error("[book] error:", e instanceof Error ? e.message : e);
    return NextResponse.json(
      { error: "予約の確定に失敗しました" },
      { status: 500 }
    );
  }
}
