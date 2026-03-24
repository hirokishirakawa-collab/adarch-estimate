// ==============================================================
// POST /api/telegram/webhook — Telegram Bot Webhook
// ==============================================================

import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";

export const runtime = "nodejs";

const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY;
const TELEGRAM_ALLOWED_USERS = process.env.TELEGRAM_ALLOWED_USERS ?? "";

const SYSTEM_PROMPT = `あなたは白川代表の個人AIアシスタントです。
Telegramを通じて質問や相談を受けます。
簡潔かつ的確に回答してください。日本語で応答します。
Markdownフォーマット（太字、コードブロック等）はTelegramで表示されるため積極的に使ってください。`;

// 会話履歴（メモリ内、プロセス再起動でリセット）
const conversations = new Map<
  number,
  { role: "user" | "assistant"; content: string }[]
>();
const MAX_HISTORY = 20;

/** 許可ユーザーチェック */
function isAllowedUser(userId: number): boolean {
  if (!TELEGRAM_ALLOWED_USERS) return true; // 未設定なら全員許可
  const allowed = TELEGRAM_ALLOWED_USERS.split(",").map((s) => s.trim());
  return allowed.includes(String(userId));
}

/** Telegram API 送信 */
async function sendTelegramMessage(
  chatId: number,
  text: string,
): Promise<void> {
  // Telegram の文字数制限（4096文字）対応
  const chunks: string[] = [];
  for (let i = 0; i < text.length; i += 4096) {
    chunks.push(text.slice(i, i + 4096));
  }

  for (const chunk of chunks) {
    await fetch(
      `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          chat_id: chatId,
          text: chunk,
          parse_mode: "Markdown",
        }),
      },
    );
  }
}

export async function POST(req: NextRequest) {
  if (!TELEGRAM_BOT_TOKEN || !ANTHROPIC_API_KEY) {
    console.error("[telegram] Missing TELEGRAM_BOT_TOKEN or ANTHROPIC_API_KEY");
    return NextResponse.json({ ok: true });
  }

  try {
    const update = await req.json();

    // テキストメッセージのみ処理
    const message = update.message;
    if (!message?.text) {
      return NextResponse.json({ ok: true });
    }

    const chatId = message.chat.id;
    const userId = message.from.id;
    const text = message.text.trim();

    // ユーザー制限チェック
    if (!isAllowedUser(userId)) {
      await sendTelegramMessage(chatId, "このBotは許可されたユーザーのみ利用できます。");
      return NextResponse.json({ ok: true });
    }

    // /start コマンド
    if (text === "/start") {
      await sendTelegramMessage(
        chatId,
        `Ad-Arch AI Assistantへようこそ！\n\nメッセージを送信するとAIが回答します。\n\nあなたのUser ID: \`${userId}\``,
      );
      return NextResponse.json({ ok: true });
    }

    // /clear コマンド（履歴リセット）
    if (text === "/clear") {
      conversations.delete(chatId);
      await sendTelegramMessage(chatId, "会話履歴をリセットしました。");
      return NextResponse.json({ ok: true });
    }

    // 会話履歴を取得
    const history = conversations.get(chatId) ?? [];
    history.push({ role: "user", content: text });

    // 履歴が長すぎたら古いものを削除
    while (history.length > MAX_HISTORY) {
      history.shift();
    }

    // Claude API 呼び出し
    const client = new Anthropic({ apiKey: ANTHROPIC_API_KEY });
    const response = await client.messages.create({
      model: "claude-sonnet-4-20250514",
      max_tokens: 2048,
      system: SYSTEM_PROMPT,
      messages: history,
    });

    const reply =
      response.content[0].type === "text"
        ? response.content[0].text
        : "応答を生成できませんでした。";

    // 履歴に追加して保存
    history.push({ role: "assistant", content: reply });
    conversations.set(chatId, history);

    // Telegramに返信
    await sendTelegramMessage(chatId, reply);

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("[telegram] Webhook error:", error);
    return NextResponse.json({ ok: true });
  }
}
