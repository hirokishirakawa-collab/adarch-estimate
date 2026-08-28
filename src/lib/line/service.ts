// ==============================================================
// LINE公式アカウント — Webhook処理・シナリオ配信・一斉配信
// ==============================================================

import crypto from "node:crypto";
import { db } from "@/lib/db";
import { createInAppNotification } from "@/lib/notifications";
import { decryptSecret } from "@/lib/line/secret";
import {
  getProfile,
  replyMessage,
  pushMessage,
  multicastMessage,
  text,
  LineApiError,
  linkRichMenuToUser,
  unlinkRichMenuFromUser,
  type LineMessageObject,
  type RichMenuArea,
} from "@/lib/line/client";
import type { LineAccount, LineEntryPoint, LineFriend, LineScenarioStep } from "@/generated/prisma/client";

const JST_OFFSET = 9 * 60 * 60 * 1000;

// ---------------------------------------------------------------
// ステップの送信時刻
//   delayDays=0 & sendHour=null → 即時
//   それ以外 → 開始日(JST) + delayDays 日 の sendHour 時（JST）。過去なら今すぐ
// ---------------------------------------------------------------
export function computeStepRunAt(startedAt: Date, step: Pick<LineScenarioStep, "delayDays" | "sendHour">): Date {
  const now = new Date();
  if (step.delayDays === 0 && step.sendHour == null) return now;
  const jst = new Date(startedAt.getTime() + JST_OFFSET);
  const hour = step.sendHour ?? 10;
  const runAt = new Date(
    Date.UTC(jst.getUTCFullYear(), jst.getUTCMonth(), jst.getUTCDate() + step.delayDays, hour, 0, 0) - JST_OFFSET,
  );
  return runAt < now ? now : runAt;
}

/** 本文の差し込み（{name} のみ・同期） */
export function renderText(template: string, friend: Pick<LineFriend, "displayName">): string {
  return template.replaceAll("{name}", friend.displayName ?? "");
}

/**
 * タグを原子的に追加（重複なし）。
 * ⚠️ Prisma の `tags: { push: [..] }` は本環境（adapter-pg）で配列が入れ子になり列が壊れる（8/26に実害）ため、SQLで追加する。
 */
export async function addFriendTags(friendId: string, fresh: string[]): Promise<LineFriend | null> {
  const clean = [...new Set(fresh.map((t) => t.trim()).filter(Boolean))];
  if (clean.length > 0) {
    const before = await db.lineFriend.findUnique({ where: { id: friendId }, select: { tags: true, accountId: true, account: { select: { scoreRules: true } } } });
    await db.$executeRaw`UPDATE line_friends SET tags = ARRAY(SELECT DISTINCT x FROM unnest(tags || ${clean}::text[]) AS x) WHERE id = ${friendId}`;
    // タグごとの加点（点数表にあるタグだけ）＋イベント記録
    if (before) {
      const rules = parseScoreRules(before.account.scoreRules);
      for (const t of clean) {
        if (before.tags.includes(t)) continue;
        if (rules.tagPoints[t]) addScore(friendId, `tag:${t}`, t).catch(() => {});
        logEvent(before.accountId, friendId, "tag", t).catch(() => {});
      }
    }
  }
  return db.lineFriend.findUnique({ where: { id: friendId } });
}

export function newFriendToken(): string {
  return crypto.randomBytes(12).toString("base64url");
}

function escapeRe(v: string): string {
  return v.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function appBase(): string {
  return (process.env.AUTH_URL ?? process.env.NEXTAUTH_URL ?? "").replace(/\/$/, "");
}

/**
 * 相手ごとの差し込み（非同期）
 *   {name}       → 表示名
 *   {link:code}  → 計測リンク（/l/<token>/<code>）。未定義の code はそのまま残す
 */
export async function renderForFriend(
  template: string,
  friend: Pick<LineFriend, "id" | "displayName" | "token" | "accountId">,
): Promise<string> {
  let out = renderText(template, friend);
  if (!out.includes("{link:") && !out.includes("{form:") && !out.includes("{book:")) return out;
  let token = friend.token;
  if (!token) {
    token = newFriendToken();
    await db.lineFriend.update({ where: { id: friend.id }, data: { token } });
  }
  const linkCodes = [...new Set([...out.matchAll(/\{link:([^}]+)\}/g)].map((m) => m[1].trim()))];
  if (linkCodes.length > 0) {
    const links = await db.lineLink.findMany({ where: { accountId: friend.accountId, code: { in: linkCodes } }, select: { code: true } });
    for (const l of links) out = out.replace(new RegExp(`\\{link:\\s*${escapeRe(l.code)}\\s*\\}`, "g"), `${appBase()}/l/${token}/${encodeURIComponent(l.code)}`);
  }
  const formCodes = [...new Set([...out.matchAll(/\{form:([^}]+)\}/g)].map((m) => m[1].trim()))];
  if (formCodes.length > 0) {
    const forms = await db.lineForm.findMany({ where: { accountId: friend.accountId, code: { in: formCodes }, isActive: true }, select: { code: true } });
    for (const f of forms) out = out.replace(new RegExp(`\\{form:\\s*${escapeRe(f.code)}\\s*\\}`, "g"), `${appBase()}/f/${token}/${encodeURIComponent(f.code)}`);
  }
  // {book:slug} → 相手ごとの予約URL（この拠点の枠、本部は共通枠）
  const bookSlugs = [...new Set([...out.matchAll(/\{book:([^}]+)\}/g)].map((m) => m[1].trim()))];
  if (bookSlugs.length > 0) {
    const types = await db.bookingType.findMany({
      where: { slug: { in: bookSlugs }, isActive: true, ...(await bookingTypeScope(friend.accountId)) },
      select: { slug: true },
    });
    for (const t of types) out = out.replace(new RegExp(`\\{book:\\s*${escapeRe(t.slug)}\\s*\\}`, "g"), `${appBase()}/book/${t.slug}?t=${token}`);
  }
  return out;
}

/** このLINEアカウントが使える予約枠の条件（拠点=自分の枠／本部=共通枠＋自分の枠） */
export async function bookingTypeScope(accountId: string): Promise<{ OR: { lineAccountId: string | null }[] }> {
  const acc = await db.lineAccount.findUnique({ where: { id: accountId }, select: { branchId: true } });
  return acc?.branchId ? { OR: [{ lineAccountId: accountId }] } : { OR: [{ lineAccountId: accountId }, { lineAccountId: null }] };
}

function tokenOf(account: LineAccount): string {
  return decryptSecret(account.accessTokenEnc);
}

async function logOut(
  friendId: string,
  body: string,
  sentVia: string,
  sentByUserId?: string | null,
): Promise<void> {
  await db.$transaction([
    db.lineMessage.create({
      data: { friendId, direction: "OUT", type: "text", text: body, sentVia, sentByUserId: sentByUserId ?? null },
    }),
    db.lineFriend.update({ where: { id: friendId }, data: { lastOutboundAt: new Date() } }),
  ]);
}

