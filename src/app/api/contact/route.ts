import { NextRequest, NextResponse } from "next/server";
import { sendContactInquiryEmail } from "@/lib/resend";

export const runtime = "nodejs";

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

  try {
    const body = await req.json();
    const { company, name, email, phone, inquiry_type, message } = body;

    if (!name || !email || !message) {
      return NextResponse.json(
        { error: "必須項目が入力されていません" },
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
