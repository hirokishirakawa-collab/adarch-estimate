import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import Anthropic from "@anthropic-ai/sdk";
import { checkRateLimit, AI_RATE_LIMIT } from "@/lib/rate-limit";
import { searchWikiArticles, formatArticlesForPrompt } from "@/lib/wiki-search";

export const runtime = "nodejs";

const BASE_SYSTEM_PROMPT = `あなたは「Ad-Arch Group OS」のヘルプアシスタントです。
ユーザーがシステムの使い方について質問したとき、以下に提供される**Wiki記事の内容を正解として**具体的な操作手順をわかりやすく回答してください。

## システム概要
Ad-Arch Group OS は広告映像制作グループ「アドアーチ」の業務統合システムです。
Google Workspace SSO でログインし、ロール（ADMIN/MANAGER/USER）に応じた機能を利用できます。
左サイドバーから各機能にアクセスします。

## 共通操作
- グローバル検索: ⌘K（Mac）/ Ctrl+K（Windows）で全機能を横断検索
- ログアウト: 左サイドバー下部のログアウトボタン
- 各ページ右上の「〇〇の使い方」ボタンからWiki記事にすぐアクセス可能

## 回答のルール
- **以下のWiki記事に書かれている内容を最優先の情報源として使用する**
- Wiki記事に具体的な手順がある場合は、その手順を忠実に伝える
- 箇条書きや番号付きリストを積極的に使う
- ユーザーが今いるページ（currentPage）がある場合、そのページ文脈に沿って回答
- 3〜8文程度で回答。長すぎず短すぎず
- Wiki記事に該当する情報がない場合は、**「この機能の詳細はWikiに未登録です。/dashboard/wiki で検索してみてください」と正直に伝える**
- 技術的な内部仕様（DB構造・API等）には答えない
- 日本語で回答する。フレンドリーだが丁寧なトーンで
- **回答の最後に関連するWiki記事へのリンクを必ず1つ以上含める**（例: 「詳細は [見積作成ツールの使い方](/dashboard/wiki?q=見積作成) を参照してください」）`;

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.email) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const rateLimited = checkRateLimit(session.user.email, "chatbot", AI_RATE_LIMIT);
  if (rateLimited) return rateLimited;

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ error: "API key not configured" }, { status: 500 });
  }

  const { message, conversationId, currentPage, pageLabel } = await req.json();
  if (!message || typeof message !== "string" || message.trim().length === 0) {
    return NextResponse.json({ error: "Message is required" }, { status: 400 });
  }

  // ユーザーを取得
  const user = await db.user.findUnique({ where: { email: session.user.email } });
  if (!user) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

  // 会話を取得 or 作成
  let conversation;
  if (conversationId) {
    conversation = await db.chatbotConversation.findFirst({
      where: { id: conversationId, userId: user.id },
      include: { messages: { orderBy: { createdAt: "asc" }, take: 20 } },
    });
  }

  if (!conversation) {
    conversation = await db.chatbotConversation.create({
      data: { userId: user.id },
      include: { messages: { orderBy: { createdAt: "asc" } } },
    });
  }

  // ユーザーメッセージを保存
  await db.chatbotMessage.create({
    data: {
      conversationId: conversation.id,
      role: "user",
      content: message.trim(),
    },
  });

  // --- Wiki記事を動的検索してsystem promptに注入 ---
  const searchQuery = [message.trim(), pageLabel || ""].filter(Boolean).join(" ");
  const wikiArticles = await searchWikiArticles(searchQuery, 5);
  const wikiContext = formatArticlesForPrompt(wikiArticles);

  let contextualPrompt = BASE_SYSTEM_PROMPT;
  if (wikiContext) {
    contextualPrompt += `\n\n---\n\n# 関連Wiki記事（正解データ）\n\n${wikiContext}`;
  } else {
    contextualPrompt += `\n\n---\n\n# 関連Wiki記事\n\n該当する記事が見つかりませんでした。Wiki未登録の可能性があることをユーザーに伝えてください。`;
  }

  // ページコンテキストを追加
  if (currentPage && pageLabel) {
    contextualPrompt += `\n\n---\n\n## 現在のコンテキスト
- ユーザーが今見ているページ: ${pageLabel}（${currentPage}）
- ユーザーのロール: ${user.role}
- ユーザー名: ${user.name || "不明"}
このページに関連する質問には、より具体的なガイドを提供してください。`;
  }

  // 過去メッセージを Anthropic 形式に変換
  const history = (conversation.messages ?? []).map((m: { role: string; content: string }) => ({
    role: m.role as "user" | "assistant",
    content: m.content,
  }));
  history.push({ role: "user", content: message.trim() });

  // Claude API 呼び出し
  const client = new Anthropic({ apiKey });
  const response = await client.messages.create({
    model: "claude-sonnet-4-20250514",
    max_tokens: 1024,
    system: contextualPrompt,
    messages: history,
  });

  const assistantContent =
    response.content[0].type === "text" ? response.content[0].text : "";

  // アシスタントメッセージを保存
  await db.chatbotMessage.create({
    data: {
      conversationId: conversation.id,
      role: "assistant",
      content: assistantContent,
    },
  });

  return NextResponse.json({
    reply: assistantContent,
    conversationId: conversation.id,
    sources: wikiArticles.map((a) => ({ id: a.id, title: a.title })),
  });
}