// ---------------------------------------------------------------
// シナリオ登録
// ---------------------------------------------------------------
export async function enrollInScenario(friend: LineFriend, scenarioId: string): Promise<void> {
  const first = await db.lineScenarioStep.findFirst({ where: { scenarioId }, orderBy: { order: "asc" } });
  const startedAt = new Date();
  await db.lineScenarioEnrollment.upsert({
    where: { friendId_scenarioId: { friendId: friend.id, scenarioId } },
    create: {
      friendId: friend.id,
      scenarioId,
      startedAt,
      nextOrder: first?.order ?? 1,
      nextRunAt: first ? computeStepRunAt(startedAt, first) : null,
      status: first ? "ACTIVE" : "DONE",
    },
    // 既に登録済みなら最初からやり直す
    update: {
      startedAt,
      nextOrder: first?.order ?? 1,
      nextRunAt: first ? computeStepRunAt(startedAt, first) : null,
      status: first ? "ACTIVE" : "DONE",
      finishedAt: null,
    },
  });
}

/** タグが付いたときに TAG トリガーのシナリオを開始 */
export async function enrollByTags(friend: LineFriend, newTags: string[]): Promise<void> {
  if (newTags.length === 0) return;
  const scenarios = await db.lineScenario.findMany({
    where: { accountId: friend.accountId, isActive: true, trigger: "TAG", triggerTag: { in: newTags } },
    select: { id: true },
  });
  for (const s of scenarios) await enrollInScenario(friend, s.id);
  applyRichMenuRules(friend.id).catch((e) => console.error("[line] richmenu apply failed", e));
}

// ---------------------------------------------------------------
// 流入枠（セミナー等）
//   自動タグの時間帯 = 開始30分前 〜 終了2時間後
//   1通目のクイックリプライ候補 = askOnFollow かつ（時間帯未設定 or 終了後3日以内）
// ---------------------------------------------------------------
const EP_BEFORE_MS = 30 * 60 * 1000;
const EP_AFTER_MS = 2 * 60 * 60 * 1000;
const EP_ASK_GRACE_MS = 3 * 24 * 60 * 60 * 1000;

export function entryPointWindow(ep: Pick<LineEntryPoint, "startsAt" | "endsAt">): { start: Date; end: Date } | null {
  if (!ep.startsAt) return null;
  const end = ep.endsAt ?? new Date(ep.startsAt.getTime() + 2 * 60 * 60 * 1000);
  return { start: new Date(ep.startsAt.getTime() - EP_BEFORE_MS), end: new Date(end.getTime() + EP_AFTER_MS) };
}

function epMatchesNow(ep: LineEntryPoint, now: Date): boolean {
  const w = entryPointWindow(ep);
  return !!w && now >= w.start && now <= w.end;
}

function epAskable(ep: LineEntryPoint, now: Date): boolean {
  if (!ep.askOnFollow) return false;
  const w = entryPointWindow(ep);
  if (!w) return true; // 時間帯なし＝常設（広告など）
  return now >= w.start && now <= new Date(w.end.getTime() + EP_ASK_GRACE_MS);
}

/** 友だち追加時：時間帯に合う枠へ自動で紐づけ、タグを付ける */
async function attributeEntryPoint(friend: LineFriend, eps: LineEntryPoint[], now: Date): Promise<LineFriend> {
  const hit = eps.find((ep) => epMatchesNow(ep, now));
  if (!hit) return friend;
  return applyEntryPoint(friend, hit);
}

async function applyEntryPoint(friend: LineFriend, ep: LineEntryPoint): Promise<LineFriend> {
  const alreadyTagged = friend.tags.includes(ep.tag);
  await db.lineFriend.update({ where: { id: friend.id }, data: { source: ep.name } });
  const updated = (alreadyTagged ? await db.lineFriend.findUnique({ where: { id: friend.id } }) : await addFriendTags(friend.id, [ep.tag])) ?? friend;
  if (!alreadyTagged) {
    await db.lineEntryPoint.update({ where: { id: ep.id }, data: { followCount: { increment: 1 } } });
    await enrollByTags(updated, [ep.tag]);
  }
  return updated;
}

/** 1通目に付けるクイックリプライ（候補が無ければ undefined） */
function entryPointQuickReply(eps: LineEntryPoint[], now: Date): Record<string, unknown> | undefined {
  const items = eps.filter((ep) => epAskable(ep, now)).slice(0, 12);
  if (items.length === 0) return undefined;
  return {
    items: [
      ...items.map((ep) => ({
        type: "action",
        action: {
          type: "postback",
          label: ep.name.slice(0, 20),
          data: `ep=${ep.id}`,
          displayText: ep.name,
        },
      })),
      { type: "action", action: { type: "postback", label: "その他", data: "ep=other", displayText: "その他" } },
    ],
  };
}

// ---------------------------------------------------------------
// Webhook イベント処理
// ---------------------------------------------------------------
type WebhookEvent = {
  type: string;
  replyToken?: string;
  timestamp?: number;
  source?: { type: string; userId?: string };
  message?: { id: string; type: string; text?: string; stickerId?: string; packageId?: string };
  postback?: { data: string };
};

async function upsertFriend(account: LineAccount, userId: string): Promise<LineFriend> {
  const existing = await db.lineFriend.findUnique({
    where: { accountId_lineUserId: { accountId: account.id, lineUserId: userId } },
  });
  if (existing) return existing;
  const profile = await getProfile(tokenOf(account), userId).catch(() => null);
  return db.lineFriend.create({
    data: {
      accountId: account.id,
      lineUserId: userId,
      token: newFriendToken(),
      displayName: profile?.displayName ?? null,
      pictureUrl: profile?.pictureUrl ?? null,
      statusMessage: profile?.statusMessage ?? null,
    },
  });
}

export async function handleWebhookEvents(account: LineAccount, events: WebhookEvent[]): Promise<void> {
  await db.lineAccount.update({
    where: { id: account.id },
    data: { webhookLastAt: new Date(), webhookErrorAt: null, webhookError: null },
  });

  for (const ev of events) {
    const userId = ev.source?.userId;
    if (!userId || ev.source?.type !== "user") continue; // グループ/ルームは対象外
    try {
      if (ev.type === "follow") await onFollow(account, userId, ev.replyToken);
      else if (ev.type === "unfollow") await onUnfollow(account, userId);
      else if (ev.type === "message") await onMessage(account, userId, ev);
      else if (ev.type === "postback") await onPostback(account, userId, ev);
    } catch (e) {
      console.error("[line] event failed", ev.type, e);
    }
  }
}

