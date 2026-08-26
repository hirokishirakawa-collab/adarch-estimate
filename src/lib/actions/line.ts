"use server";

// ==============================================================
// LINE公式アカウント — サーバーアクション（接続・友だち・チャット・シナリオ・一斉配信）
// ==============================================================

import { revalidatePath } from "next/cache";
import fs from "node:fs/promises";
import path from "node:path";
import { RICH_MENU_SAMPLES } from "@/lib/line/richmenu-samples";
import { db } from "@/lib/db";
import { logAudit } from "@/lib/audit";
import { encryptSecret, decryptSecret } from "@/lib/line/secret";
import {
  createRichMenu,
  uploadRichMenuImage,
  deleteRichMenu,
  setDefaultRichMenu,
  clearDefaultRichMenu,
  linkRichMenuToUser,
} from "@/lib/line/client";
import { getBotInfo, LineApiError } from "@/lib/line/client";
import { requireSession, getManageableAccount, branchIdForNewAccount } from "@/lib/line/access";
import {
  sendManual,
  enrollInScenario,
  enrollByTags,
  broadcastTargetWhere,
  parseFormFields,
  submitFormResponse,
  RICH_MENU_LAYOUTS,
  parseRichMenuAreas,
  buildRichMenuAreas,
  applyRichMenuRules,
  setFriendRichMenu,
  rescheduleOverdueEnrollments,
  parseScoreRules,
} from "@/lib/line/service";
import type { LineScenarioTrigger } from "@/generated/prisma/client";

type Result = { error?: string; ok?: boolean; id?: string; message?: string };
const BASE = "/dashboard/line";

function str(fd: FormData, key: string): string {
  return ((fd.get(key) as string) ?? "").trim();
}
function tagList(raw: string): string[] {
  return [...new Set(raw.split(/[,、\s]+/).map((t) => t.trim()).filter(Boolean))].slice(0, 30);
}

// ---------------------------------------------------------------
// 接続（作成・更新・削除・接続テスト）
// ---------------------------------------------------------------
export async function saveLineAccount(_prev: Result | null, fd: FormData): Promise<Result> {
  let info;
  try {
    info = await requireSession();
  } catch (e) {
    return { error: (e as Error).message };
  }
  const id = str(fd, "id");
  const name = str(fd, "name");
  const channelId = str(fd, "channelId");
  const channelSecret = str(fd, "channelSecret");
  const accessToken = str(fd, "accessToken");
  const greetingText = str(fd, "greetingText") || null;
  const autoReplyText = str(fd, "autoReplyText") || null;
  const conversionTag = str(fd, "conversionTag").replace(/[,\s]+/g, "_").slice(0, 40) || null;

  if (!name) return { error: "表示名を入れてください" };

  try {
    if (id) {
      const account = await getManageableAccount(info, id);
      if (!account) return { error: "このアカウントを操作する権限がありません" };
      const data: Record<string, unknown> = { name, greetingText, autoReplyText, conversionTag };
      if (channelId) data.channelId = channelId;
      if (channelSecret) data.channelSecretEnc = encryptSecret(channelSecret);
      if (accessToken) data.accessTokenEnc = encryptSecret(accessToken);
      if (accessToken) {
        const bot = await getBotInfo(accessToken);
        data.basicId = bot.basicId;
        data.botDisplayName = bot.displayName;
      }
      await db.lineAccount.update({ where: { id }, data });
      revalidatePath(BASE);
      revalidatePath(`${BASE}/${id}`);
      return { ok: true, id };
    }

    // 新規
    if (!channelId || !channelSecret || !accessToken) {
      return { error: "チャネルID・チャネルシークレット・アクセストークンの3つが必要です" };
    }
    const branchId = branchIdForNewAccount(info);
    if (branchId === undefined) return { error: "拠点が割り当てられていないアカウントでは作成できません" };

    const bot = await getBotInfo(accessToken); // ここで失敗＝トークンが違う
    const created = await db.lineAccount.create({
      data: {
        branchId,
        name,
        channelId,
        channelSecretEnc: encryptSecret(channelSecret),
        accessTokenEnc: encryptSecret(accessToken),
        basicId: bot.basicId,
        botDisplayName: bot.displayName,
        greetingText,
        autoReplyText,
      },
    });
    logAudit({
      action: "line_account_created",
      email: info.email,
      name: info.staffName,
      entity: "line_account",
      entityId: created.id,
      detail: name,
    });
    revalidatePath(BASE);
    return { ok: true, id: created.id };
  } catch (e) {
    if (e instanceof LineApiError) {
      return { error: `LINEに接続できませんでした（${e.status}）。アクセストークンを確認してください` };
    }
    return { error: e instanceof Error ? e.message : "保存に失敗しました" };
  }
}

export async function deleteLineAccount(accountId: string): Promise<Result> {
  const info = await requireSession();
  const account = await getManageableAccount(info, accountId);
  if (!account) return { error: "権限がありません" };
  await db.lineAccount.delete({ where: { id: accountId } });
  logAudit({
    action: "line_account_deleted",
    email: info.email,
    name: info.staffName,
    entity: "line_account",
    entityId: accountId,
    detail: account.name,
  });
  revalidatePath(BASE);
  return { ok: true };
}

export async function testLineConnection(accountId: string): Promise<Result & { message?: string }> {
  const info = await requireSession();
  const account = await getManageableAccount(info, accountId);
  if (!account) return { error: "権限がありません" };
  try {
    const bot = await getBotInfo(decryptSecret(account.accessTokenEnc));
    await db.lineAccount.update({
      where: { id: accountId },
      data: { basicId: bot.basicId, botDisplayName: bot.displayName },
    });
    revalidatePath(BASE);
    return { ok: true, message: `OK: ${bot.displayName}（${bot.basicId}）` };
  } catch (e) {
    return { error: e instanceof LineApiError ? `接続失敗（${e.status}）` : (e as Error).message };
  }
}

// ---------------------------------------------------------------
// 友だち（タグ・メモ）／チャット送信
// ---------------------------------------------------------------
async function friendWithAccount(accountId: string, friendId: string) {
  const info = await requireSession();
  const account = await getManageableAccount(info, accountId);
  if (!account) return null;
  const friend = await db.lineFriend.findFirst({ where: { id: friendId, accountId } });
  if (!friend) return null;
  return { info, account, friend };
}

