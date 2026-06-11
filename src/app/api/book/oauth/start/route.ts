import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { BOOKING_OAUTH_SCOPES, createOAuthClient } from "@/lib/booking/google";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// ---------------------------------------------------------------
// GET /api/book/oauth/start?token=xxx — 公開
//   ホスト招待リンクから Google OAuth 同意画面へリダイレクトする。
//   connectToken が招待の認可そのもの（管理画面で発行・再発行）。
// ---------------------------------------------------------------

export async function GET(req: NextRequest) {
  const token = req.nextUrl.searchParams.get("token") ?? "";
  if (!/^[a-f0-9]{32,64}$/.test(token)) {
    return NextResponse.json({ error: "無効なリンクです" }, { status: 400 });
  }

  const host = await db.bookingHost.findUnique({
    where: { connectToken: token },
  });
  if (!host || !host.isActive) {
    return NextResponse.json(
      { error: "招待リンクが無効です。管理者に再発行を依頼してください。" },
      { status: 404 }
    );
  }

  const client = createOAuthClient();
  const url = client.generateAuthUrl({
    access_type: "offline",
    prompt: "consent", // refresh_token を確実に取得する
    scope: BOOKING_OAUTH_SCOPES,
    state: token,
    login_hint: host.googleEmail ?? host.email,
  });
  return NextResponse.redirect(url);
}