async function onFollow(account: LineAccount, userId: string, replyToken?: string): Promise<void> {
  const token = tokenOf(account);
  const profile = await getProfile(token, userId).catch(() => null);
  const now = new Date();
  let friend = await db.lineFriend.upsert({
    where: { accountId_lineUserId: { accountId: account.id, lineUserId: userId } },
    create: {
      accountId: account.id,
      lineUserId: userId,
      token: newFriendToken(),
      displayName: profile?.displayName ?? null,
      pictureUrl: profile?.pictureUrl ?? null,
      statusMessage: profile?.statusMessage ?? null,
    },
    update: {
      isFollowing: true,
      followedAt: now,
      unfollowedAt: null,
      displayName: profile?.displayName ?? undefined,
      pictureUrl: profile?.pictureUrl ?? undefined,
    },
  });

  // 流入枠（セミナー等）：時間帯で自動紐づけ。確認用のボタンも1通目に付ける
  const entryPoints = await db.lineEntryPoint.findMany({ where: { accountId: account.id, isActive: true } });
  friend = await attributeEntryPoint(friend, entryPoints, now);
  const quickReply = entryPointQuickReply(entryPoints, now);

  addScore(friend.id, "follow").catch(() => {});
  logEvent(account.id, friend.id, "follow").catch(() => {});

  // 友だち追加で始まるシナリオに登録
  const scenarios = await db.lineScenario.findMany({
    where: { accountId: account.id, isActive: true, trigger: "FOLLOW" },
    select: { id: true },
  });
  for (const s of scenarios) await enrollInScenario(friend, s.id);

  // あいさつ ＋ 即時ステップは reply（無料枠）でまとめて送る
  const immediate = await dueStepsFor(friend.id);
  const messages: LineMessageObject[] = [];
  const logs: { body: string; via: string }[] = [];
  if (account.greetingText?.trim()) {
    const body = await renderForFriend(account.greetingText, friend);
    messages.push(text(body));
    logs.push({ body, via: "greeting" });
  }
  const advances: { id: string; step: LineScenarioStep }[] = [];
  for (const { enrollment, step } of immediate.slice(0, 4)) {
    const body = await renderForFriend(step.text, friend);
    messages.push(text(body));
    logs.push({ body, via: `scenario:${step.id}` });
    advances.push({ id: enrollment.id, step });
  }
  if (messages.length === 0 && quickReply) {
    const ask = "ご参加のセミナー（きっかけ）をお選びください。";
    messages.push(text(ask));
    logs.push({ body: ask, via: "greeting" });
  }
  if (messages.length === 0) return;
  if (quickReply) messages[messages.length - 1] = { ...messages[messages.length - 1], quickReply };

  if (replyToken) {
    try {
      await replyMessage(token, replyToken, messages);
    } catch {
      await pushMessage(token, userId, messages);
    }
  } else {
    await pushMessage(token, userId, messages);
  }
  // 送れたものだけ「送信済」にする
  for (const l of logs) await logOut(friend.id, l.body, l.via);
  for (const a of advances) await advanceEnrollment(a.id, a.step);
}

async function onUnfollow(account: LineAccount, userId: string): Promise<void> {
  const friend = await db.lineFriend.findUnique({
    where: { accountId_lineUserId: { accountId: account.id, lineUserId: userId } },
  });
  if (!friend) return;
  logEvent(account.id, friend.id, "unfollow").catch(() => {});
  await db.$transaction([
    db.lineFriend.update({ where: { id: friend.id }, data: { isFollowing: false, unfollowedAt: new Date() } }),
    db.lineScenarioEnrollment.updateMany({
      where: { friendId: friend.id, status: "ACTIVE" },
      data: { status: "STOPPED", finishedAt: new Date() },
    }),
  ]);
}

async function onMessage(account: LineAccount, userId: string, ev: WebhookEvent): Promise<void> {
  let friend = await upsertFriend(account, userId);
  const m = ev.message!;
  // LINEの再送で同じメッセージが二重に届いた場合は捨てる
  if (m.id && (await db.lineMessage.findFirst({ where: { friendId: friend.id, lineMessageId: m.id }, select: { id: true } }))) return;
  const body =
    m.type === "text" ? (m.text ?? "") : m.type === "sticker" ? "（スタンプ）" : `（${m.type}）`;
  await db.$transaction([
    db.lineMessage.create({
      data: {
        friendId: friend.id,
        direction: "IN",
        type: m.type,
        text: body,
        lineMessageId: m.id,
        payload: ev as object,
      },
    }),
    db.lineFriend.update({
      where: { id: friend.id },
      data: { lastInboundAt: new Date(), unreadCount: { increment: 1 }, isFollowing: true },
    }),
  ]);

  // 返信は replyToken 1回にまとめる（合言葉の即時ステップ＋自動返信＋キーワード返信・最大5通）
  const replies: { body: string; via: string }[] = [];
  const advances: { id: string; step: LineScenarioStep }[] = [];

  // 合言葉：流入枠のQR（oaMessage URL）から送られた文が一致したら、その枠に紐づけてタグを付ける
  //   → 「タグが付いたら開始」の0日後ステップは replyToken（無料枠）で一緒に返す
  if (m.type === "text" && body) {
    const eps = await db.lineEntryPoint.findMany({ where: { accountId: account.id, isActive: true, keyword: { not: null } } });
    const norm = body.replace(/\s+/g, "");
    const ep = eps.find((e) => e.keyword && norm.includes(e.keyword.replace(/\s+/g, "")));
    if (ep) {
      friend = await applyEntryPoint(friend, ep);
      for (const { enrollment, step } of (await dueStepsFor(friend.id)).slice(0, 3)) {
        replies.push({ body: await renderForFriend(step.text, friend), via: `scenario:${step.id}` });
        advances.push({ id: enrollment.id, step });
      }
    }
  }

  if (account.autoReplyText?.trim()) {
    replies.push({ body: await renderForFriend(account.autoReplyText, friend), via: "auto" });
  }

  // キーワードルール：本文に含まれていればタグ付与＋返信
  if (m.type === "text" && body) {
    const rules = await db.lineKeywordRule.findMany({ where: { accountId: account.id, isActive: true } });
    const lower = body.toLowerCase();
    const hit = rules.filter((r) => r.keyword && lower.includes(r.keyword.toLowerCase()));
    if (hit.length > 0) {
      const fresh = [...new Set(hit.flatMap((r) => r.addTags))].filter((t) => !friend.tags.includes(t));
      if (fresh.length > 0) {
        const updated = await addFriendTags(friend.id, fresh);
        if (updated) await enrollByTags(updated, fresh);
      }
      await db.lineKeywordRule.updateMany({ where: { id: { in: hit.map((r) => r.id) } }, data: { hitCount: { increment: 1 } } });
      for (const r of hit) {
        if (r.replyText?.trim()) replies.push({ body: await renderForFriend(r.replyText, friend), via: `keyword:${r.id}` });
      }
    }
  }

  if (replies.length > 0 && ev.replyToken) {
    const batch = replies.slice(0, 5);
    await replyMessage(tokenOf(account), ev.replyToken, batch.map((r) => text(r.body)));
    for (const r of batch) await logOut(friend.id, r.body, r.via);
    for (const a of advances) if (batch.some((r) => r.via === `scenario:${a.step.id}`)) await advanceEnrollment(a.id, a.step);
  }

  addScore(friend.id, "message").catch(() => {});
  logEvent(account.id, friend.id, "message").catch(() => {});

  // 新着通知：未読が0→1になった時だけ（連投で通知を埋めない）。ミュート中は出さない
  if (friend.unreadCount === 0 && !friend.mutedAt) {
    notifyNewInbound(account, friend, body).catch((e) => console.error("[line] notify failed", e));
  }
}