export async function updateLineFriend(_prev: Result | null, fd: FormData): Promise<Result> {
  const accountId = str(fd, "accountId");
  const friendId = str(fd, "friendId");
  const ctx = await friendWithAccount(accountId, friendId);
  if (!ctx) return { error: "権限がありません" };
  const tags = tagList(str(fd, "tags"));
  const note = str(fd, "note").slice(0, 2000) || null;
  // 画面を開いている間に自動で付いたタグを消さないよう、差分（追加・削除）だけを反映する
  const fresh = tags.filter((t) => !ctx.friend.tags.includes(t));
  const removed = ctx.friend.tags.filter((t) => !tags.includes(t));
  const latest = await db.lineFriend.findUnique({ where: { id: friendId }, select: { tags: true } });
  const merged = [...new Set([...(latest?.tags ?? []).filter((t) => !removed.includes(t)), ...fresh])];
  const updated = await db.lineFriend.update({ where: { id: friendId }, data: { tags: merged, note } });
  await enrollByTags(updated, fresh);
  revalidatePath(`${BASE}/${accountId}`);
  revalidatePath(`${BASE}/${accountId}/chat/${friendId}`);
  return { ok: true };
}

export async function sendLineChat(_prev: Result | null, fd: FormData): Promise<Result> {
  const accountId = str(fd, "accountId");
  const friendId = str(fd, "friendId");
  const body = str(fd, "text").slice(0, 5000);
  if (!body) return { error: "本文を入れてください" };
  const ctx = await friendWithAccount(accountId, friendId);
  if (!ctx) return { error: "権限がありません" };
  if (!ctx.friend.isFollowing) return { error: "ブロック中・友だち解除された相手には送れません" };
  try {
    await sendManual(ctx.account, ctx.friend, body, ctx.info.userId);
    revalidatePath(`${BASE}/${accountId}/chat/${friendId}`);
    return { ok: true };
  } catch (e) {
    return { error: e instanceof LineApiError ? `送信失敗（${e.status}）` : (e as Error).message };
  }
}

export async function markLineFriendRead(accountId: string, friendId: string): Promise<void> {
  const ctx = await friendWithAccount(accountId, friendId);
  if (!ctx || ctx.friend.unreadCount === 0) return;
  await db.lineFriend.update({ where: { id: friendId }, data: { unreadCount: 0 } });
}

export async function startScenarioForFriend(accountId: string, friendId: string, scenarioId: string): Promise<Result> {
  const ctx = await friendWithAccount(accountId, friendId);
  if (!ctx) return { error: "権限がありません" };
  const scenario = await db.lineScenario.findFirst({ where: { id: scenarioId, accountId } });
  if (!scenario) return { error: "シナリオが見つかりません" };
  await enrollInScenario(ctx.friend, scenarioId);
  revalidatePath(`${BASE}/${accountId}/chat/${friendId}`);
  return { ok: true };
}

// ---------------------------------------------------------------
// シナリオ（ステップはフォームから steps JSON で受ける）
// ---------------------------------------------------------------
type StepInput = { delayDays: number; sendHour: number | null; text: string; addTags: string[] };

function parseSteps(raw: string): StepInput[] | string {
  let arr: unknown;
  try {
    arr = JSON.parse(raw);
  } catch {
    return "ステップの形式が不正です";
  }
  if (!Array.isArray(arr) || arr.length === 0) return "ステップを1つ以上入れてください";
  const out: StepInput[] = [];
  for (const s of arr as Record<string, unknown>[]) {
    const text = String(s.text ?? "").trim();
    if (!text) return "本文が空のステップがあります";
    const delayDays = Math.max(0, Math.min(365, Number(s.delayDays ?? 0) || 0));
    const hourRaw = s.sendHour;
    const sendHour =
      hourRaw === null || hourRaw === "" || hourRaw === undefined
        ? null
        : Math.max(0, Math.min(23, Number(hourRaw) || 0));
    out.push({ delayDays, sendHour, text: text.slice(0, 5000), addTags: tagList(String(s.addTags ?? "")) });
  }
  return out.slice(0, 30);
}

export async function saveLineScenario(_prev: Result | null, fd: FormData): Promise<Result> {
  const info = await requireSession();
  const accountId = str(fd, "accountId");
  const account = await getManageableAccount(info, accountId);
  if (!account) return { error: "権限がありません" };

  const id = str(fd, "id");
  const name = str(fd, "name");
  const trigger = (str(fd, "trigger") || "FOLLOW") as LineScenarioTrigger;
  const triggerTag = str(fd, "triggerTag") || null;
  const isActive = fd.get("isActive") === "on";
  if (!name) return { error: "シナリオ名を入れてください" };
  if (!["FOLLOW", "TAG", "MANUAL"].includes(trigger)) return { error: "開始条件が不正です" };
  if (trigger === "TAG" && !triggerTag) return { error: "開始タグを入れてください" };
  const steps = parseSteps(str(fd, "steps"));
  if (typeof steps === "string") return { error: steps };

  const stepRows = steps.map((s, i) => ({ order: i + 1, ...s }));
  if (id) {
    const existing = await db.lineScenario.findFirst({ where: { id, accountId } });
    if (!existing) return { error: "シナリオが見つかりません" };
    await db.$transaction([
      db.lineScenario.update({ where: { id }, data: { name, trigger, triggerTag, isActive } }),
      db.lineScenarioStep.deleteMany({ where: { scenarioId: id } }),
      db.lineScenarioStep.createMany({ data: stepRows.map((s) => ({ scenarioId: id, ...s })) }),
    ]);
  } else {
    await db.lineScenario.create({
      data: { accountId, name, trigger, triggerTag, isActive, steps: { create: stepRows } },
    });
  }
  revalidatePath(`${BASE}/${accountId}/scenarios`);
  return { ok: true };
}

export async function deleteLineScenario(accountId: string, scenarioId: string): Promise<Result> {
  const info = await requireSession();
  const account = await getManageableAccount(info, accountId);
  if (!account) return { error: "権限がありません" };
  await db.lineScenario.deleteMany({ where: { id: scenarioId, accountId } });
  revalidatePath(`${BASE}/${accountId}/scenarios`);
  return { ok: true };
}

export async function toggleLineScenario(accountId: string, scenarioId: string, isActive: boolean): Promise<Result> {
  const info = await requireSession();
  const account = await getManageableAccount(info, accountId);
  if (!account) return { error: "権限がありません" };
  await db.lineScenario.updateMany({ where: { id: scenarioId, accountId }, data: { isActive } });
  revalidatePath(`${BASE}/${accountId}/scenarios`);
  return { ok: true };
}

