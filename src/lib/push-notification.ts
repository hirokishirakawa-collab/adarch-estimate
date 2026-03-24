// Expo Push API を使ったプッシュ通知送信
const EXPO_PUSH_URL = "https://exp.host/--/api/v2/push/send";

interface PushMessage {
  to: string;
  title: string;
  body: string;
  data?: Record<string, unknown>;
  sound?: "default" | null;
  badge?: number;
}

export async function sendPushNotification(
  tokens: string[],
  title: string,
  body: string,
  data?: Record<string, unknown>
): Promise<void> {
  if (tokens.length === 0) return;

  const messages: PushMessage[] = tokens.map((token) => ({
    to: token,
    title,
    body,
    sound: "default",
    data,
  }));

  // Expo は一度に最大100件
  const chunks: PushMessage[][] = [];
  for (let i = 0; i < messages.length; i += 100) {
    chunks.push(messages.slice(i, i + 100));
  }

  for (const chunk of chunks) {
    await fetch(EXPO_PUSH_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify(chunk),
    });
  }
}

// 全ユーザーに通知を送信
export async function broadcastNotification(
  title: string,
  body: string,
  data?: Record<string, unknown>
): Promise<void> {
  const { db } = await import("@/lib/db");
  const tokens = await db.pushToken.findMany({
    select: { token: true },
  });
  const tokenStrings = tokens.map((t) => t.token);
  await sendPushNotification(tokenStrings, title, body, data);
}

// 特定ユーザーに通知を送信
export async function notifyUser(
  email: string,
  title: string,
  body: string,
  data?: Record<string, unknown>
): Promise<void> {
  const { db } = await import("@/lib/db");
  const tokens = await db.pushToken.findMany({
    where: { email },
    select: { token: true },
  });
  const tokenStrings = tokens.map((t) => t.token);
  await sendPushNotification(tokenStrings, title, body, data);
}
