import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";

export const runtime = "nodejs";

interface GmailMessage {
  to: string;
  subject: string;
  body: string;
  date: string;
}

// Google OAuth でアクセストークンをリフレッシュ
async function refreshAccessToken(refreshToken: string): Promise<{
  access_token: string;
  expires_at: Date;
} | null> {
  try {
    const res = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        client_id: process.env.GOOGLE_CLIENT_ID!,
        client_secret: process.env.GOOGLE_CLIENT_SECRET!,
        grant_type: "refresh_token",
        refresh_token: refreshToken,
      }),
    });
    if (!res.ok) return null;
    const data = await res.json();
    return {
      access_token: data.access_token,
      expires_at: new Date(Date.now() + data.expires_in * 1000),
    };
  } catch {
    return null;
  }
}

// Gmail API からメッセージ本文を取得
async function fetchMessageDetail(
  messageId: string,
  accessToken: string
): Promise<GmailMessage | null> {
  try {
    const res = await fetch(
      `https://gmail.googleapis.com/gmail/v1/users/me/messages/${messageId}?format=full`,
      { headers: { Authorization: `Bearer ${accessToken}` } }
    );
    if (!res.ok) return null;
    const msg = await res.json();

    const headers = msg.payload?.headers ?? [];
    const getHeader = (name: string) =>
      headers.find((h: { name: string; value: string }) =>
        h.name.toLowerCase() === name.toLowerCase()
      )?.value ?? "";

    // 本文抽出（plain text優先）
    let body = "";
    const parts = msg.payload?.parts ?? [];
    if (parts.length > 0) {
      const textPart = parts.find(
        (p: { mimeType: string }) => p.mimeType === "text/plain"
      );
      if (textPart?.body?.data) {
        body = Buffer.from(textPart.body.data, "base64url").toString("utf-8");
      }
    } else if (msg.payload?.body?.data) {
      body = Buffer.from(msg.payload.body.data, "base64url").toString("utf-8");
    }

    // 本文を500文字に制限
    if (body.length > 500) body = body.slice(0, 500) + "...";

    return {
      to: getHeader("To"),
      subject: getHeader("Subject"),
      body,
      date: getHeader("Date"),
    };
  } catch {
    return null;
  }
}

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.email) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // DB からトークン取得
  const user = await db.user.findUnique({
    where: { email: session.user.email },
    select: {
      gmailAccessToken: true,
      gmailRefreshToken: true,
      gmailTokenExpiry: true,
    },
  });

  if (!user?.gmailAccessToken) {
    return NextResponse.json(
      { error: "Gmail未連携", needsReauth: true },
      { status: 403 }
    );
  }

  // トークン期限切れならリフレッシュ
  let accessToken = user.gmailAccessToken;
  if (
    user.gmailTokenExpiry &&
    user.gmailRefreshToken &&
    new Date() >= user.gmailTokenExpiry
  ) {
    const refreshed = await refreshAccessToken(user.gmailRefreshToken);
    if (!refreshed) {
      return NextResponse.json(
        { error: "トークン更新失敗。再ログインしてください", needsReauth: true },
        { status: 403 }
      );
    }
    accessToken = refreshed.access_token;
    await db.user.update({
      where: { email: session.user.email },
      data: {
        gmailAccessToken: refreshed.access_token,
        gmailTokenExpiry: refreshed.expires_at,
      },
    });
  }

  // 過去7日の送信メールを検索
  const daysParam = req.nextUrl.searchParams.get("days") ?? "7";
  const days = Math.min(30, Math.max(1, parseInt(daysParam) || 7));
  const after = new Date();
  after.setDate(after.getDate() - days);
  const afterStr = `${after.getFullYear()}/${after.getMonth() + 1}/${after.getDate()}`;

  try {
    const searchRes = await fetch(
      `https://gmail.googleapis.com/gmail/v1/users/me/messages?q=${encodeURIComponent(
        `in:sent after:${afterStr}`
      )}&maxResults=30`,
      { headers: { Authorization: `Bearer ${accessToken}` } }
    );

    if (searchRes.status === 401) {
      return NextResponse.json(
        { error: "Gmail認証エラー。再ログインしてください", needsReauth: true },
        { status: 403 }
      );
    }

    if (!searchRes.ok) {
      return NextResponse.json(
        { error: "Gmail検索に失敗しました" },
        { status: 500 }
      );
    }

    const searchData = await searchRes.json();
    const messageIds: string[] = (searchData.messages ?? []).map(
      (m: { id: string }) => m.id
    );

    // 各メッセージの詳細を取得（並列、最大20件）
    const details = await Promise.all(
      messageIds.slice(0, 20).map((id) => fetchMessageDetail(id, accessToken))
    );

    const emails = details.filter(Boolean) as GmailMessage[];

    return NextResponse.json({ emails, count: emails.length });
  } catch (e) {
    console.error("[gmail/sent] error:", e);
    return NextResponse.json(
      { error: "Gmailからの取得に失敗しました" },
      { status: 500 }
    );
  }
}