/** 担当者（拠点ユーザー／本部アカウントならADMIN）へ新着を通知 */
async function notifyNewInbound(account: LineAccount, friend: LineFriend, body: string): Promise<void> {
  const users = await db.user.findMany({
    where: account.branchId
      ? { isActive: true, OR: [{ branchId: account.branchId }, { branchId2: account.branchId }] }
      : { isActive: true, role: "ADMIN" },
    select: { id: true },
  });
  const title = `LINE: ${friend.displayName ?? "友だち"} さんから新着`;
  const message = body.slice(0, 80);
  const linkUrl = `/dashboard/line/${account.id}/chat/${friend.id}`;
  await Promise.all(
    users.map((u) => createInAppNotification({ userId: u.id, type: "LINE_MESSAGE", title, message, linkUrl })),
  );
}

/** ポストバック data は "tag=xxx" 形式ならタグ付け（Phase 2 のリッチメニュー用に先に受ける） */
async function onPostback(account: LineAccount, userId: string, ev: WebhookEvent): Promise<void> {
  let friend = await upsertFriend(account, userId);
  const data = ev.postback?.data ?? "";
  const params = new URLSearchParams(data);
  let say = params.get("say");
  let url = params.get("url");
  let tags = (params.get("tag") ?? "").split(",").map((t) => t.trim()).filter(Boolean);

  // リッチメニュー：m=<menuId>&i=<index> から DB のボタン設定を復元（postback data の300バイト制限対策）
  const menuId = params.get("m");
  const areaIdx = params.get("i");
  if (menuId && areaIdx !== null) {
    const menu = await db.lineRichMenu.findFirst({ where: { id: menuId, accountId: account.id }, select: { areas: true } });
    const area = menu ? parseRichMenuAreas(menu.areas)[Number(areaIdx)] : undefined;
    if (area) {
      tags = [...new Set([...tags, ...area.tags])];
      if (area.type === "uri") url = area.value;
      else say = area.value || area.label;
    }
  }
  const epParam = params.get("ep");
  const epRow = epParam && epParam !== "other" ? await db.lineEntryPoint.findFirst({ where: { id: epParam, accountId: account.id } }) : null;

  // ボタンの文言はチャットに「相手の発言」として残す（担当者が気づけるように）
  const shown = say || (epRow ? epRow.name : epParam === "other" ? "その他" : url ? `「${url}」を開く` : data);
  await db.$transaction([
    db.lineMessage.create({
      data: { friendId: friend.id, direction: "IN", type: say ? "text" : "postback", text: shown, payload: ev as object },
    }),
    db.lineFriend.update({ where: { id: friend.id }, data: { lastInboundAt: new Date(), ...(say ? { unreadCount: { increment: 1 } } : {}) } }),
  ]);
  if (say && friend.unreadCount === 0 && !friend.mutedAt) {
    notifyNewInbound(account, friend, say).catch(() => {});
  }
  addScore(friend.id, "postback", say ?? undefined).catch(() => {});
  logEvent(account.id, friend.id, "postback", say ?? undefined).catch(() => {});

  if (epRow) {
    await applyEntryPoint(friend, epRow);
    return;
  }
  const fresh = tags.filter((t) => !friend.tags.includes(t));
  if (fresh.length > 0) {
    friend = (await addFriendTags(friend.id, fresh)) ?? friend;
    await enrollByTags(friend, fresh);
  }
  // URL付き：タグを付けたうえで、開くためのリンクを返信（同じURLの計測リンクがあれば相手ごとの計測URLにする）
  if (url && ev.replyToken) {
    let target = url;
    const link = await db.lineLink.findFirst({ where: { accountId: account.id, url } });
    if (link) target = await renderForFriend(`{link:${link.code}}`, friend);
    const body = `こちらからどうぞ\n${target}`;
    await replyMessage(tokenOf(account), ev.replyToken, [text(body)]);
    await logOut(friend.id, body, "richmenu");
  }
}

// ---------------------------------------------------------------
// シナリオ実行
// ---------------------------------------------------------------
type Due = {
  enrollment: { id: string; friendId: string; scenarioId: string; nextOrder: number };
  step: LineScenarioStep;
};

async function dueStepsFor(friendId: string): Promise<Due[]> {
  const now = new Date();
  const enrollments = await db.lineScenarioEnrollment.findMany({
    where: { friendId, status: "ACTIVE", nextRunAt: { lte: now } },
  });
  const out: Due[] = [];
  for (const en of enrollments) {
    const step = await db.lineScenarioStep.findUnique({
      where: { scenarioId_order: { scenarioId: en.scenarioId, order: en.nextOrder } },
    });
    if (step) out.push({ enrollment: en, step });
  }
  return out;
}

async function advanceEnrollment(enrollmentId: string, step: LineScenarioStep): Promise<void> {
  const next = await db.lineScenarioStep.findFirst({
    where: { scenarioId: step.scenarioId, order: { gt: step.order } },
    orderBy: { order: "asc" },
  });
  const en = await db.lineScenarioEnrollment.findUnique({ where: { id: enrollmentId } });
  if (!en) return;
  if (step.addTags.length > 0) {
    const friend = await db.lineFriend.findUnique({ where: { id: en.friendId } });
    if (friend) {
      const fresh = step.addTags.filter((t) => !friend.tags.includes(t));
      if (fresh.length > 0) {
        const updated = await addFriendTags(friend.id, fresh);
        if (updated) await enrollByTags(updated, fresh);
      }
    }
  }
  await db.lineScenarioEnrollment.update({
    where: { id: enrollmentId },
    data: next
      ? { nextOrder: next.order, nextRunAt: computeStepRunAt(en.startedAt, next) }
      : { status: "DONE", nextRunAt: null, finishedAt: new Date() },
  });
}

/** 配信: 期限の来たステップを送る（1回の実行で最大 limit 件・各件を原子的にクレームして二重送信を防ぐ） */
export async function runScenarioTick(limit = 200): Promise<{ sent: number; failed: number }> {
  const now = new Date();
  const due = await db.lineScenarioEnrollment.findMany({
    where: {
      status: "ACTIVE",
      nextRunAt: { lte: now },
      friend: { isFollowing: true, mutedAt: null, account: { isActive: true } },
      scenario: { isActive: true },
    },
    include: { friend: { include: { account: true } } },
    take: limit,
    orderBy: { nextRunAt: "asc" },
  });
  let sent = 0;
  let failed = 0;
  for (const en of due) {
    // クレーム：同じ行を別プロセスが同時に拾っても片方だけが進む
    const claimed = await db.lineScenarioEnrollment.updateMany({
      where: { id: en.id, status: "ACTIVE", nextRunAt: en.nextRunAt },
      data: { nextRunAt: new Date(now.getTime() + 60 * 60 * 1000) },
    });
    if (claimed.count === 0) continue;

    const step = await db.lineScenarioStep.findUnique({
      where: { scenarioId_order: { scenarioId: en.scenarioId, order: en.nextOrder } },
    });
    if (!step) {
      await db.lineScenarioEnrollment.update({
        where: { id: en.id },
        data: { status: "DONE", nextRunAt: null, finishedAt: now },
      });
      continue;
    }
    const account = en.friend.account;
    const body = await renderForFriend(step.text, en.friend);
    try {
      await pushMessage(tokenOf(account), en.friend.lineUserId, [text(body)]);
      await logOut(en.friendId, body, `scenario:${step.id}`);
      await advanceEnrollment(en.id, step);
      sent++;
    } catch (e) {
      failed++;
      console.error("[line] scenario push failed", en.id, e);
      // ブロック等で届かない相手は止める。それ以外はクレーム時に入れた1時間後に再試行
      if (e instanceof LineApiError && (e.status === 404 || e.status === 400)) {
        await db.lineScenarioEnrollment.update({
          where: { id: en.id },
          data: { status: "STOPPED", nextRunAt: null, finishedAt: now },
        });
      }
    }
  }
  return { sent, failed };
}

