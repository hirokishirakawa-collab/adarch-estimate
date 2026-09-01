// ==============================================================
// グループオフィス — サーバー側の共通ロジック
//   「いま誰が動いているか」を灯し、ひとこと／5分の音声で声をかける。
//   主役は在席表示。音声はあくまで短い声かけ＝5分で必ず切れる（延長なし）。
//   ⚠️ 金額・案件の中身はこの機能のどこにも出さない
// ==============================================================

import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { NextResponse } from "next/server";
import { AccessToken, RoomServiceClient } from "livekit-server-sdk";

/** beat が途切れてからこの時間は「在席」とみなす（beatは15秒ごと） */
export const ONLINE_WINDOW_MS = 45_000;
/** 音声の上限（分）。代表決定 2026-09-01＝5分・延長ボタンは置かない */
export const CALL_MINUTES = 5;
/** 呼びかけに相手が入らなければ諦める時間 */
export const CALL_RING_MS = 60_000;
/** 5分経った後に「続きは予約で」で案内するリンク（本部と話す場合） */
export const BOOKING_URL = "https://calendar.app.google/QQ1fSxmp8hJKcg4U7";

export const DEMO_EMAIL = "demo@adarch.co.jp";

const PREFS = [
  "北海道","青森","岩手","宮城","秋田","山形","福島","茨城","栃木","群馬",
  "埼玉","千葉","東京","神奈川","新潟","富山","石川","福井","山梨","長野",
  "岐阜","静岡","愛知","三重","滋賀","京都","大阪","兵庫","奈良","和歌山",
  "鳥取","島根","岡山","広島","山口","徳島","香川","愛媛","高知","福岡",
  "佐賀","長崎","熊本","大分","宮崎","鹿児島","沖縄",
];

/** 拠点名・県名から地図に置く県を1つ決める。決まらなければ本部＝東京 */
export function prefOf(input: {
  groupPref?: string | null;
  branchLabels?: string[] | null;
  branchName?: string | null;
}): string {
  const cands = [
    input.groupPref ?? "",
    ...(input.branchLabels ?? []),
    input.branchName ?? "",
  ];
  for (const c of cands) {
    const hit = PREFS.find((p) => c.includes(p));
    if (hit) return hit;
  }
  return "東京";
}

/** 頭文字（姓の先頭1〜2文字）。「白川 浩樹」→「白川」／"Hiroki S"→"H" */
export function initialsOf(name: string | null | undefined, email: string): string {
  const n = (name ?? "").trim();
  if (!n) return email.slice(0, 1).toUpperCase();
  const first = n.split(/[\s　]+/)[0];
  return /^[\x20-\x7e]+$/.test(first) ? first.slice(0, 1).toUpperCase() : first.slice(0, 2);
}

export const meSelect = {
  id: true,
  email: true,
  name: true,
  image: true,
  role: true,
  isActive: true,
  lastSeenAt: true,
  officeRoom: true,
  branch: { select: { name: true } },
  groupCompany: { select: { name: true, prefecture: true, branchLabels: true } },
} as const;

export type OfficeUser = {
  id: string;
  name: string;
  initials: string;
  company: string;
  pref: string;
  isHq: boolean;
  image: string | null;
  inCall: boolean;
  lastSeenAt: string | null;
};

export function toOfficeUser(u: {
  id: string;
  email: string;
  name: string | null;
  image: string | null;
  role: string;
  lastSeenAt: Date | null;
  officeRoom: string | null;
  branch: { name: string } | null;
  groupCompany: { name: string; prefecture: string | null; branchLabels: string[] } | null;
}): OfficeUser {
  const isHq = u.role === "ADMIN" && !u.groupCompany;
  return {
    id: u.id,
    name: u.name ?? u.email.split("@")[0],
    initials: initialsOf(u.name, u.email),
    company: u.groupCompany?.name ?? u.branch?.name ?? (isHq ? "本部" : ""),
    pref: isHq
      ? "東京"
      : prefOf({
          groupPref: u.groupCompany?.prefecture,
          branchLabels: u.groupCompany?.branchLabels,
          branchName: u.branch?.name,
        }),
    isHq,
    image: u.image,
    inCall: !!u.officeRoom,
    lastSeenAt: u.lastSeenAt ? u.lastSeenAt.toISOString() : null,
  };
}

