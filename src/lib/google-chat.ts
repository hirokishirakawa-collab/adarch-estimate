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
 * 複数の spaceId に同じメッセージを送信（並列、失敗しても他は続行）
 */
export async function broadcastChatMessage(
  spaceIds: string[],
  text: string
): Promise<{ sent: number; failed: number }> {
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