/** ミュート解除などで溜まった過去分を、いま起点で組み直す（連射防止） */
export async function rescheduleOverdueEnrollments(friendId: string): Promise<void> {
  const now = new Date();
  const list = await db.lineScenarioEnrollment.findMany({ where: { friendId, status: "ACTIVE", nextRunAt: { lt: now } } });
  for (const en of list) {
    const step = await db.lineScenarioStep.findUnique({ where: { scenarioId_order: { scenarioId: en.scenarioId, order: en.nextOrder } } });
    if (!step) continue;
    await db.lineScenarioEnrollment.update({ where: { id: en.id }, data: { startedAt: now, nextRunAt: computeStepRunAt(now, step) } });
  }
}

// ---------------------------------------------------------------
// 一斉配信
// ---------------------------------------------------------------
export function broadcastTargetWhere(accountId: string, filterTags: string[], excludeTags: string[]) {
  return {
    accountId,
    isFollowing: true,
    mutedAt: null,
    ...(filterTags.length > 0 ? { tags: { hasSome: filterTags } } : {}),
    ...(excludeTags.length > 0 ? { NOT: { tags: { hasSome: excludeTags } } } : {}),
  };
}

export async function runBroadcasts(): Promise<{ processed: number }> {
  const now = new Date();
  // 送信中のまま30分以上止まっているもの（プロセス落ち等）は失敗扱いにして固まりを解く
  await db.lineBroadcast.updateMany({
    where: { status: "SENDING", updatedAt: { lt: new Date(now.getTime() - 30 * 60 * 1000) } },
    data: { status: "FAILED", error: "送信中に中断されました（再作成してください）" },
  });
  const due = await db.lineBroadcast.findMany({
    where: { status: "SCHEDULED", scheduledAt: { lte: now }, account: { isActive: true } },
    include: { account: true },
    take: 20,
  });
  for (const b of due) {
    // 二重送信防止：先に SENDING に切り替えられた1件だけ送る
    const claimed = await db.lineBroadcast.updateMany({
      where: { id: b.id, status: "SCHEDULED" },
      data: { status: "SENDING" },
    });
    if (claimed.count === 0) continue;

    const friends = await db.lineFriend.findMany({
      where: broadcastTargetWhere(b.accountId, b.filterTags, b.excludeTags),
      select: { id: true, lineUserId: true, displayName: true, token: true, accountId: true },
    });
    const personalized = b.text.includes("{");
    const rendered = new Map<string, string>();
    for (const f of friends) rendered.set(f.id, personalized ? await renderForFriend(b.text, f) : b.text);
    let sent = 0;
    let failedCount = 0;
    let error: string | null = null;
    try {
      const token = tokenOf(b.account);
      // 差し込みがある本文は個別push、なければ multicast で1回
      if (personalized) {
        for (const f of friends) {
          try {
            await pushMessage(token, f.lineUserId, [text(rendered.get(f.id) ?? b.text)]);
            sent++;
          } catch {
            failedCount++;
          }
        }
      } else if (friends.length > 0) {
        await multicastMessage(
          token,
          friends.map((f) => f.lineUserId),
          [text(b.text)],
        );
        sent = friends.length;
      }
      if (friends.length > 0) {
        await db.lineMessage.createMany({
          data: friends.map((f) => ({
            friendId: f.id,
            direction: "OUT" as const,
            type: "text",
            text: rendered.get(f.id) ?? b.text,
            sentVia: `broadcast:${b.id}`,
          })),
        });
        await db.lineFriend.updateMany({
          where: { id: { in: friends.map((f) => f.id) } },
          data: { lastOutboundAt: now },
        });
      }
    } catch (e) {
      error = e instanceof Error ? e.message : String(e);
      console.error("[line] broadcast failed", b.id, e);
    }
    await db.lineBroadcast.update({
      where: { id: b.id },
      data: {
        status: error ? "FAILED" : "SENT",
        targetCount: friends.length,
        sentCount: sent,
        failedCount,
        sentAt: now,
        error,
      },
    });
  }
  return { processed: due.length };
}

// ---------------------------------------------------------------
// 手動送信（OSのチャット画面から）
// ---------------------------------------------------------------
export async function sendManual(account: LineAccount, friend: LineFriend, body: string, userId: string): Promise<void> {
  const rendered = await renderForFriend(body, friend);
  await pushMessage(tokenOf(account), friend.lineUserId, [text(rendered)]);
  await logOut(friend.id, rendered, "manual", userId);
}

// ---------------------------------------------------------------
// 計測リンクのクリック
// ---------------------------------------------------------------
export async function recordLinkClick(token: string, code: string): Promise<string | null> {
  const friend = await db.lineFriend.findUnique({ where: { token } });
  if (!friend) return null;
  const link = await db.lineLink.findUnique({ where: { accountId_code: { accountId: friend.accountId, code } } });
  if (!link) return null;
  await db.$transaction([
    db.lineLinkClick.create({ data: { linkId: link.id, friendId: friend.id } }),
    db.lineLink.update({ where: { id: link.id }, data: { clickCount: { increment: 1 } } }),
    db.lineMessage.create({
      data: { friendId: friend.id, direction: "IN", type: "click", text: `リンク「${link.label}」をクリック`, sentVia: `link:${link.id}` },
    }),
  ]);
  const fresh = link.addTags.filter((t) => !friend.tags.includes(t));
  if (fresh.length > 0) {
    const updated = await addFriendTags(friend.id, fresh);
    if (updated) await enrollByTags(updated, fresh);
  }
  addScore(friend.id, "click", link.label).catch(() => {});
  logEvent(friend.accountId, friend.id, "click", link.id).catch(() => {});
  // 転送先がOSの予約ページなら、相手トークンを付けて予約を友だちに紐づける
  const base = appBase();
  if (base && link.url.startsWith(`${base}/book/`) && !link.url.includes("t=")) {
    return `${link.url}${link.url.includes("?") ? "&" : "?"}t=${token}`;
  }
  return link.url;
}

