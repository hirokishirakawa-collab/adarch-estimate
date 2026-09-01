import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { randomBytes } from "crypto";
import { auth } from "@/lib/auth";
import type { UserRole } from "@/types/roles";
import { isMfConfigured, mfAuthorizeUrl } from "@/lib/mf-invoice";

// MFクラウド請求書 OAuth2 接続の開始（ADMINのみ）。state をCookieに置いて認可画面へ。
export async function GET() {
  const session = await auth();
  if (!session?.user) return new NextResponse("Unauthorized", { status: 401 });
  if (((session.user.role ?? "USER") as UserRole) !== "ADMIN") return new NextResponse("Forbidden", { status: 403 });
  if (!isMfConfigured()) return new NextResponse("MF_CLIENT_ID / MF_CLIENT_SECRET が未設定です", { status: 500 });

  const state = randomBytes(16).toString("hex");
  const jar = await cookies();
  jar.set("mf_oauth_state", state, { httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "lax", path: "/", maxAge: 600 });
  return NextResponse.redirect(mfAuthorizeUrl(state));
}
