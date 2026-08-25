// ==============================================================
// LINE Messaging API 薄いクライアント（SDK不使用・fetchのみ）
// 参考: https://developers.line.biz/ja/reference/messaging-api/
// ==============================================================

import crypto from "node:crypto";

const API = "https://api.line.me/v2/bot";

export type LineTextMessage = { type: "text"; text: string };
export type LineMessageObject = LineTextMessage | Record<string, unknown>;

export class LineApiError extends Error {
  constructor(
    public status: number,
    public body: string,
    message?: string,
  ) {
    super(message ?? `LINE API ${status}: ${body.slice(0, 200)}`);
  }
}

async function call(
  token: string,
  path: string,
  init: { method?: string; body?: unknown } = {},
): Promise<unknown> {
  const res = await fetch(`${API}${path}`, {
    method: init.method ?? "GET",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: init.body === undefined ? undefined : JSON.stringify(init.body),
    cache: "no-store",
  });
  const text = await res.text();
  if (!res.ok) throw new LineApiError(res.status, text);
  return text ? JSON.parse(text) : {};
}

/** Webhook 署名検証（x-line-signature = base64(HMAC-SHA256(channelSecret, rawBody))） */
export function verifySignature(channelSecret: string, rawBody: string, signature: string | null): boolean {
  if (!signature) return false;
  const expected = crypto.createHmac("sha256", channelSecret).update(rawBody).digest("base64");
  const a = Buffer.from(expected);
  const b = Buffer.from(signature);
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

/** 接続確認：ボット情報（basicId / displayName） */
export async function getBotInfo(token: string): Promise<{ basicId: string; displayName: string; userId: string }> {
  return (await call(token, "/info")) as { basicId: string; displayName: string; userId: string };
}

export async function getProfile(
  token: string,
  userId: string,
): Promise<{ displayName: string; pictureUrl?: string; statusMessage?: string } | null> {
  try {
    return (await call(token, `/profile/${userId}`)) as {
      displayName: string;
      pictureUrl?: string;
      statusMessage?: string;
    };
  } catch (e) {
    // ブロック中などは 404 が返る
    if (e instanceof LineApiError && e.status === 404) return null;
    throw e;
  }
}

/** 返信（無料・replyToken は1回限り・受信から短時間のみ有効） */
export async function replyMessage(token: string, replyToken: string, messages: LineMessageObject[]): Promise<void> {
  await call(token, "/message/reply", { method: "POST", body: { replyToken, messages: messages.slice(0, 5) } });
}

/** プッシュ（有料枠を消費） */
export async function pushMessage(token: string, to: string, messages: LineMessageObject[]): Promise<void> {
  await call(token, "/message/push", { method: "POST", body: { to, messages: messages.slice(0, 5) } });
}

/** 複数人へ同じメッセージ（最大500人/回） */
export async function multicastMessage(token: string, to: string[], messages: LineMessageObject[]): Promise<void> {
  for (let i = 0; i < to.length; i += 500) {
    await call(token, "/message/multicast", {
      method: "POST",
      body: { to: to.slice(i, i + 500), messages: messages.slice(0, 5) },
    });
  }
}

/** 今月の送信数と上限（プランの残量確認） */
export async function getQuota(token: string): Promise<{ type: string; value?: number; used: number }> {
  const [quota, used] = await Promise.all([
    call(token, "/message/quota") as Promise<{ type: string; value?: number }>,
    call(token, "/message/quota/consumption") as Promise<{ totalUsage: number }>,
  ]);
  return { type: quota.type, value: quota.value, used: used.totalUsage };
}

export function text(t: string): LineTextMessage {
  return { type: "text", text: t.slice(0, 5000) };
}

// ---------------------------------------------------------------
// リッチメニュー
// ---------------------------------------------------------------
const API_DATA = "https://api-data.line.me/v2/bot";

export type RichMenuArea = {
  bounds: { x: number; y: number; width: number; height: number };
  action: Record<string, unknown>;
};

export async function createRichMenu(
  token: string,
  body: { size: { width: number; height: number }; selected: boolean; name: string; chatBarText: string; areas: RichMenuArea[] },
): Promise<string> {
  const r = (await call(token, "/richmenu", { method: "POST", body })) as { richMenuId: string };
  return r.richMenuId;
}

export async function uploadRichMenuImage(token: string, richMenuId: string, image: Uint8Array, contentType: string): Promise<void> {
  const res = await fetch(`${API_DATA}/richmenu/${richMenuId}/content`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": contentType },
    body: new Blob([image as BlobPart], { type: contentType }),
  });
  if (!res.ok) throw new LineApiError(res.status, await res.text());
}

export async function deleteRichMenu(token: string, richMenuId: string): Promise<void> {
  try {
    await call(token, `/richmenu/${richMenuId}`, { method: "DELETE" });
  } catch (e) {
    if (e instanceof LineApiError && e.status === 404) return;
    throw e;
  }
}

export async function setDefaultRichMenu(token: string, richMenuId: string): Promise<void> {
  await call(token, `/user/all/richmenu/${richMenuId}`, { method: "POST" });
}

export async function clearDefaultRichMenu(token: string): Promise<void> {
  try {
    await call(token, "/user/all/richmenu", { method: "DELETE" });
  } catch (e) {
    if (e instanceof LineApiError && e.status === 404) return;
    throw e;
  }
}

export async function linkRichMenuToUser(token: string, userId: string, richMenuId: string): Promise<void> {
  await call(token, `/user/${userId}/richmenu/${richMenuId}`, { method: "POST" });
}

export async function unlinkRichMenuFromUser(token: string, userId: string): Promise<void> {
  try {
    await call(token, `/user/${userId}/richmenu`, { method: "DELETE" });
  } catch (e) {
    if (e instanceof LineApiError && e.status === 404) return;
    throw e;
  }
}