/** リンク先URLだけ返す（プレビュー用クローラなど、記録しない場合） */
export async function resolveLinkUrl(token: string, code: string): Promise<string | null> {
  const friend = await db.lineFriend.findUnique({ where: { token }, select: { accountId: true } });
  if (!friend) return null;
  const link = await db.lineLink.findUnique({ where: { accountId_code: { accountId: friend.accountId, code } }, select: { url: true } });
  return link?.url ?? null;
}


// ---------------------------------------------------------------
// 回答フォーム
// ---------------------------------------------------------------
export type FormField = {
  key: string;
  label: string;
  type: "text" | "textarea" | "select" | "checkbox" | "date" | "tel" | "email";
  required: boolean;
  options?: string[];
};

export function parseFormFields(raw: unknown): FormField[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .map((f) => f as Partial<FormField>)
    .filter((f) => f && typeof f.key === "string" && typeof f.label === "string")
    .map((f) => ({
      key: f.key as string,
      label: f.label as string,
      type: (["text", "textarea", "select", "checkbox", "date", "tel", "email"].includes(f.type as string) ? f.type : "text") as FormField["type"],
      required: !!f.required,
      options: Array.isArray(f.options) ? f.options.map(String) : undefined,
    }));
}

export async function submitFormResponse(
  token: string,
  code: string,
  answers: Record<string, string | string[]>,
): Promise<{ ok: true; thankYou: string | null } | { ok: false; error: string }> {
  const friend = await db.lineFriend.findUnique({ where: { token }, include: { account: true } });
  if (!friend) return { ok: false, error: "このフォームのリンクは無効です" };
  const form = await db.lineForm.findUnique({ where: { accountId_code: { accountId: friend.accountId, code } } });
  if (!form || !form.isActive) return { ok: false, error: "このフォームは受付を終了しています" };

  const fields = parseFormFields(form.fields);
  const clean: Record<string, string | string[]> = {};
  for (const f of fields) {
    const v = answers[f.key];
    const val = Array.isArray(v) ? v.map((x) => String(x).slice(0, 500)).slice(0, 50) : String(v ?? "").slice(0, 2000);
    const empty = Array.isArray(val) ? val.length === 0 : val.trim() === "";
    if (f.required && empty) return { ok: false, error: `「${f.label}」を入力してください` };
    clean[f.key] = val;
  }

  const summary = fields
    .map((f) => {
      const v = clean[f.key];
      const shown = Array.isArray(v) ? v.join("、") : v;
      return shown ? `${f.label}: ${shown}` : null;
    })
    .filter(Boolean)
    .join("\n");

  await db.$transaction([
    db.lineFormResponse.create({ data: { formId: form.id, friendId: friend.id, answers: clean } }),
    db.lineForm.update({ where: { id: form.id }, data: { responseCount: { increment: 1 } } }),
    db.lineMessage.create({
      data: { friendId: friend.id, direction: "IN", type: "form", text: `フォーム「${form.title}」に回答\n${summary}`, sentVia: `form:${form.id}` },
    }),
    db.lineFriend.update({ where: { id: friend.id }, data: { lastInboundAt: new Date() } }),
  ]);

  const fresh = form.addTags.filter((t) => !friend.tags.includes(t));
  if (fresh.length > 0) {
    const updated = await addFriendTags(friend.id, fresh);
    if (updated) await enrollByTags(updated, fresh);
  }

  addScore(friend.id, "form", form.title).catch(() => {});
  logEvent(friend.accountId, friend.id, "form", form.id).catch(() => {});
  const thankYou = form.thankYouText?.trim() ? await renderForFriend(form.thankYouText, friend) : null;
  if (thankYou && friend.isFollowing && friend.account.isActive) {
    try {
      await pushMessage(tokenOf(friend.account), friend.lineUserId, [text(thankYou)]);
      await logOut(friend.id, thankYou, `form:${form.id}`);
    } catch (e) {
      console.error("[line] form thank-you push failed", e);
    }
  }
  notifyNewInbound(friend.account, friend, `フォーム「${form.title}」に回答`).catch(() => {});
  return { ok: true, thankYou };
}

// ---------------------------------------------------------------
// リッチメニュー
// ---------------------------------------------------------------
export const RICH_MENU_LAYOUTS: Record<string, { width: number; height: number; cols: number; rows: number; label: string }> = {
  L6: { width: 2500, height: 1686, cols: 3, rows: 2, label: "大・6分割（3×2）" },
  L4: { width: 2500, height: 1686, cols: 2, rows: 2, label: "大・4分割（2×2）" },
  L3: { width: 2500, height: 1686, cols: 3, rows: 1, label: "大・3分割（横並び）" },
  L2: { width: 2500, height: 1686, cols: 2, rows: 1, label: "大・2分割（横並び）" },
  L1: { width: 2500, height: 1686, cols: 1, rows: 1, label: "大・1枚" },
  S3: { width: 2500, height: 843, cols: 3, rows: 1, label: "小・3分割" },
  S2: { width: 2500, height: 843, cols: 2, rows: 1, label: "小・2分割" },
  S1: { width: 2500, height: 843, cols: 1, rows: 1, label: "小・1枚" },
};

export type RichMenuAreaInput = { type: "uri" | "message"; value: string; label: string; tags: string[] };

export function parseRichMenuAreas(raw: unknown): RichMenuAreaInput[] {
  if (!Array.isArray(raw)) return [];
  return raw.map((a) => {
    const o = (a ?? {}) as { type?: string; value?: unknown; label?: unknown; tags?: unknown };
    const tags = Array.isArray(o.tags) ? o.tags.map(String).filter(Boolean) : [];
    // 旧形式「タグを付ける」→ メッセージなし・タグのみ
    if (o.type === "tag") return { type: "message", value: "", label: String(o.label ?? ""), tags: [String(o.value ?? ""), ...tags].filter(Boolean) };
    const type: RichMenuAreaInput["type"] = o.type === "message" ? "message" : "uri";
    return { type, value: String(o.value ?? ""), label: String(o.label ?? ""), tags };
  });
}

/** レイアウトと各ボタンの設定から LINE の areas を組む */
export function buildRichMenuAreas(layout: string, inputs: RichMenuAreaInput[], menuId?: string): RichMenuArea[] {
  const L = RICH_MENU_LAYOUTS[layout];
  if (!L) throw new Error("unknown layout");
  const cellW = Math.floor(L.width / L.cols);
  const cellH = Math.floor(L.height / L.rows);
  const out: RichMenuArea[] = [];
  for (let r = 0; r < L.rows; r++) {
    for (let c = 0; c < L.cols; c++) {
      const i = r * L.cols + c;
      const a = inputs[i];
      if (!a || (!a.value && a.tags.length === 0)) continue;
      const width = c === L.cols - 1 ? L.width - cellW * c : cellW;
      const height = r === L.rows - 1 ? L.height - cellH * r : cellH;
      const label = (a.label || a.value || a.tags[0]).slice(0, 20);
      // postback data は300バイト上限＝本文を載せず、メニューIDとボタン番号だけ渡して受信時にDBから復元する
      const pb = menuId ? `m=${menuId}&i=${i}` : null;
      let action: Record<string, unknown>;
      if (a.type === "uri") {
        // タグなし＝そのまま開く／タグあり＝postbackでタグを付けてから、返信でURLを渡す（LINEの仕様上ワンタップ増える）
        action = a.tags.length && pb
          ? { type: "postback", label, data: pb, displayText: label }
          : { type: "uri", label, uri: a.value };
      } else {
        action = a.tags.length && pb
          ? { type: "postback", label, data: pb, displayText: a.value.slice(0, 300) || label }
          : { type: "message", label, text: a.value.slice(0, 300) };
      }
      out.push({ bounds: { x: cellW * c, y: cellH * r, width, height }, action });
    }
  }
  return out;
}