// ---------------------------------------------------------------
// 一斉配信（今すぐ or 予約）
// ---------------------------------------------------------------
export async function createLineBroadcast(_prev: Result | null, fd: FormData): Promise<Result> {
  const info = await requireSession();
  const accountId = str(fd, "accountId");
  const account = await getManageableAccount(info, accountId);
  if (!account) return { error: "権限がありません" };

  const title = str(fd, "title");
  const text = str(fd, "text").slice(0, 5000);
  const filterTags = tagList(str(fd, "filterTags"));
  const excludeTags = tagList(str(fd, "excludeTags"));
  const when = str(fd, "scheduledAt"); // "YYYY-MM-DDTHH:mm"（JST）
  if (!title) return { error: "タイトルを入れてください" };
  if (!text) return { error: "本文を入れてください" };

  let scheduledAt = new Date();
  if (when) {
    const d = new Date(`${when}:00+09:00`);
    if (Number.isNaN(d.getTime())) return { error: "日時の形式が不正です" };
    scheduledAt = d;
  }
  const targetCount = await db.lineFriend.count({ where: broadcastTargetWhere(accountId, filterTags, excludeTags) });
  if (targetCount === 0) return { error: "条件に合う友だちがいません" };

  await db.lineBroadcast.create({
    data: { accountId, title, text, filterTags, excludeTags, scheduledAt, targetCount, createdByUserId: info.userId },
  });
  logAudit({
    action: "line_broadcast_created",
    email: info.email,
    name: info.staffName,
    entity: "line_broadcast",
    entityId: accountId,
    detail: `${title}（${targetCount}人）`,
  });
  revalidatePath(`${BASE}/${accountId}/broadcasts`);
  return { ok: true };
}

export async function cancelLineBroadcast(accountId: string, broadcastId: string): Promise<Result> {
  const info = await requireSession();
  const account = await getManageableAccount(info, accountId);
  if (!account) return { error: "権限がありません" };
  const r = await db.lineBroadcast.deleteMany({ where: { id: broadcastId, accountId, status: "SCHEDULED" } });
  if (r.count === 0) return { error: "送信済みの配信は取り消せません" };
  revalidatePath(`${BASE}/${accountId}/broadcasts`);
  return { ok: true };
}

/** 配信対象の人数を数える（フォームのプレビュー用） */
export async function countBroadcastTargets(accountId: string, filterTags: string, excludeTags: string): Promise<number> {
  const info = await requireSession();
  const account = await getManageableAccount(info, accountId);
  if (!account) return 0;
  return db.lineFriend.count({ where: broadcastTargetWhere(accountId, tagList(filterTags), tagList(excludeTags)) });
}

// ---------------------------------------------------------------
// 加盟促進テンプレ（本部アカウント用の初期シナリオ）
// 本文は代表が画面で編集する前提の下書き。価格・媒体名は書かない。
// ---------------------------------------------------------------
export async function seedFranchiseScenario(accountId: string): Promise<Result> {
  const info = await requireSession();
  if (info.role !== "ADMIN") return { error: "本部のみ使えます" };
  const account = await getManageableAccount(info, accountId);
  if (!account) return { error: "権限がありません" };
  const exists = await db.lineScenario.findFirst({ where: { accountId, name: "加盟促進（友だち追加後）" } });
  if (exists) return { error: "すでに投入済みです" };

  const booking = "https://timerex.net/s/AdArch/b42bc7ae";
  await db.lineScenario.create({
    data: {
      accountId,
      name: "加盟促進（友だち追加後）",
      trigger: "FOLLOW",
      isActive: false, // 本文を確認してからONにする
      steps: {
        create: [
          {
            order: 1,
            delayDays: 0,
            sendHour: null,
            text:
              "友だち追加ありがとうございます、アドアーチの白川です！\n\n" +
              "アドアーチグループは、全国の代表が「地元企業の広告の企画・販売」を担う広告エージェンシーのグループです。\n\n" +
              "まずは15分ほど、Webでお話しできればと思います。ご都合のよい枠をこちらからお選びください。\n" +
              booking,
            addTags: ["加盟見込み"],
          },
          {
            order: 2,
            delayDays: 1,
            sendHour: 10,
            text:
              "こんにちは、白川です。\n\n" +
              "昨日はご登録ありがとうございました！\n" +
              "「どんな相談が多いですか？」とよく聞かれるのですが、いちばん多いのは「自分の地域で、何から売り始めればいいか」です。\n\n" +
              "そのあたりを15分でお話しできますので、よければこちらからどうぞ。\n" +
              booking,
            addTags: [],
          },
          {
            order: 3,
            delayDays: 3,
            sendHour: 19,
            text:
              "白川です。\n\n" +
              "グループの代表は、映像制作の出身ではない方が半分以上です。\n" +
              "「作る」より「企画して売る」を担っていただく形なので、制作経験がなくても始められます。\n\n" +
              "気になることがあれば、このLINEにそのまま返信してください。私が直接お返事します！",
            addTags: [],
          },
          {
            order: 4,
            delayDays: 7,
            sendHour: 10,
            text:
              "白川です。\n\n" +
              "1週間経ちましたので、いったんご連絡はここまでにいたします。\n" +
              "タイミングが合うときに、いつでもこちらから15分の枠をお取りください。\n" +
              booking +
              "\n\nどうぞよろしくお願いいたします。",
            addTags: ["7日経過"],
          },
        ],
      },
    },
  });
  revalidatePath(`${BASE}/${accountId}/scenarios`);
  return { ok: true };
}

// ---------------------------------------------------------------
// 拠点向けテンプレ（クライアント対応）— 全アカウントで使える
// 問合せ→ヒアリング→見積→納品後フォロー。本文は各代表が自社向けに直す前提。
// ---------------------------------------------------------------
export async function seedClientScenario(accountId: string): Promise<Result> {
  const info = await requireSession();
  const account = await getManageableAccount(info, accountId);
  if (!account) return { error: "権限がありません" };
  const exists = await db.lineScenario.findFirst({ where: { accountId, name: "クライアント対応（友だち追加後）" } });
  if (exists) return { error: "すでに投入済みです" };

  await db.lineScenario.create({
    data: {
      accountId,
      name: "クライアント対応（友だち追加後）",
      trigger: "FOLLOW",
      isActive: false, // 本文を自社向けに直してからONにする
      steps: {
        create: [
          {
            order: 1,
            delayDays: 0,
            sendHour: null,
            text:
              "{name}さま、友だち追加ありがとうございます！\n\n" +
              "広告のご相談は、このLINEにそのまま送っていただければ担当が順にお返事します。\n" +
              "お急ぎの場合はお電話でも大丈夫です。",
            addTags: ["問合せ"],
          },
          {
            order: 2,
            delayDays: 1,
            sendHour: 10,
            text:
              "昨日はご登録ありがとうございました！\n\n" +
              "ご相談の前に、3つだけ教えていただけると提案が早くなります。\n" +
              "1) 何を伸ばしたいか（来店・問合せ・採用など）\n" +
              "2) 地域（市区町村）\n" +
              "3) 時期（いつ頃までに）\n\n" +
              "このLINEに返信でどうぞ。",
            addTags: [],
          },
          {
            order: 3,
            delayDays: 7,
            sendHour: 19,
            text:
              "その後、いかがでしょうか？\n\n" +
              "「まだ何も決まっていない」段階でも大丈夫です。地域と目的だけ教えていただければ、こちらから合いそうな進め方を2〜3案お出しします。",
            addTags: ["7日経過"],
          },
        ],
      },
    },
  });
  revalidatePath(`${BASE}/${accountId}/scenarios`);
  return { ok: true };
}

