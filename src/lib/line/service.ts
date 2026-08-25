// ==============================================================
// LINE公式アカウント — Webhook処理・シナリオ配信・一斉配信
// ==============================================================

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
  type LineMessageObject,
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

/** 本文の差し込み（{name} だけ対応） */
export function renderText(template: string, friend: Pick<LineFriend, "displayName">): string {
  return template.replaceAll("{name}", friend.displayName ?? "");
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
  const updated = await db.lineFriend.update({
    where: { id: friend.id },
    data: {
      source: ep.name,
      ...(alreadyTagged ? {} : { tags: { push: ep.tag } }),
    },
  });
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
          data: `tag=${encodeURIComponent(ep.tag)}&ep=${ep.id}`,
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
    const body = renderText(account.greetingText, friend);
    messages.push(text(body));
    logs.push({ body, via: "greeting" });
  }
  for (const { enrollment, step } of immediate) {
    const body = renderText(step.text, friend);
    messages.push(text(body));
    logs.push({ body, via: `scenario:${step.id}` });
    await advanceEnrollment(enrollment.id, step);
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
  for (const l of logs) await logOut(friend.id, l.body, l.via);
}

async function onUnfollow(account: LineAccount, userId: string): Promise<void> {
  const friend = await db.lineFriend.findUnique({
    where: { accountId_lineUserId: { accountId: account.id, lineUserId: userId } },
  });
  if (!friend) return;
  await db.$transaction([
    db.lineFriend.update({ where: { id: friend.id }, data: { isFollowing: false, unfollowedAt: new Date() } }),
    db.lineScenarioEnrollment.updateMany({
      where: { friendId: friend.id, status: "ACTIVE" },
      data: { status: "STOPPED", finishedAt: new Date() },
    }),
  ]);
}

async function onMessage(account: LineAccount, userId: string, ev: WebhookEvent): Promise<void> {
  const friend = await upsertFriend(account, userId);
  const m = ev.message!;
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

  // 返信は replyToken 1回にまとめる（自動返信＋キーワード返信・最大5通）
  const replies: { body: string; via: string }[] = [];
  if (account.autoReplyText?.trim()) {
    replies.push({ body: renderText(account.autoReplyText, friend), via: "auto" });
  }

  // キーワードルール：本文に含まれていればタグ付与＋返信
  if (m.type === "text" && body) {
    const rules = await db.lineKeywordRule.findMany({ where: { accountId: account.id, isActive: true } });
    const lower = body.toLowerCase();
    const hit = rules.filter((r) => r.keyword && lower.includes(r.keyword.toLowerCase()));
    if (hit.length > 0) {
      const fresh = [...new Set(hit.flatMap((r) => r.addTags))].filter((t) => !friend.tags.includes(t));
      if (fresh.length > 0) {
        const updated = await db.lineFriend.update({ where: { id: friend.id }, data: { tags: [...friend.tags, ...fresh] } });
        await enrollByTags(updated, fresh);
      }
      await db.lineKeywordRule.updateMany({ where: { id: { in: hit.map((r) => r.id) } }, data: { hitCount: { increment: 1 } } });
      for (const r of hit) {
        if (r.replyText?.trim()) replies.push({ body: renderText(r.replyText, friend), via: `keyword:${r.id}` });
      }
    }
  }

  if (replies.length > 0 && ev.replyToken) {
    const batch = replies.slice(0, 5);
    await replyMessage(tokenOf(account), ev.replyToken, batch.map((r) => text(r.body)));
    for (const r of batch) await logOut(friend.id, r.body, r.via);
  }

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
  const friend = await upsertFriend(account, userId);
  const data = ev.postback?.data ?? "";
  await db.lineMessage.create({
    data: { friendId: friend.id, direction: "IN", type: "postback", text: data, payload: ev as object },
  });
  const params = new URLSearchParams(data);
  const epId = params.get("ep");
  if (epId && epId !== "other") {
    const ep = await db.lineEntryPoint.findFirst({ where: { id: epId, accountId: account.id } });
    if (ep) {
      await applyEntryPoint(friend, ep);
      return;
    }
  }
  const tag = params.get("tag");
  if (tag && !friend.tags.includes(tag)) {
    const updated = await db.lineFriend.update({ where: { id: friend.id }, data: { tags: { push: tag } } });
    await enrollByTags(updated, [tag]);
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
        const updated = await db.lineFriend.update({
          where: { id: friend.id },
          data: { tags: [...friend.tags, ...fresh] },
        });
        await enrollByTags(updated, fresh);
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

/** cron: 期限の来たステップを送る（1回の実行で最大 limit 件） */
export async function runScenarioTick(limit = 200): Promise<{ sent: number; failed: number }> {
  const now = new Date();
  const due = await db.lineScenarioEnrollment.findMany({
    where: { status: "ACTIVE", nextRunAt: { lte: now }, friend: { isFollowing: true, mutedAt: null }, scenario: { isActive: true } },
    include: { friend: { include: { account: true } } },
    take: limit,
    orderBy: { nextRunAt: "asc" },
  });
  let sent = 0;
  let failed = 0;
  for (const en of due) {
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
    if (!account.isActive) continue;
    const body = renderText(step.text, en.friend);
    try {
      await pushMessage(tokenOf(account), en.friend.lineUserId, [text(body)]);
      await logOut(en.friendId, body, `scenario:${step.id}`);
      await advanceEnrollment(en.id, step);
      sent++;
    } catch (e) {
      failed++;
      console.error("[line] scenario push failed", en.id, e);
      // ブロック等で届かない相手は止める。それ以外は次回再試行（1時間後）
      if (e instanceof LineApiError && (e.status === 404 || e.status === 400)) {
        await db.lineScenarioEnrollment.update({
          where: { id: en.id },
          data: { status: "STOPPED", nextRunAt: null, finishedAt: now },
        });
      } else {
        await db.lineScenarioEnrollment.update({
          where: { id: en.id },
          data: { nextRunAt: new Date(now.getTime() + 60 * 60 * 1000) },
        });
      }
    }
  }
  return { sent, failed };
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
  const due = await db.lineBroadcast.findMany({
    where: { status: "SCHEDULED", scheduledAt: { lte: now } },
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
      select: { id: true, lineUserId: true, displayName: true },
    });
    let sent = 0;
    let failedCount = 0;
    let error: string | null = null;
    try {
      const token = tokenOf(b.account);
      // {name} を使う本文は個別push、使わなければ multicast で1回
      if (b.text.includes("{name}")) {
        for (const f of friends) {
          try {
            await pushMessage(token, f.lineUserId, [text(renderText(b.text, f))]);
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
            text: renderText(b.text, f),
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
  await pushMessage(tokenOf(account), friend.lineUserId, [text(body)]);
  await logOut(friend.id, body, "manual", userId);
}
