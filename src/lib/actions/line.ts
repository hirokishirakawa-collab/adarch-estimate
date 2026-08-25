"use server";

// ==============================================================
// LINE公式アカウント — サーバーアクション（接続・友だち・チャット・シナリオ・一斉配信）
// ==============================================================

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { logAudit } from "@/lib/audit";
import { encryptSecret, decryptSecret } from "@/lib/line/secret";
import { getBotInfo, LineApiError } from "@/lib/line/client";
import { requireSession, getManageableAccount, branchIdForNewAccount } from "@/lib/line/access";
import { sendManual, enrollInScenario, enrollByTags, broadcastTargetWhere } from "@/lib/line/service";
import type { LineScenarioTrigger } from "@/generated/prisma/client";

type Result = { error?: string; ok?: boolean; id?: string };
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

  if (!name) return { error: "表示名を入れてください" };

  try {
    if (id) {
      const account = await getManageableAccount(info, id);
      if (!account) return { error: "このアカウントを操作する権限がありません" };
      const data: Record<string, unknown> = { name, greetingText, autoReplyText };
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
  const fresh = tags.filter((t) => !ctx.friend.tags.includes(t));
  const updated = await db.lineFriend.update({ where: { id: friendId }, data: { tags, note } });
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