// ---------------------------------------------------------------
// 流入枠（セミナー等）
// ---------------------------------------------------------------
function parseJstLocal(v: string): Date | null {
  if (!v) return null;
  const d = new Date(`${v}:00+09:00`);
  return Number.isNaN(d.getTime()) ? null : d;
}

export async function saveLineEntryPoint(_prev: Result | null, fd: FormData): Promise<Result> {
  const info = await requireSession();
  const accountId = str(fd, "accountId");
  const account = await getManageableAccount(info, accountId);
  if (!account) return { error: "権限がありません" };

  const id = str(fd, "id");
  const name = str(fd, "name").slice(0, 60);
  const tag = (str(fd, "tag") || `セミナー:${name}`).replace(/[,\s]+/g, "_").slice(0, 40);
  const startsAt = parseJstLocal(str(fd, "startsAt"));
  const endsAt = parseJstLocal(str(fd, "endsAt"));
  const askOnFollow = fd.get("askOnFollow") === "on";
  if (!name) return { error: "セミナー名を入れてください" };
  if (str(fd, "startsAt") && !startsAt) return { error: "開始日時の形式が不正です" };
  if (endsAt && startsAt && endsAt < startsAt) return { error: "終了は開始より後にしてください" };

  const data = { name, tag, startsAt, endsAt, askOnFollow };
  if (id) {
    const r = await db.lineEntryPoint.updateMany({ where: { id, accountId }, data });
    if (r.count === 0) return { error: "枠が見つかりません" };
  } else {
    await db.lineEntryPoint.create({ data: { accountId, ...data } });
  }
  revalidatePath(`${BASE}/${accountId}/entry-points`);
  return { ok: true };
}

export async function deleteLineEntryPoint(accountId: string, id: string): Promise<Result> {
  const info = await requireSession();
  const account = await getManageableAccount(info, accountId);
  if (!account) return { error: "権限がありません" };
  await db.lineEntryPoint.deleteMany({ where: { id, accountId } });
  revalidatePath(`${BASE}/${accountId}/entry-points`);
  return { ok: true };
}

export async function toggleLineEntryPoint(accountId: string, id: string, isActive: boolean): Promise<Result> {
  const info = await requireSession();
  const account = await getManageableAccount(info, accountId);
  if (!account) return { error: "権限がありません" };
  await db.lineEntryPoint.updateMany({ where: { id, accountId }, data: { isActive } });
  revalidatePath(`${BASE}/${accountId}/entry-points`);
  return { ok: true };
}


// ---------------------------------------------------------------
// ミュート／顧客紐付け／定型文
// ---------------------------------------------------------------
export async function toggleLineFriendMute(accountId: string, friendId: string, mute: boolean): Promise<Result> {
  const ctx = await friendWithAccount(accountId, friendId);
  if (!ctx) return { error: "権限がありません" };
  await db.lineFriend.update({ where: { id: friendId }, data: { mutedAt: mute ? new Date() : null } });
  if (!mute) await rescheduleOverdueEnrollments(friendId); // 溜まった分を連射しない
  revalidatePath(`${BASE}/${accountId}`);
  revalidatePath(`${BASE}/${accountId}/chat/${friendId}`);
  return { ok: true, message: mute ? "ミュートしました（配信・通知を止めます）" : "ミュートを解除しました" };
}

/** 紐付け候補の顧客を検索（自拠点のみ／本部アカウントは全拠点） */
export async function searchCustomersForLine(accountId: string, q: string): Promise<{ id: string; name: string; branch: string }[]> {
  const info = await requireSession();
  const account = await getManageableAccount(info, accountId);
  if (!account || !q.trim()) return [];
  const rows = await db.customer.findMany({
    where: {
      ...(account.branchId ? { branchId: account.branchId } : {}),
      OR: [{ name: { contains: q.trim(), mode: "insensitive" } }, { nameKana: { contains: q.trim(), mode: "insensitive" } }],
    },
    select: { id: true, name: true, branch: { select: { name: true } } },
    take: 10,
    orderBy: { updatedAt: "desc" },
  });
  return rows.map((r) => ({ id: r.id, name: r.name, branch: r.branch.name }));
}

export async function linkLineFriendCustomer(accountId: string, friendId: string, customerId: string | null): Promise<Result> {
  const ctx = await friendWithAccount(accountId, friendId);
  if (!ctx) return { error: "権限がありません" };
  if (customerId) {
    const c = await db.customer.findFirst({
      where: { id: customerId, ...(ctx.account.branchId ? { branchId: ctx.account.branchId } : {}) },
      select: { id: true },
    });
    if (!c) return { error: "顧客が見つかりません" };
  }
  await db.lineFriend.update({ where: { id: friendId }, data: { customerId } });
  revalidatePath(`${BASE}/${accountId}/chat/${friendId}`);
  return { ok: true, message: customerId ? "顧客と紐付けました" : "紐付けを外しました" };
}

export async function saveLineCannedReply(_prev: Result | null, fd: FormData): Promise<Result> {
  const info = await requireSession();
  const accountId = str(fd, "accountId");
  const account = await getManageableAccount(info, accountId);
  if (!account) return { error: "権限がありません" };
  const title = str(fd, "title").slice(0, 40);
  const text = str(fd, "text").slice(0, 5000);
  if (!title || !text) return { error: "タイトルと本文を入れてください" };
  const count = await db.lineCannedReply.count({ where: { accountId } });
  await db.lineCannedReply.create({ data: { accountId, title, text, order: count } });
  revalidatePath(`${BASE}/${accountId}/settings`);
  return { ok: true };
}

export async function deleteLineCannedReply(accountId: string, id: string): Promise<Result> {
  const info = await requireSession();
  const account = await getManageableAccount(info, accountId);
  if (!account) return { error: "権限がありません" };
  await db.lineCannedReply.deleteMany({ where: { id, accountId } });
  revalidatePath(`${BASE}/${accountId}/settings`);
  return { ok: true };
}


// ---------------------------------------------------------------
// タグの設定（定義・色・名前変更・削除）／キーワードルール
// ---------------------------------------------------------------
const TAG_COLORS = ["#71717a", "#059669", "#2563eb", "#d97706", "#dc2626", "#7c3aed", "#db2777", "#0891b2"];