/** タグのルールに従って、その友だちのリッチメニューを切り替える（手動で選んだ人は上書きしない） */
export async function applyRichMenuRules(friendId: string): Promise<void> {
  const friend = await db.lineFriend.findUnique({ where: { id: friendId }, include: { account: true } });
  if (!friend || !friend.isFollowing || friend.richMenuPinned) return;
  const menus = await db.lineRichMenu.findMany({
    where: { accountId: friend.accountId, lineRichMenuId: { not: null }, NOT: { ruleTags: { isEmpty: true } } },
    orderBy: { priority: "asc" },
    select: { id: true, lineRichMenuId: true, ruleTags: true },
  });
  const target = menus.find((m) => m.ruleTags.some((t) => friend.tags.includes(t))) ?? null;
  if ((target?.id ?? null) === (friend.richMenuId ?? null)) return;
  const token = tokenOf(friend.account);
  if (target?.lineRichMenuId) await linkRichMenuToUser(token, friend.lineUserId, target.lineRichMenuId);
  else await unlinkRichMenuFromUser(token, friend.lineUserId);
  await db.lineFriend.update({ where: { id: friendId }, data: { richMenuId: target?.id ?? null } });
}

/** 手動で特定メニューにする（null=既定に戻す） */
export async function setFriendRichMenu(friendId: string, menuId: string | null): Promise<void> {
  const friend = await db.lineFriend.findUnique({ where: { id: friendId }, include: { account: true } });
  if (!friend) return;
  const token = tokenOf(friend.account);
  if (menuId) {
    const menu = await db.lineRichMenu.findFirst({ where: { id: menuId, accountId: friend.accountId } });
    if (!menu?.lineRichMenuId) throw new Error("このメニューはまだLINEに登録されていません");
    await linkRichMenuToUser(token, friend.lineUserId, menu.lineRichMenuId);
    await db.lineFriend.update({ where: { id: friendId }, data: { richMenuId: menuId, richMenuPinned: true } });
  } else {
    // 既定に戻す＝手動指定を解除し、タグのルールがあればそれに従う
    await unlinkRichMenuFromUser(token, friend.lineUserId);
    await db.lineFriend.update({ where: { id: friendId }, data: { richMenuId: null, richMenuPinned: false } });
    await applyRichMenuRules(friendId);
  }
}


// ---------------------------------------------------------------
// 予約連携（OS予約システム ↔ LINE友だち）
// ---------------------------------------------------------------
function fmtJstShort(d: Date): string {
  return d.toLocaleString("ja-JP", { timeZone: "Asia/Tokyo", month: "numeric", day: "numeric", weekday: "short", hour: "2-digit", minute: "2-digit" });
}

/** 予約確定時：友だちに紐づけ・タグ・チャット記録・通知 */
export async function recordLineBooking(bookingId: string, friendToken: string): Promise<void> {
  const friend = await db.lineFriend.findUnique({ where: { token: friendToken }, include: { account: true } });
  const booking = await db.booking.findUnique({ where: { id: bookingId }, include: { bookingType: { select: { title: true } } } });
  if (!friend || !booking) return;
  await db.booking.update({ where: { id: bookingId }, data: { lineFriendId: friend.id } });
  const textBody = `予約: ${fmtJstShort(booking.startAt)}〜（${booking.bookingType.title}）${booking.meetUrl ? `\n${booking.meetUrl}` : ""}`;
  await db.$transaction([
    db.lineMessage.create({ data: { friendId: friend.id, direction: "IN", type: "form", text: textBody, sentVia: `booking:${bookingId}` } }),
    db.lineFriend.update({ where: { id: friend.id }, data: { lastInboundAt: new Date() } }),
  ]);
  const updated = await addFriendTags(friend.id, ["予約済"]);
  if (updated && !friend.tags.includes("予約済")) await enrollByTags(updated, ["予約済"]);
  addScore(friend.id, "booking", booking.bookingType.title).catch(() => {});
  logEvent(friend.accountId, friend.id, "booking", booking.id).catch(() => {});
  notifyNewInbound(friend.account, friend, `${fmtJstShort(booking.startAt)} に予約が入りました（${booking.bookingType.title}）`).catch(() => {});
}

/** 予約キャンセル時：チャット記録・タグ */
export async function recordLineBookingCancel(bookingId: string): Promise<void> {
  const booking = await db.booking.findUnique({ where: { id: bookingId }, include: { bookingType: { select: { title: true } } } });
  if (!booking?.lineFriendId) return;
  const friend = await db.lineFriend.findUnique({ where: { id: booking.lineFriendId }, include: { account: true } });
  if (!friend) return;
  await db.lineMessage.create({
    data: { friendId: friend.id, direction: "IN", type: "form", text: `予約キャンセル: ${fmtJstShort(booking.startAt)}（${booking.bookingType.title}）`, sentVia: `booking:${bookingId}` },
  });
  logEvent(friend.accountId, friend.id, "booking_cancel", booking.id).catch(() => {});
  const updated = await addFriendTags(friend.id, ["予約キャンセル"]);
  if (updated && !friend.tags.includes("予約キャンセル")) await enrollByTags(updated, ["予約キャンセル"]);
  notifyNewInbound(friend.account, friend, `予約がキャンセルされました（${fmtJstShort(booking.startAt)}）`).catch(() => {});
}

/** 前日リマインド：翌日の予約（20〜28時間先）にLINEで1回だけ送る */
export async function runBookingReminders(): Promise<{ sent: number }> {
  const now = new Date();
  const from = new Date(now.getTime() + 20 * 60 * 60 * 1000);
  const to = new Date(now.getTime() + 28 * 60 * 60 * 1000);
  const list = await db.booking.findMany({
    where: { status: "CONFIRMED", lineFriendId: { not: null }, reminderSentAt: null, startAt: { gte: from, lte: to } },
    include: { bookingType: { select: { title: true } } },
    take: 100,
  });
  let sent = 0;
  for (const b of list) {
    const claimed = await db.booking.updateMany({ where: { id: b.id, reminderSentAt: null }, data: { reminderSentAt: now } });
    if (claimed.count === 0) continue;
    const friend = await db.lineFriend.findUnique({ where: { id: b.lineFriendId! }, include: { account: true } });
    if (!friend || !friend.isFollowing || friend.mutedAt || !friend.account.isActive) continue;
    const template =
      friend.account.bookingReminderText?.trim() ||
      "明日 {time} からのご予約のリマインドです。\n{title}\n{meet}\n\n当日はどうぞよろしくお願いいたします。";
    const body = renderText(template, friend)
      .replaceAll("{time}", fmtJstShort(b.startAt))
      .replaceAll("{title}", b.bookingType.title)
      .replaceAll("{meet}", b.meetUrl ? `Meet: ${b.meetUrl}` : "")
      .replace(/\n{3,}/g, "\n\n")
      .trim();
    try {
      await pushMessage(tokenOf(friend.account), friend.lineUserId, [text(body)]);
      await logOut(friend.id, body, `booking-reminder:${b.id}`);
      sent++;
    } catch (e) {
      console.error("[line] booking reminder failed", b.id, e);
    }
  }
  return { sent };
}

