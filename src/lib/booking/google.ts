import crypto from "node:crypto";
import { google } from "googleapis";
import type { BookingHost } from "@/generated/prisma/client";

// ----------------------------------------------------------------
// 商談予約システム — Google Calendar 連携
//
// ホスト（社外パートナー含む）は招待リンクから一度だけ OAuth 同意し、
// refresh token を暗号化して booking_hosts に保存する。
// 以後そのトークンで freebusy 照会とイベント作成（Meet付き）を行う。
//
// 必要スコープ:
//   - calendar.events   … 担当ホストのカレンダーへ予定作成・削除
//   - calendar.freebusy … 空き時間の照会（予定の中身は読まない）
// ----------------------------------------------------------------

export const BOOKING_OAUTH_SCOPES = [
  "openid",
  "email",
  "https://www.googleapis.com/auth/calendar.events",
  "https://www.googleapis.com/auth/calendar.freebusy",
];

function appUrl(path: string): string {
  const base = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
  return `${base.replace(/\/$/, "")}${path}`;
}

export function oauthRedirectUri(): string {
  return appUrl("/api/book/oauth/callback");
}

export function createOAuthClient() {
  return new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
    oauthRedirectUri()
  );
}

// ---- refresh token の AES-256-GCM 暗号化（AUTH_SECRET 派生鍵） ----

function encryptionKey(): Buffer {
  const secret = process.env.AUTH_SECRET;
  if (!secret) throw new Error("[booking] AUTH_SECRET が設定されていません");
  return crypto.createHash("sha256").update(secret).digest();
}

export function encryptToken(plain: string): string {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", encryptionKey(), iv);
  const enc = Buffer.concat([cipher.update(plain, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `${iv.toString("base64")}.${tag.toString("base64")}.${enc.toString("base64")}`;
}

export function decryptToken(stored: string): string {
  const [iv, tag, enc] = stored.split(".");
  const decipher = crypto.createDecipheriv(
    "aes-256-gcm",
    encryptionKey(),
    Buffer.from(iv, "base64")
  );
  decipher.setAuthTag(Buffer.from(tag, "base64"));
  return Buffer.concat([
    decipher.update(Buffer.from(enc, "base64")),
    decipher.final(),
  ]).toString("utf8");
}

// ---- ホストの認証済みカレンダークライアント ----

type ConnectedHost = Pick<
  BookingHost,
  "id" | "calendarId" | "googleRefreshToken"
>;

function calendarClientFor(host: ConnectedHost) {
  if (!host.googleRefreshToken) {
    throw new Error(`[booking] host ${host.id} はカレンダー未接続です`);
  }
  const client = createOAuthClient();
  client.setCredentials({
    refresh_token: decryptToken(host.googleRefreshToken),
  });
  return google.calendar({ version: "v3", auth: client });
}

export type BusyInterval = { start: number; end: number }; // epoch ms

/// ホスト1人分の busy 区間を取得。失敗したら null（=このホストは予約に使わない）
export async function fetchBusyIntervals(
  host: ConnectedHost,
  timeMin: Date,
  timeMax: Date
): Promise<BusyInterval[] | null> {
  try {
    const calendar = calendarClientFor(host);
    const res = await calendar.freebusy.query({
      requestBody: {
        timeMin: timeMin.toISOString(),
        timeMax: timeMax.toISOString(),
        items: [{ id: host.calendarId }],
      },
    });
    const busy = res.data.calendars?.[host.calendarId]?.busy ?? [];
    return busy
      .filter((b) => b.start && b.end)
      .map((b) => ({
        start: new Date(b.start as string).getTime(),
        end: new Date(b.end as string).getTime(),
      }));
  } catch (e) {
    console.error(
      `[booking] freebusy 取得失敗 host=${host.id}:`,
      e instanceof Error ? e.message : e
    );
    return null;
  }
}

// ---- イベント作成 / 削除 ----

export async function createMeetEvent(
  host: ConnectedHost,
  params: {
    summary: string;
    description: string;
    startAt: Date;
    endAt: Date;
    attendeeEmail: string;
  }
): Promise<{ eventId: string; meetUrl: string | null }> {
  const calendar = calendarClientFor(host);
  const res = await calendar.events.insert({
    calendarId: host.calendarId,
    conferenceDataVersion: 1,
    sendUpdates: "all", // 申込者にGoogleカレンダー招待も届く
    requestBody: {
      summary: params.summary,
      description: params.description,
      start: { dateTime: params.startAt.toISOString(), timeZone: "Asia/Tokyo" },
      end: { dateTime: params.endAt.toISOString(), timeZone: "Asia/Tokyo" },
      attendees: [{ email: params.attendeeEmail }],
      conferenceData: {
        createRequest: {
          requestId: crypto.randomUUID(),
          conferenceSolutionKey: { type: "hangoutsMeet" },
        },
      },
    },
  });
  const meetUrl =
    res.data.hangoutLink ??
    res.data.conferenceData?.entryPoints?.find(
      (p) => p.entryPointType === "video"
    )?.uri ??
    null;
  return { eventId: res.data.id as string, meetUrl };
}

export async function deleteCalendarEvent(
  host: ConnectedHost,
  eventId: string
): Promise<void> {
  try {
    const calendar = calendarClientFor(host);
    await calendar.events.delete({
      calendarId: host.calendarId,
      eventId,
      sendUpdates: "all",
    });
  } catch (e) {
    // 既に手動削除済み等は握りつぶす（予約自体のキャンセルは続行）
    console.error(
      `[booking] イベント削除失敗 event=${eventId}:`,
      e instanceof Error ? e.message : e
    );
  }
}
