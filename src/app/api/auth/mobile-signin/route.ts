import { NextRequest, NextResponse } from "next/server";
import { OAuth2Client } from "google-auth-library";
import { SignJWT } from "jose";

export const runtime = "nodejs";

const googleClient = new OAuth2Client();
// モバイル OAuth Client ID は環境変数で設定推奨（GOOGLE_IOS_CLIENT_ID, GOOGLE_ANDROID_CLIENT_ID）
const ALLOWED_AUDIENCES = [
  process.env.GOOGLE_CLIENT_ID!,
  process.env.GOOGLE_IOS_CLIENT_ID,
  process.env.GOOGLE_ANDROID_CLIENT_ID,
].filter((v): v is string => !!v);
const ALLOWED_DOMAIN = process.env.ALLOWED_DOMAIN ?? "adarch.co.jp";
const ADMIN_EMAILS = (process.env.ADMIN_EMAILS ?? "")
  .split(",")
  .map((e) => e.trim().toLowerCase())
  .filter(Boolean);

function resolveRole(email: string) {
  return ADMIN_EMAILS.includes(email.toLowerCase()) ? "ADMIN" : "MANAGER";
}

export async function POST(req: NextRequest) {
  try {
    const { idToken } = await req.json();
    if (!idToken) {
      return NextResponse.json({ error: "idToken required" }, { status: 400 });
    }

    // Google ID token を検証（Web/iOS/Android いずれのClient IDでも受け入れ）
    const ticket = await googleClient.verifyIdToken({
      idToken,
      audience: ALLOWED_AUDIENCES,
    });
    const payload = ticket.getPayload();
    if (!payload?.email) {
      return NextResponse.json({ error: "Invalid token" }, { status: 401 });
    }

    // ドメインチェック（lib/auth.ts と同じロジック）
    const domain = payload.email.split("@")[1]?.toLowerCase();
    if (domain !== ALLOWED_DOMAIN) {
      return NextResponse.json({ error: "Domain not allowed" }, { status: 403 });
    }

    // DB からロール取得（lib/auth.ts の jwt callback と同じ）
    let role: string;
    let enabledFeatures: string[] = [];
    let isActive = true;
    try {
      const { db } = await import("@/lib/db");
      const dbUser = await db.user.findUnique({
        where: { email: payload.email },
        select: { role: true, enabledFeatures: true, isActive: true },
      });
      role = dbUser?.role ?? resolveRole(payload.email);
      enabledFeatures = dbUser?.enabledFeatures ?? [];
      isActive = dbUser?.isActive ?? true;
    } catch {
      role = resolveRole(payload.email);
    }

    // JWT を発行（AUTH_SECRET で署名）
    const secret = new TextEncoder().encode(process.env.AUTH_SECRET!);
    const token = await new SignJWT({
      email: payload.email,
      name: payload.name,
      picture: payload.picture,
      role,
      enabledFeatures,
      isActive,
    })
      .setProtectedHeader({ alg: "HS256" })
      .setIssuedAt()
      .setExpirationTime("24h")
      .sign(secret);

    return NextResponse.json({ token, expiresIn: 86400 });
  } catch (e) {
    console.error("[mobile-signin]", e);
    return NextResponse.json({ error: "Authentication failed" }, { status: 401 });
  }
}