// ---------------------------------------------------------------
// 行動スコアリング
// ---------------------------------------------------------------
export type ScoreRules = {
  follow: number;
  message: number;
  postback: number;
  click: number;
  form: number;
  booking: number;
  tagPoints: Record<string, number>;
  thresholds: { score: number; tag: string }[];
};

export const DEFAULT_SCORE_RULES: ScoreRules = {
  follow: 1,
  message: 2,
  postback: 1,
  click: 3,
  form: 5,
  booking: 10,
  tagPoints: {},
  thresholds: [{ score: 20, tag: "ホット" }],
};

export function parseScoreRules(raw: unknown): ScoreRules {
  const o = (raw ?? {}) as Partial<ScoreRules> & { tagPoints?: unknown; thresholds?: unknown };
  const num = (v: unknown, d: number) => (typeof v === "number" && Number.isFinite(v) ? Math.max(-100, Math.min(100, Math.round(v))) : d);
  const tagPoints: Record<string, number> = {};
  if (o.tagPoints && typeof o.tagPoints === "object") {
    for (const [k, v] of Object.entries(o.tagPoints as Record<string, unknown>)) if (k) tagPoints[k] = num(v, 0);
  }
  const thresholds = Array.isArray(o.thresholds)
    ? (o.thresholds as { score?: unknown; tag?: unknown }[])
        .map((t) => ({ score: num(t.score, 0), tag: String(t.tag ?? "").trim() }))
        .filter((t) => t.tag && t.score > 0)
        .sort((a, b) => a.score - b.score)
    : DEFAULT_SCORE_RULES.thresholds;
  return {
    follow: num(o.follow, DEFAULT_SCORE_RULES.follow),
    message: num(o.message, DEFAULT_SCORE_RULES.message),
    postback: num(o.postback, DEFAULT_SCORE_RULES.postback),
    click: num(o.click, DEFAULT_SCORE_RULES.click),
    form: num(o.form, DEFAULT_SCORE_RULES.form),
    booking: num(o.booking, DEFAULT_SCORE_RULES.booking),
    tagPoints,
    thresholds,
  };
}

type ScoreEvent = "follow" | "message" | "postback" | "click" | "form" | "booking";

/** 行動に点数を加算し、しきい値に達したらタグを付ける */
export async function addScore(friendId: string, event: ScoreEvent | `tag:${string}`, note?: string): Promise<void> {
  const friend = await db.lineFriend.findUnique({ where: { id: friendId }, include: { account: { select: { scoreRules: true } } } });
  if (!friend) return;
  const rules = parseScoreRules(friend.account.scoreRules);
  const points = event.startsWith("tag:") ? (rules.tagPoints[event.slice(4)] ?? 0) : rules[event as ScoreEvent];
  if (!points) return;
  const rows = (await db.$queryRaw`UPDATE line_friends SET score = score + ${points} WHERE id = ${friendId} RETURNING score`) as { score: number }[];
  await db.lineScoreLog.create({ data: { friendId, event, points, note: note ?? null } });
  const score = rows[0]?.score ?? friend.score + points;
  const reached = rules.thresholds.filter((t) => score >= t.score && !friend.tags.includes(t.tag)).map((t) => t.tag);
  if (reached.length > 0) {
    const updated = await addFriendTags(friendId, reached);
    if (updated) await enrollByTags(updated, reached);
  }
}

// ---------------------------------------------------------------
// 行動イベント（CV管理・流入分析用）
// ---------------------------------------------------------------
const ATTRIBUTION_WINDOW_MS = 7 * 24 * 60 * 60 * 1000;

/** 直前7日以内にその人へ届いた配信（broadcast / scenario）を探してラストタッチとして記録 */
export async function logEvent(accountId: string, friendId: string, type: string, refId?: string | null): Promise<void> {
  try {
    const now = new Date();
    const last = await db.lineMessage.findFirst({
      where: {
        friendId,
        direction: "OUT",
        createdAt: { gte: new Date(now.getTime() - ATTRIBUTION_WINDOW_MS), lte: now },
        OR: [{ sentVia: { startsWith: "broadcast:" } }, { sentVia: { startsWith: "scenario:" } }],
      },
      orderBy: { createdAt: "desc" },
      select: { sentVia: true },
    });
    await db.lineEvent.create({ data: { accountId, friendId, type, refId: refId ?? null, sourceVia: last?.sentVia ?? null } });
  } catch (e) {
    console.error("[line] logEvent failed", type, e);
  }
}

export type Funnel = { reached: number; clicked: number; formed: number; booked: number; converted: number };

/** 配信（broadcast:<id> / scenario:<stepId>）ごとのファネル：到達人数→クリック→回答→予約→成約（人数・重複なし） */
export async function funnelBySource(accountId: string, sources: string[], conversionTag: string): Promise<Map<string, Funnel>> {
  const out = new Map<string, Funnel>();
  if (sources.length === 0) return out;
  const reachedRows = (await db.$queryRaw`
    SELECT m."sentVia" AS via, COUNT(DISTINCT m."friendId")::int AS n
    FROM line_messages m
    WHERE m.direction = 'OUT' AND m."sentVia" = ANY(${sources}::text[])
    GROUP BY m."sentVia"`) as { via: string; n: number }[];
  const evRows = (await db.$queryRaw`
    SELECT e."sourceVia" AS via, e.type AS type, e."refId" AS ref, COUNT(DISTINCT e."friendId")::int AS n
    FROM line_events e
    WHERE e."accountId" = ${accountId} AND e."sourceVia" = ANY(${sources}::text[])
    GROUP BY e."sourceVia", e.type, e."refId"`) as { via: string; type: string; ref: string | null; n: number }[];
  for (const src of sources) out.set(src, { reached: 0, clicked: 0, formed: 0, booked: 0, converted: 0 });
  for (const r of reachedRows) out.get(r.via)!.reached = r.n;
  for (const r of evRows) {
    const f = out.get(r.via);
    if (!f) continue;
    if (r.type === "click") f.clicked = Math.max(f.clicked, r.n);
    else if (r.type === "form") f.formed = Math.max(f.formed, r.n);
    else if (r.type === "booking") f.booked = Math.max(f.booked, r.n);
    else if (r.type === "tag" && r.ref === conversionTag) f.converted = r.n;
  }
  return out;
}