export async function saveLineTag(_prev: Result | null, fd: FormData): Promise<Result> {
  const info = await requireSession();
  const accountId = str(fd, "accountId");
  const account = await getManageableAccount(info, accountId);
  if (!account) return { error: "権限がありません" };
  const id = str(fd, "id");
  const name = str(fd, "name").replace(/[,\s]+/g, "_").slice(0, 40);
  const color = TAG_COLORS.includes(str(fd, "color")) ? str(fd, "color") : TAG_COLORS[0];
  const note = str(fd, "note").slice(0, 200) || null;
  if (!name) return { error: "タグ名を入れてください" };

  if (id) {
    const existing = await db.lineTag.findFirst({ where: { id, accountId } });
    if (!existing) return { error: "タグが見つかりません" };
    if (existing.name !== name) {
      const dup = await db.lineTag.findFirst({ where: { accountId, name } });
      if (dup) return { error: "同じ名前のタグがあります" };
      // 友だち側のタグ名も書き換える
      const friends = await db.lineFriend.findMany({ where: { accountId, tags: { has: existing.name } }, select: { id: true, tags: true } });
      for (const f of friends) {
        await db.lineFriend.update({ where: { id: f.id }, data: { tags: f.tags.map((t) => (t === existing.name ? name : t)) } });
      }
      await db.lineScenario.updateMany({ where: { accountId, triggerTag: existing.name }, data: { triggerTag: name } });
      await db.lineEntryPoint.updateMany({ where: { accountId, tag: existing.name }, data: { tag: name } });
      const ren = (arr: string[]) => arr.map((t) => (t === existing.name ? name : t));
      const menus = await db.lineRichMenu.findMany({ where: { accountId }, select: { id: true, ruleTags: true, areas: true } });
      for (const m of menus) {
        const areas = parseRichMenuAreas(m.areas).map((a) => ({ ...a, tags: ren(a.tags) }));
        await db.lineRichMenu.update({ where: { id: m.id }, data: { ruleTags: ren(m.ruleTags), areas } });
      }
      const steps = await db.lineScenarioStep.findMany({ where: { scenario: { accountId }, addTags: { has: existing.name } }, select: { id: true, addTags: true } });
      for (const st of steps) await db.lineScenarioStep.update({ where: { id: st.id }, data: { addTags: ren(st.addTags) } });
      const rules = await db.lineKeywordRule.findMany({ where: { accountId, addTags: { has: existing.name } }, select: { id: true, addTags: true } });
      for (const r of rules) await db.lineKeywordRule.update({ where: { id: r.id }, data: { addTags: ren(r.addTags) } });
      const links = await db.lineLink.findMany({ where: { accountId, addTags: { has: existing.name } }, select: { id: true, addTags: true } });
      for (const l of links) await db.lineLink.update({ where: { id: l.id }, data: { addTags: ren(l.addTags) } });
      const forms = await db.lineForm.findMany({ where: { accountId, addTags: { has: existing.name } }, select: { id: true, addTags: true } });
      for (const f of forms) await db.lineForm.update({ where: { id: f.id }, data: { addTags: ren(f.addTags) } });
      const bcs = await db.lineBroadcast.findMany({ where: { accountId, status: "SCHEDULED" }, select: { id: true, filterTags: true, excludeTags: true } });
      for (const b of bcs) await db.lineBroadcast.update({ where: { id: b.id }, data: { filterTags: ren(b.filterTags), excludeTags: ren(b.excludeTags) } });
    }
    await db.lineTag.update({ where: { id }, data: { name, color, note } });
  } else {
    const dup = await db.lineTag.findFirst({ where: { accountId, name } });
    if (dup) return { error: "同じ名前のタグがあります" };
    const count = await db.lineTag.count({ where: { accountId } });
    await db.lineTag.create({ data: { accountId, name, color, note, order: count } });
  }
  revalidatePath(`${BASE}/${accountId}/settings`);
  revalidatePath(`${BASE}/${accountId}`);
  return { ok: true };
}

/** タグ定義を削除。removeFromFriends=true なら友だちからも外す */
export async function deleteLineTag(accountId: string, id: string, removeFromFriends: boolean): Promise<Result> {
  const info = await requireSession();
  const account = await getManageableAccount(info, accountId);
  if (!account) return { error: "権限がありません" };
  const tag = await db.lineTag.findFirst({ where: { id, accountId } });
  if (!tag) return { error: "タグが見つかりません" };
  if (removeFromFriends) {
    const friends = await db.lineFriend.findMany({ where: { accountId, tags: { has: tag.name } }, select: { id: true, tags: true } });
    for (const f of friends) {
      await db.lineFriend.update({ where: { id: f.id }, data: { tags: f.tags.filter((t) => t !== tag.name) } });
    }
  }
  await db.lineTag.delete({ where: { id } });
  revalidatePath(`${BASE}/${accountId}/settings`);
  revalidatePath(`${BASE}/${accountId}`);
  return { ok: true };
}

/** 友だちに付いているのに定義が無いタグを、定義として取り込む */
export async function importLineTagsFromFriends(accountId: string): Promise<Result> {
  const info = await requireSession();
  const account = await getManageableAccount(info, accountId);
  if (!account) return { error: "権限がありません" };
  const [friends, defs] = await Promise.all([
    db.lineFriend.findMany({ where: { accountId }, select: { tags: true } }),
    db.lineTag.findMany({ where: { accountId }, select: { name: true } }),
  ]);
  const have = new Set(defs.map((d) => d.name));
  const missing = [...new Set(friends.flatMap((f) => f.tags))].filter((t) => !have.has(t));
  let order = defs.length;
  for (const name of missing) {
    await db.lineTag.create({ data: { accountId, name, color: TAG_COLORS[order % TAG_COLORS.length], order: order++ } });
  }
  revalidatePath(`${BASE}/${accountId}/settings`);
  return { ok: true, message: missing.length ? `${missing.length}件を取り込みました` : "取り込むタグはありません" };
}

export async function saveLineKeywordRule(_prev: Result | null, fd: FormData): Promise<Result> {
  const info = await requireSession();
  const accountId = str(fd, "accountId");
  const account = await getManageableAccount(info, accountId);
  if (!account) return { error: "権限がありません" };
  const id = str(fd, "id");
  const keyword = str(fd, "keyword").slice(0, 60);
  const addTags = tagList(str(fd, "addTags"));
  const replyText = str(fd, "replyText").slice(0, 5000) || null;
  const isActive = fd.get("isActive") !== "off";
  if (!keyword) return { error: "キーワードを入れてください" };
  if (addTags.length === 0 && !replyText) return { error: "付けるタグか返信のどちらかを入れてください" };
  if (id) {
    const r = await db.lineKeywordRule.updateMany({ where: { id, accountId }, data: { keyword, addTags, replyText, isActive } });
    if (r.count === 0) return { error: "ルールが見つかりません" };
  } else {
    await db.lineKeywordRule.create({ data: { accountId, keyword, addTags, replyText, isActive } });
  }
  revalidatePath(`${BASE}/${accountId}/settings`);
  return { ok: true };
}

export async function deleteLineKeywordRule(accountId: string, id: string): Promise<Result> {
  const info = await requireSession();
  const account = await getManageableAccount(info, accountId);
  if (!account) return { error: "権限がありません" };
  await db.lineKeywordRule.deleteMany({ where: { id, accountId } });
  revalidatePath(`${BASE}/${accountId}/settings`);
  return { ok: true };
}

