// ==============================================================
// Google Chat Webhook — 通知送信ユーティリティ
// ==============================================================

/**
 * 環境変数 GOOGLE_CHAT_WEBHOOK_MAP から spaceId → webhookUrl のマッピングを取得
 * 形式: JSON { "AAQA1ONKAvc": "https://chat.googleapis.com/v1/spaces/..." }
 */
function getWebhookMap(): Record<string, string> {
  const raw = process.env.GOOGLE_CHAT_WEBHOOK_MAP;
  if (!raw) return {};
  try {
    return JSON.parse(raw);
  } catch {
    console.error("[google-chat] Failed to parse GOOGLE_CHAT_WEBHOOK_MAP");
    return {};
  }
}

/**
 * 指定された spaceId の Google Chat スペースにテキストメッセージを送信
 */
export async function sendChatMessage(
  spaceId: string,
  text: string
): Promise<boolean> {
  const map = getWebhookMap();
  // DBのchatSpaceIdは "spaces/XXX" 形式、マップキーはどちらの形式でも対応
  const key = spaceId.replace(/^spaces\//, "");
  const webhookUrl = map[key] ?? map[spaceId];
  if (!webhookUrl) {
    console.warn(`[google-chat] No webhook URL for spaceId: ${spaceId}`);
    return false;
  }

  try {
    const res = await fetch(webhookUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text }),
    });
    if (!res.ok) {
      console.error(`[google-chat] Send failed (${res.status}): ${spaceId}`);
      return false;
    }
    return true;
  } catch (e) {
    console.error(`[google-chat] Send error for ${spaceId}:`, e);
    return false;
  }
}

/**
 * CEO通知スペースにメッセージを送信（全通知の集約先）
 * 環境変数 GROUP_SUPPORT_ALERT_CHAT_WEBHOOK を使用
 */
export async function notifyCeo(text: string): Promise<void> {
  const webhookUrl = process.env.GROUP_SUPPORT_ALERT_CHAT_WEBHOOK;
  if (!webhookUrl) return;
  try {
    const res = await fetch(webhookUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json; charset=UTF-8" },
      body: JSON.stringify({ text }),
    });
    if (!res.ok) {
      console.error("[google-chat:ceo] Send failed:", res.status);
    }
  } catch (e) {
    console.error("[google-chat:ceo] Error:", e instanceof Error ? e.message : e);
  }
}

/**
 * 複数の spaceId に同じメッセージを送信（並列、失敗しても他は続行）
 * options.markAsRead が true の場合、GAS経由で送信＋既読処理を行う
 */
export async function broadcastChatMessage(
  spaceIds: string[],
  text: string,
  options?: { markAsRead?: boolean }
): Promise<{ sent: number; failed: number }> {
  // GAS経由（送信＋既読処理）
  if (options?.markAsRead) {
    const gasUrl = process.env.GAS_BROADCAST_URL;
    if (gasUrl) {
      try {
        const res = await fetch(gasUrl, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            spaceIds: spaceIds.map((id) => id.replace(/^spaces\//, "")),
            text,
            apiKey: process.env.GROUP_SUPPORT_API_KEY,
          }),
        });
        if (res.ok) {
          const data = await res.json();
          console.log(`[google-chat] GAS broadcast: ${data.sent} sent, ${data.failed} failed, ${data.read} read`);
          return { sent: data.sent ?? 0, failed: data.failed ?? 0 };
        }
        console.error(`[google-chat] GAS broadcast failed (${res.status}), falling back to webhook`);
      } catch (e) {
        console.error("[google-chat] GAS broadcast error, falling back to webhook:", e);
      }
    }
  }

  // Webhook直接送信（フォールバック）
  const results = await Promise.allSettled(
    spaceIds.map((id) => sendChatMessage(id, text))
  );

  let sent = 0;
  let failed = 0;
  for (const r of results) {
    if (r.status === "fulfilled" && r.value) sent++;
    else failed++;
  }

  console.log(`[google-chat] Broadcast: ${sent} sent, ${failed} failed`);
  return { sent, failed };
}
