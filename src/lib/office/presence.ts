// ==============================================================
// グループオフィス — サーバー側の共通ロジック
//   「いま誰が動いているか」を灯し、みんなのチャット／個別ひとことで声をかける。
//   音声は置かない（2026-09-01 代表決定）。⚠️ 金額・案件の中身は出さない
// ==============================================================

import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { NextResponse } from "next/server";

/** beat が途切れてからこの時間は「在席」とみなす（beatは15秒ごと） */
export const ONLINE_WINDOW_MS = 45_000;
export const DEMO_EMAIL = "demo@adarch.co.jp";
/** アーチくん（チャットの仲間・AI）。beat しないので在席には出ない */
export const BOT_EMAIL = "arch-kun@adarch.co.jp";
/** 顔アイコンの数（public/office/avatars/a01..a24.webp） */
export const AVATAR_COUNT = 24;

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
  const cands = [input.groupPref ?? "", ...(input.branchLabels ?? []), input.branchName ?? ""];
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

/** 顔アイコンID（"a07"）の検証 */
export function isAvatarId(v: unknown): v is string {
  if (typeof v !== "string") return false;
  const m = /^a(\d{2})$/.exec(v);
  if (!m) return false;
  const n = Number(m[1]);
  return n >= 1 && n <= AVATAR_COUNT;
}

/** 表示に使う画像URL。選んだ顔 → Googleの写真 → null（頭文字で描く） */
export function avatarUrlOf(u: { officeAvatar: string | null; image: string | null }): string | null {
  if (u.officeAvatar === "arch") return "/office/avatars/arch-kun.svg";
  if (u.officeAvatar && isAvatarId(u.officeAvatar)) return `/office/avatars/${u.officeAvatar}.webp`;
  return u.image || null;
}

export const meSelect = {
  id: true,
  email: true,
  name: true,
  image: true,
  officeAvatar: true,
  role: true,
  isActive: true,
  lastSeenAt: true,
  branch: { select: { name: true } },
  groupCompany: { select: { name: true, prefecture: true, branchLabels: true } },
} as const;

export type OfficeUser = {
  id: string;
  name: string;
  initials: string;
  avatar: string | null;
  company: string;
  pref: string;
  isHq: boolean;
  isBot: boolean;
  lastSeenAt: string | null;
};

export function toOfficeUser(u: {
  id: string;
  email: string;
  name: string | null;
  image: string | null;
  officeAvatar: string | null;
  role: string;
  lastSeenAt: Date | null;
  branch: { name: string } | null;
  groupCompany: { name: string; prefecture: string | null; branchLabels: string[] } | null;
}): OfficeUser {
  const isHq = u.role === "ADMIN" && !u.groupCompany;
  return {
    id: u.id,
    name: u.name ?? u.email.split("@")[0],
    initials: initialsOf(u.name, u.email),
    avatar: avatarUrlOf(u),
    company: u.groupCompany?.name ?? u.branch?.name ?? (isHq ? "本部" : ""),
    pref: isHq
      ? "東京"
      : prefOf({
          groupPref: u.groupCompany?.prefecture,
          branchLabels: u.groupCompany?.branchLabels,
          branchName: u.branch?.name,
        }),
    isHq,
    isBot: u.email === BOT_EMAIL,
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

// ---------------- 直列化 ----------------

export type KnockDTO = {
  id: string;
  fromId: string;
  toId: string;
  fromName: string;
  message: string;
  createdAt: string;
  readAt: string | null;
};

export function toKnockDTO(k: {
  id: string;
  fromId: string;
  toId: string;
  message: string;
  createdAt: Date;
  readAt: Date | null;
  from?: { name: string | null; email: string } | null;
}): KnockDTO {
  return {
    id: k.id,
    fromId: k.fromId,
    toId: k.toId,
    fromName: k.from?.name ?? k.from?.email?.split("@")[0] ?? "",
    message: k.message,
    createdAt: k.createdAt.toISOString(),
    readAt: k.readAt ? k.readAt.toISOString() : null,
  };
}

export type ChatDTO = {
  id: string;
  userId: string;
  name: string;
  initials: string;
  avatar: string | null;
  company: string;
  pref: string;
  isBot: boolean;
  text: string;
  createdAt: string;
};

export const chatUserSelect = {
  id: true,
  email: true,
  name: true,
  image: true,
  officeAvatar: true,
  role: true,
  branch: { select: { name: true } },
  groupCompany: { select: { name: true, prefecture: true, branchLabels: true } },
} as const;

export function toChatDTO(m: {
  id: string;
  text: string;
  createdAt: Date;
  user: {
    id: string;
    email: string;
    name: string | null;
    image: string | null;
    officeAvatar: string | null;
    role: string;
    branch: { name: string } | null;
    groupCompany: { name: string; prefecture: string | null; branchLabels: string[] } | null;
  };
}): ChatDTO {
  const u = toOfficeUser({ ...m.user, lastSeenAt: null });
  return {
    id: m.id,
    userId: u.id,
    name: u.name,
    initials: u.initials,
    avatar: u.avatar,
    company: u.isBot ? "AI" : u.company,
    pref: u.isBot ? "OS" : u.pref,
    isBot: u.isBot,
    text: m.text,
    createdAt: m.createdAt.toISOString(),
  };
}
