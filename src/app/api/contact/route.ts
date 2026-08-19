import { NextRequest, NextResponse } from "next/server";
import { sendContactInquiryEmail, sendPartnershipAutoReply } from "@/lib/resend";
import { db } from "@/lib/db";
import { notifyCeo } from "@/lib/google-chat";

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

// LPフォームは message 内に【都道府県】【事業内容・業種】等の構造化ブロックで送信してくる
function parseBlock(message: string, label: string): string | null {
  const m = message.match(new RegExp(`【${label}】([^【]*)`));
  const v = m?.[1]?.trim();
  return v || null;
}

// 加盟問い合わせ（inquiry_type=partnership）を FranchiseLead に自動起票し、CEO通知スペースへ即時通知。
// メール通知（Resend）とは独立して実行し、片方が失敗しても問い合わせが消失しないようにする。
async function registerFranchiseInquiry(input: {
  name: string;
  email: string;
  phone: string;
  message: string;
}): Promise<boolean> {
  const { name, email, phone, message } = input;
  const prefecture = parseBlock(message, "都道府県");
  const business = parseBlock(message, "事業内容・業種");
  const revenue = parseBlock(message, "直近の年商規模");

  try {
    // companyName=氏名 / address=メールアドレスを @@unique キーとして流用（同一人物の再問い合わせは追記に集約）
    const existing = await db.franchiseLead.findUnique({
      where: { companyName_address: { companyName: name, address: email } },
    });

    if (existing) {
      const stamp = new Date().toLocaleString("ja-JP", { timeZone: "Asia/Tokyo" });
      await db.franchiseLead.update({
        where: { id: existing.id },
        data: {
          notes: `${existing.notes ?? ""}\n\n―― 再問い合わせ（${stamp}）――\n${message}`.trim(),
        },
      });
    } else {
      await db.franchiseLead.create({
        data: {
          companyName: name,
          address: email,
          prefecture,
          phone: phone || null,
          email,
          businessType: business,
          revenueRange: revenue,
          notes: message,
          source: "LP_FORM",
          status: "NEW",
          // ownerEmail=null は本部扱い
        },
      });
    }

    const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "";
    await notifyCeo(
      [
        existing ? "🔁 加盟お問い合わせ【再】（LPフォーム）" : "🆕 加盟お問い合わせ（LPフォーム）",
        `氏名: ${name}`,
        `都道府県: ${prefecture ?? "未回答"}`,
        `事業内容: ${business ?? "未回答"}`,
        `年商規模: ${revenue ?? "未回答"}`,
        `連絡先: ${email}${phone ? ` / ${phone}` : ""}`,
        "",
        "⏰ SLA: 24時間以内に初回返信",
        appUrl ? `${appUrl}/dashboard/franchise-leads` : "",
      ]
        .filter(Boolean)
        .join("\n")
    );

    return true;
  } catch (e) {
    console.error("[contact] franchise lead registration error:", e instanceof Error ? e.message : e);
    return false;
  }
}

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

    // 加盟問い合わせは FranchiseLead に起票（メール通知とは独立に実行）
    let leadRegistered = false;
    if ((inquiry_type || "") === "partnership") {
      leadRegistered = await registerFranchiseInquiry({
        name,
        email,
        phone: phone ? String(phone) : "",
        message,
      });
    }

    // 加盟の資料請求・お問い合わせには即時で自動返信（代表名義）。
    // 広告経由の請求は深夜・休日にも入るため、人手を待たせない。失敗しても本体は落とさない。
    if ((inquiry_type || "") === "partnership") {
      try {
        await sendPartnershipAutoReply({ name, email });
      } catch (e) {
        console.error("[contact] auto-reply error:", e instanceof Error ? e.message : e);
      }
    }

    let emailSent = true;
    try {
      await sendContactInquiryEmail({
        company: company || "",
        name,
        email,
        phone: phone || "",
        inquiryType: inquiry_type || "other",
        message,
      });
    } catch (e) {
      emailSent = false;
      console.error("[contact] email error:", e instanceof Error ? e.message : e);
      // 起票済みなら問い合わせは失われていないため成功として返す
      if (!leadRegistered) throw e;
    }

    return NextResponse.json(
      { ok: true, emailSent },
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