/**
 * 認証＋本人取得。デモ・停止中には使わせない（/live と同じ扱い）。
 * 失敗時は NextResponse を返すので、呼び側は `if (r instanceof NextResponse) return r;`
 */
export async function officeGuard() {
  const session = await auth();
  if (!session?.user?.email) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (session.user.email === DEMO_EMAIL || session.user.isActive === false) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  const me = await db.user.findUnique({ where: { email: session.user.email }, select: meSelect });
  if (!me || !me.isActive) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  return me;
}

// ---------------- LiveKit ----------------

export function voiceConfigured(): boolean {
  return !!(process.env.LIVEKIT_URL && process.env.LIVEKIT_API_KEY && process.env.LIVEKIT_API_SECRET);
}

/** 部屋に入るためのトークン。有効期限＝部屋の残り時間（切れた後は発行しない） */
export async function makeCallToken(params: {
  room: string;
  userId: string;
  name: string;
  expiresAt: Date;
}): Promise<{ url: string; token: string } | null> {
  if (!voiceConfigured()) return null;
  const ttl = Math.floor((params.expiresAt.getTime() - Date.now()) / 1000);
  if (ttl <= 5) return null;
  const at = new AccessToken(process.env.LIVEKIT_API_KEY!, process.env.LIVEKIT_API_SECRET!, {
    identity: params.userId,
    name: params.name,
    ttl,
  });
  at.addGrant({
    room: params.room,
    roomJoin: true,
    canPublish: true,
    canSubscribe: true,
    canPublishData: false,
  });
  return { url: process.env.LIVEKIT_URL!, token: await at.toJwt() };
}

/** 部屋を閉じる（ベストエフォート。失敗しても呼び側は止めない） */
export async function closeLiveKitRoom(room: string): Promise<void> {
  if (!voiceConfigured()) return;
  try {
    const http = process.env.LIVEKIT_URL!.replace(/^wss?:\/\//, (m) => (m === "wss://" ? "https://" : "http://"));
    const svc = new RoomServiceClient(http, process.env.LIVEKIT_API_KEY!, process.env.LIVEKIT_API_SECRET!);
    await svc.deleteRoom(room);
  } catch (e) {
    // 既に消えている・未作成のときはここに来る＝無視でよい
    console.warn("[office] deleteRoom:", e instanceof Error ? e.message : e);
  }
}

// ---------------- 直列化 ----------------

export type KnockDTO = {
  id: string;
  kind: "TEXT" | "CALL";
  fromId: string;
  toId: string;
  fromName: string;
  message: string;
  createdAt: string;
  readAt: string | null;
  expiresAt: string | null;
  acceptedAt: string | null;
  declinedAt: string | null;
  endedAt: string | null;
};

export function toKnockDTO(k: {
  id: string;
  kind: "TEXT" | "CALL";
  fromId: string;
  toId: string;
  message: string;
  createdAt: Date;
  readAt: Date | null;
  expiresAt: Date | null;
  acceptedAt: Date | null;
  declinedAt: Date | null;
  endedAt: Date | null;
  from?: { name: string | null; email: string } | null;
}): KnockDTO {
  const iso = (d: Date | null) => (d ? d.toISOString() : null);
  return {
    id: k.id,
    kind: k.kind,
    fromId: k.fromId,
    toId: k.toId,
    fromName: k.from?.name ?? k.from?.email?.split("@")[0] ?? "",
    message: k.message,
    createdAt: k.createdAt.toISOString(),
    readAt: iso(k.readAt),
    expiresAt: iso(k.expiresAt),
    acceptedAt: iso(k.acceptedAt),
    declinedAt: iso(k.declinedAt),
    endedAt: iso(k.endedAt),
  };
}

/** 呼びかけ(CALL)が「まだ生きている」か＝入れる／鳴らしてよい */
export function callIsLive(k: { expiresAt: Date | null; declinedAt: Date | null; endedAt: Date | null }): boolean {
  if (!k.expiresAt) return false;
  if (k.declinedAt || k.endedAt) return false;
  return k.expiresAt.getTime() > Date.now();
}
