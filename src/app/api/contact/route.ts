import { NextRequest, NextResponse } from "next/server";
import { sendContactInquiryEmail } from "@/lib/resend";

export const runtime = "nodejs";

// IPごとの簡易レート制限（インメモリ。10分あたり5件まで）
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

export async function POST(req: NextRequest) {
  // CORS — adarch.co.jp からのリクエストを許可
  const origin = req.headers.get("origin") ?? "";
  const allowedOrigins = [
    "https://adarch.co.jp",
    "https://www.adarch.co.jp",
    "http://localhost:8080",
    "http://localhost:3000",
  ];
  const corsOrigin = allowedOrigins.includes(origin) ? origin : allowedOrigins[0];

  const corsHeaders = {
    "Access-Control-Allow-Origin": corsOrigin,
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
  };

  // レート制限（IP単位）
  const ip =
    req.headers.get("x-forwarded-for")?.split(",")[0].trim() ||
    req.headers.get("x-real-ip") ||
    "unknown";
  if (isRateLimited(ip)) {
    return NextResponse.json(
      { error: "送信回数の上限に達しました。しばらく経ってから再度お試しください。" },
      { status: 429, headers: corsHeaders }
    );
  }

  try {
    const body = await req.json();
    const { company, name, email, phone, inquiry_type, message } = body;

    if (!name || !email || !message) {
      return NextResponse.json(
        { error: "必須項目が入力されていません" },
        { status: 400, headers: corsHeaders }
      );
    }

    // 入力検証（メール形式・長さ上限）
    if (typeof email !== "string" || !EMAIL_RE.test(email) || email.length > 255) {
      return NextResponse.json(
        { error: "メールアドレスの形式が正しくありません" },
        { status: 400, headers: corsHeaders }
      );
    }
    if (
      typeof name !== "string" || name.length > 100 ||
      typeof message !== "string" || message.length < 1 || message.length > 2000 ||
      (company != null && String(company).length > 100) ||
      (phone != null && String(phone).length > 30)
    ) {
      return NextResponse.json(
        { error: "入力内容が長すぎます。内容をご確認ください。" },
        { status: 400, headers: corsHeaders }
      );
    }

    await sendContactInquiryEmail({
      company: company || "",
      name,
      email,
      phone: phone || "",
      inquiryType: inquiry_type || "other",
      message,
    });

    return NextResponse.json(
      { ok: true },
      { status: 200, headers: corsHeaders }
    );
  } catch (e) {
    console.error("[contact] error:", e instanceof Error ? e.message : e);
    return NextResponse.json(
      { error: "送信に失敗しました" },
      { status: 500, headers: corsHeaders }
    );
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
