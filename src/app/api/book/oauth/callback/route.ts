import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { createOAuthClient, encryptToken } from "@/lib/booking/google";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// ---------------------------------------------------------------
// GET /api/book/oauth/callback — Google OAuth コールバック
//   state = connectToken。refresh_token を暗号化して保存し、
//   接続完了ページへリダイレクトする。
// ---------------------------------------------------------------

function redirectTo(req: NextRequest, path: string): NextResponse {
  const base =
    process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, "") ?? req.nextUrl.origin;
  return NextResponse.redirect(`${base}${path}`);
}

export async function GET(req: NextRequest) {
  const code = req.nextUrl.searchParams.get("code");
  const state = req.nextUrl.searchParams.get("state") ?? "";

  if (!code || !/^[a-f0-9]{32,64}$/.test(state)) {
    return redirectTo(req, "/book/connected?status=error");
  }

  const host = await db.bookingHost.findUnique({
    where: { connectToken: state },
  });
  if (!host) {
    return redirectTo(req, "/book/connected?status=error");
  }

  try {
    const client = createOAuthClient();
    const { tokens } = await client.getToken(code);
    if (!tokens.refresh_token) {
      console.error("[book/oauth] refresh_token が返されませんでした");
      return redirectTo(req, "/book/connected?status=error");
    }

    // id_token から接続した Google アカウントのメールを取り出す（表示用）
    let googleEmail: string | null = null;
    if (tokens.id_token) {
      try {
        const payload = JSON.parse(
          Buffer.from(tokens.id_token.split(".")[1], "base64url").toString("utf8")
        );
        googleEmail = typeof payload.email === "string" ? payload.email : null;
      } catch {
        // 表示用なので失敗しても続行
      }
    }

    await db.bookingHost.update({
      where: { id: host.id },
      data: {
        googleRefreshToken: encryptToken(tokens.refresh_token),
        googleEmail,
        connectedAt: new Date(),
      },
    });

    return redirectTo(req, "/book/connected?status=ok");
  } catch (e) {
    console.error("[book/oauth] error:", e instanceof Error ? e.message : e);
    return redirectTo(req, "/book/connected?status=error");
  }
}