export async function toggleLineKeywordRule(accountId: string, id: string, isActive: boolean): Promise<Result> {
  const info = await requireSession();
  const account = await getManageableAccount(info, accountId);
  if (!account) return { error: "権限がありません" };
  await db.lineKeywordRule.updateMany({ where: { id, accountId }, data: { isActive } });
  revalidatePath(`${BASE}/${accountId}/settings`);
  return { ok: true };
}


// ---------------------------------------------------------------
// 計測リンク
// ---------------------------------------------------------------
export async function saveLineLink(_prev: Result | null, fd: FormData): Promise<Result> {
  const info = await requireSession();
  const accountId = str(fd, "accountId");
  const account = await getManageableAccount(info, accountId);
  if (!account) return { error: "権限がありません" };
  const id = str(fd, "id");
  const label = str(fd, "label").slice(0, 60);
  const code = str(fd, "code").replace(/[{}\s]/g, "").slice(0, 30);
  const url = str(fd, "url");
  const addTags = tagList(str(fd, "addTags"));
  if (!label || !code) return { error: "表示名と本文で使う名前を入れてください" };
  if (!/^https?:\/\//.test(url)) return { error: "URLは https:// から入れてください" };
  const dup = await db.lineLink.findFirst({ where: { accountId, code, ...(id ? { NOT: { id } } : {}) } });
  if (dup) return { error: "同じ名前のリンクがあります" };
  if (id) {
    const r = await db.lineLink.updateMany({ where: { id, accountId }, data: { label, code, url, addTags } });
    if (r.count === 0) return { error: "リンクが見つかりません" };
  } else {
    await db.lineLink.create({ data: { accountId, label, code, url, addTags } });
  }
  revalidatePath(`${BASE}/${accountId}/settings`);
  return { ok: true };
}

export async function deleteLineLink(accountId: string, id: string): Promise<Result> {
  const info = await requireSession();
  const account = await getManageableAccount(info, accountId);
  if (!account) return { error: "権限がありません" };
  await db.lineLink.deleteMany({ where: { id, accountId } });
  revalidatePath(`${BASE}/${accountId}/settings`);
  return { ok: true };
}


// ---------------------------------------------------------------
// 回答フォーム
// ---------------------------------------------------------------
export async function saveLineForm(_prev: Result | null, fd: FormData): Promise<Result> {
  const info = await requireSession();
  const accountId = str(fd, "accountId");
  const account = await getManageableAccount(info, accountId);
  if (!account) return { error: "権限がありません" };
  const id = str(fd, "id");
  const title = str(fd, "title").slice(0, 80);
  const code = str(fd, "code").replace(/[{}\s]/g, "").slice(0, 30);
  const description = str(fd, "description").slice(0, 2000) || null;
  const thankYouText = str(fd, "thankYouText").slice(0, 5000) || null;
  const addTags = tagList(str(fd, "addTags"));
  const isActive = fd.getAll("isActive").includes("on");
  if (!title || !code) return { error: "タイトルと本文で使う名前を入れてください" };
  let fields;
  try {
    fields = parseFormFields(JSON.parse(str(fd, "fields") || "[]"));
  } catch {
    return { error: "項目の形式が不正です" };
  }
  if (fields.length === 0) return { error: "項目を1つ以上入れてください" };
  if (new Set(fields.map((f) => f.key)).size !== fields.length) return { error: "項目名が重複しています" };
  const dup = await db.lineForm.findFirst({ where: { accountId, code, ...(id ? { NOT: { id } } : {}) } });
  if (dup) return { error: "同じ名前のフォームがあります" };
  const data = { title, code, description, thankYouText, addTags, isActive, fields };
  if (id) {
    const r = await db.lineForm.updateMany({ where: { id, accountId }, data });
    if (r.count === 0) return { error: "フォームが見つかりません" };
  } else {
    await db.lineForm.create({ data: { accountId, ...data } });
  }
  revalidatePath(`${BASE}/${accountId}/settings`);
  return { ok: true };
}

export async function deleteLineForm(accountId: string, id: string): Promise<Result> {
  const info = await requireSession();
  const account = await getManageableAccount(info, accountId);
  if (!account) return { error: "権限がありません" };
  await db.lineForm.deleteMany({ where: { id, accountId } });
  revalidatePath(`${BASE}/${accountId}/settings`);
  return { ok: true };
}

/** 公開フォームの送信（認証なし・相手トークンで識別） */
export async function submitPublicLineForm(
  token: string,
  code: string,
  answers: Record<string, string | string[]>,
): Promise<{ ok: true; thankYou: string | null } | { ok: false; error: string }> {
  if (!token || !code) return { ok: false, error: "リンクが無効です" };
  return submitFormResponse(token, code, answers);
}


// ---------------------------------------------------------------
// リッチメニュー
// ---------------------------------------------------------------
const RICH_IMAGE_MAX = 1024 * 1024; // LINEの上限 1MB

/** 保存＋（画像があれば）LINEへ登録。既に登録済みなら作り直して差し替える */
export async function saveLineRichMenu(_prev: Result | null, fd: FormData): Promise<Result> {
  const info = await requireSession();
  const accountId = str(fd, "accountId");
  const account = await getManageableAccount(info, accountId);
  if (!account) return { error: "権限がありません" };

  const id = str(fd, "id");
  const name = str(fd, "name").slice(0, 60);
  const layout = str(fd, "layout");
  const chatBarText = (str(fd, "chatBarText") || "メニュー").slice(0, 14);
  const isDefault = fd.getAll("isDefault").includes("on");
  const ruleTags = tagList(str(fd, "ruleTags"));
  const priority = Math.max(0, Math.min(99, Number(str(fd, "priority")) || 0));
  if (!name) return { error: "名前を入れてください" };
  if (!RICH_MENU_LAYOUTS[layout]) return { error: "レイアウトを選んでください" };
  let areas;
  try {
    areas = parseRichMenuAreas(JSON.parse(str(fd, "areas") || "[]"));
  } catch {
    return { error: "ボタン設定の形式が不正です" };
  }
  for (const a of areas) {
    if (a.type === "uri" && a.value && !/^(https?:\/\/|tel:|mailto:)/.test(a.value)) return { error: `URLは https:// から入れてください（${a.value}）` };
    if (a.type === "uri" && !a.value && a.tags.length) return { error: "「URLを開く」にはURLを入れてください" };
  }
  if (buildRichMenuAreas(layout, areas).length === 0) return { error: "ボタンを1つ以上設定してください" };

  // 画像（任意・更新時は据え置き可）
  let imageData: Uint8Array<ArrayBuffer> | null = null;
  let imageType: string | null = null;
  const file = fd.get("image");
  if (file && typeof file === "object" && "arrayBuffer" in file && (file as File).size > 0) {
    const f = file as File;
    if (!["image/png", "image/jpeg"].includes(f.type)) return { error: "画像はPNGかJPEGにしてください" };
    if (f.size > RICH_IMAGE_MAX) return { error: "画像は1MB以下にしてください" };
    imageData = new Uint8Array(await f.arrayBuffer());
    imageType = f.type;
  }

  const existing = id ? await db.lineRichMenu.findFirst({ where: { id, accountId } }) : null;
  if (id && !existing) return { error: "メニューが見つかりません" };

  const saved = existing
    ? await db.lineRichMenu.update({
        where: { id },
        data: { name, layout, chatBarText, areas, isDefault, ruleTags, priority, ...(imageData ? { imageData, imageType } : {}) },
      })
    : await db.lineRichMenu.create({ data: { accountId, name, layout, chatBarText, areas, isDefault, ruleTags, priority, imageData, imageType } });

  if (isDefault) {
    await db.lineRichMenu.updateMany({ where: { accountId, NOT: { id: saved.id } }, data: { isDefault: false } });
  }
  const token = decryptSecret(account.accessTokenEnc);

  // LINEへ登録（画像が無ければ保存だけ。既定の付け外しだけはLINE側と同期する）
  if (!saved.imageData || !saved.imageType) {
    if (existing?.isDefault && !isDefault && existing.lineRichMenuId) await clearDefaultRichMenu(token).catch(() => {});
    revalidatePath(`${BASE}/${accountId}/richmenus`);
    return { ok: true, message: "保存しました（画像を付けるとLINEへ登録されます）" };
  }
  const L = RICH_MENU_LAYOUTS[layout];
  try {
    const newId = await createRichMenu(token, {
      size: { width: L.width, height: L.height },
      selected: true,
      name: name.slice(0, 300),
      chatBarText,
      areas: buildRichMenuAreas(layout, areas, saved.id),
    });
    await uploadRichMenuImage(token, newId, saved.imageData, saved.imageType);
    if (saved.lineRichMenuId) await deleteRichMenu(token, saved.lineRichMenuId).catch(() => {});
    await db.lineRichMenu.update({ where: { id: saved.id }, data: { lineRichMenuId: newId, lastError: null } });
    if (isDefault) await setDefaultRichMenu(token, newId);
    else if (existing?.isDefault) await clearDefaultRichMenu(token).catch(() => {});
    await relinkFriendsToMenu(accountId, saved.id, newId, token);
  } catch (e) {
    const msg = e instanceof LineApiError ? `LINE登録に失敗（${e.status}）: ${e.body.slice(0, 200)}` : (e as Error).message;
    await db.lineRichMenu.update({ where: { id: saved.id }, data: { lastError: msg } });
    revalidatePath(`${BASE}/${accountId}/richmenus`);
    return { error: msg };
  }
  revalidatePath(`${BASE}/${accountId}/richmenus`);
  return { ok: true, message: "LINEへ登録しました" };
}

/** このメニューに紐付いている人を新しいLINE IDへ付け直す（手動固定の人は固定のまま） */
async function relinkFriendsToMenu(accountId: string, menuId: string, newLineId: string, token: string): Promise<void> {
  const linked = await db.lineFriend.findMany({
    where: { accountId, richMenuId: menuId, isFollowing: true },
    select: { id: true, lineUserId: true, richMenuPinned: true },
  });
  for (const f of linked) {
    try {
      if (f.richMenuPinned) {
        await linkRichMenuToUser(token, f.lineUserId, newLineId);
      } else {
        await db.lineFriend.update({ where: { id: f.id }, data: { richMenuId: null } });
        await applyRichMenuRules(f.id);
      }
    } catch {
      /* 個別失敗は飛ばす */
    }
  }
}

export async function deleteLineRichMenu(accountId: string, id: string): Promise<Result> {
  const info = await requireSession();
  const account = await getManageableAccount(info, accountId);
  if (!account) return { error: "権限がありません" };
  const menu = await db.lineRichMenu.findFirst({ where: { id, accountId } });
  if (!menu) return { error: "メニューが見つかりません" };
  const token = decryptSecret(account.accessTokenEnc);
  try {
    if (menu.isDefault) await clearDefaultRichMenu(token);
    if (menu.lineRichMenuId) await deleteRichMenu(token, menu.lineRichMenuId);
  } catch (e) {
    return { error: e instanceof LineApiError ? `LINE側の削除に失敗（${e.status}）` : (e as Error).message };
  }
  await db.lineFriend.updateMany({ where: { richMenuId: id }, data: { richMenuId: null, richMenuPinned: false } });
  await db.lineRichMenu.delete({ where: { id } });
  revalidatePath(`${BASE}/${accountId}/richmenus`);
  return { ok: true };
}

/** 友だち全員にタグのルールを当て直す（最大500人） */
export async function reapplyLineRichMenus(accountId: string): Promise<Result> {
  const info = await requireSession();
  const account = await getManageableAccount(info, accountId);
  if (!account) return { error: "権限がありません" };
  const friends = await db.lineFriend.findMany({ where: { accountId, isFollowing: true }, select: { id: true }, take: 500 });
  let ok = 0;
  for (const f of friends) {
    try {
      await applyRichMenuRules(f.id);
      ok++;
    } catch {
      /* 個別失敗は飛ばす */
    }
  }
  revalidatePath(`${BASE}/${accountId}/richmenus`);
  return { ok: true, message: `${ok}人に適用しました` };
}

export async function setLineFriendRichMenu(accountId: string, friendId: string, menuId: string | null): Promise<Result> {
  const ctx = await friendWithAccount(accountId, friendId);
  if (!ctx) return { error: "権限がありません" };
  try {
    await setFriendRichMenu(friendId, menuId);
  } catch (e) {
    return { error: e instanceof LineApiError ? `切替に失敗（${e.status}）` : (e as Error).message };
  }
  revalidatePath(`${BASE}/${accountId}/chat/${friendId}`);
  return { ok: true, message: menuId ? "メニューを切り替えました" : "既定のメニューに戻しました" };
}


// ---------------------------------------------------------------
// ★評価（0〜5）
// ---------------------------------------------------------------
export async function setLineFriendRating(accountId: string, friendId: string, rating: number): Promise<Result> {
  const ctx = await friendWithAccount(accountId, friendId);
  if (!ctx) return { error: "権限がありません" };
  const r = Math.max(0, Math.min(5, Math.round(Number(rating) || 0)));
  await db.lineFriend.update({ where: { id: friendId }, data: { rating: r } });
  revalidatePath(`${BASE}/${accountId}`);
  revalidatePath(`${BASE}/${accountId}/chat/${friendId}`);
  return { ok: true };
}


/** 保存済み（画像あり）のメニューをLINEへ登録／再登録する */
export async function publishLineRichMenu(accountId: string, id: string): Promise<Result> {
  const info = await requireSession();
  const account = await getManageableAccount(info, accountId);
  if (!account) return { error: "権限がありません" };
  const menu = await db.lineRichMenu.findFirst({ where: { id, accountId } });
  if (!menu) return { error: "メニューが見つかりません" };
  if (!menu.imageData || !menu.imageType) return { error: "画像がありません。編集から画像を付けてください" };
  const L = RICH_MENU_LAYOUTS[menu.layout];
  if (!L) return { error: "レイアウトが不正です" };
  const lineAreas = buildRichMenuAreas(menu.layout, parseRichMenuAreas(menu.areas), menu.id);
  if (lineAreas.length === 0) return { error: "ボタンが設定されていません" };
  const token = decryptSecret(account.accessTokenEnc);
  try {
    const newId = await createRichMenu(token, {
      size: { width: L.width, height: L.height },
      selected: true,
      name: menu.name.slice(0, 300),
      chatBarText: menu.chatBarText,
      areas: lineAreas,
    });
    await uploadRichMenuImage(token, newId, menu.imageData, menu.imageType);
    if (menu.lineRichMenuId) await deleteRichMenu(token, menu.lineRichMenuId).catch(() => {});
    await db.lineRichMenu.update({ where: { id }, data: { lineRichMenuId: newId, lastError: null } });
    if (menu.isDefault) await setDefaultRichMenu(token, newId);
    await relinkFriendsToMenu(accountId, id, newId, token);
  } catch (e) {
    const msg = e instanceof LineApiError ? `LINE登録に失敗（${e.status}）: ${e.body.slice(0, 200)}` : (e as Error).message;
    await db.lineRichMenu.update({ where: { id }, data: { lastError: msg } });
    return { error: msg };
  }
  revalidatePath(`${BASE}/${accountId}/richmenus`);
  return { ok: true, message: "LINEへ登録しました" };
}


/** サンプルのリッチメニューを投入（key で選択）。画像付き・未登録で作る */
export async function seedSampleRichMenu(accountId: string, key: string): Promise<Result> {
  const info = await requireSession();
  const account = await getManageableAccount(info, accountId);
  if (!account) return { error: "権限がありません" };
  const sample = RICH_MENU_SAMPLES.find((x) => x.key === key);
  if (!sample) return { error: "サンプルが見つかりません" };
  const exists = await db.lineRichMenu.findFirst({ where: { accountId, name: sample.name } });
  if (exists) return { error: "すでに投入済みです（名前を変えれば複数作れます）" };
  let imageData: Uint8Array<ArrayBuffer>;
  try {
    const buf = await fs.readFile(path.join(process.cwd(), "public", "line", sample.file));
    imageData = new Uint8Array(buf);
  } catch {
    return { error: "サンプル画像が見つかりません" };
  }
  const hasDefault = await db.lineRichMenu.findFirst({ where: { accountId, isDefault: true } });
  await db.lineRichMenu.create({
    data: { accountId, name: sample.name, layout: sample.layout, chatBarText: sample.chatBarText, areas: sample.areas, imageData, imageType: "image/jpeg", isDefault: !hasDefault },
  });
  revalidatePath(`${BASE}/${accountId}/richmenus`);
  return { ok: true, message: "投入しました。URLや文言を自社向けに直してから「LINEへ登録」を押してください" };
}


/** 複数の友だちにまとめてメニューを適用（null=既定に戻す） */
export async function bulkSetLineFriendRichMenu(accountId: string, friendIds: string[], menuId: string | null): Promise<Result> {
  const info = await requireSession();
  const account = await getManageableAccount(info, accountId);
  if (!account) return { error: "権限がありません" };
  const ids = [...new Set(friendIds)].slice(0, 500);
  const friends = await db.lineFriend.findMany({ where: { id: { in: ids }, accountId, isFollowing: true }, select: { id: true } });
  let ok = 0;
  let lastError: string | null = null;
  for (const f of friends) {
    try {
      await setFriendRichMenu(f.id, menuId);
      ok++;
    } catch (e) {
      lastError = e instanceof LineApiError ? `LINE ${e.status}` : (e as Error).message;
    }
  }
  revalidatePath(`${BASE}/${accountId}`);
  return { ok: true, message: `${ok}人に適用しました${lastError ? `（一部失敗: ${lastError}）` : ""}` };
}


// ---------------------------------------------------------------
// 行動スコアの点数表
// ---------------------------------------------------------------
export async function saveLineScoreRules(_prev: Result | null, fd: FormData): Promise<Result> {
  const info = await requireSession();
  const accountId = str(fd, "accountId");
  const account = await getManageableAccount(info, accountId);
  if (!account) return { error: "権限がありません" };
  const n = (k: string) => Number(str(fd, k));
  const tagPoints: Record<string, number> = {};
  for (const line of str(fd, "tagPoints").split(/\n/)) {
    const m = line.trim().match(/^(.+?)\s*[:=：]\s*(-?\d+)$/);
    if (m) tagPoints[m[1].trim()] = Number(m[2]);
  }
  const thresholds: { score: number; tag: string }[] = [];
  for (const line of str(fd, "thresholds").split(/\n/)) {
    const m = line.trim().match(/^(\d+)\s*[:=：]\s*(.+)$/);
    if (m) thresholds.push({ score: Number(m[1]), tag: m[2].trim() });
  }
  const rules = parseScoreRules({ follow: n("follow"), message: n("message"), postback: n("postback"), click: n("click"), form: n("form"), booking: n("booking"), tagPoints, thresholds });
  await db.lineAccount.update({ where: { id: accountId }, data: { scoreRules: rules } });
  revalidatePath(`${BASE}/${accountId}/settings`);
  return { ok: true, message: "保存しました" };
}

/** 全員のスコアを履歴から再計算（点数表を変えた後に使う） */
export async function recalcLineScores(accountId: string): Promise<Result> {
  const info = await requireSession();
  const account = await getManageableAccount(info, accountId);
  if (!account) return { error: "権限がありません" };
  const rules = parseScoreRules(account.scoreRules);
  const friends = await db.lineFriend.findMany({ where: { accountId }, select: { id: true, scoreLogs: { select: { id: true, event: true } } } });
  for (const f of friends) {
    let total = 0;
    for (const l of f.scoreLogs) {
      const pts = l.event.startsWith("tag:") ? (rules.tagPoints[l.event.slice(4)] ?? 0) : (rules as unknown as Record<string, number>)[l.event] ?? 0;
      total += pts;
      await db.lineScoreLog.update({ where: { id: l.id }, data: { points: pts } });
    }
    await db.lineFriend.update({ where: { id: f.id }, data: { score: total } });
  }
  revalidatePath(`${BASE}/${accountId}`);
  return { ok: true, message: `${friends.length}人を再計算しました` };
}
