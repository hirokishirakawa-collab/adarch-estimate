import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import Anthropic from "@anthropic-ai/sdk";
import { checkRateLimit, AI_RATE_LIMIT } from "@/lib/rate-limit";
import { searchWikiArticles, formatArticlesForPrompt } from "@/lib/wiki-search";
import {
  detectQueryIntent,
  searchInternalKnowledge,
  formatInternalSourcesForPrompt,
} from "@/lib/internal-knowledge-search";

export const runtime = "nodejs";

const BASE_SYSTEM_PROMPT = `あなたは「Ad-Arch Group OS」のヘルプ＆ナレッジアシスタント「アーチくん」です。
ユーザーの質問に対して、以下の2種類の情報源を使い分けて回答します。

## 情報源の使い分け

1. **使い方・操作手順の質問** → Wiki記事を参照して回答
2. **営業・事例・業務相談の質問** → グループ内のナレッジ（営業アプローチ事例・連携事例・受注実績）を参照して回答

## システム概要
Ad-Arch Group OS は広告映像制作グループ「アドアーチ」の業務統合システムです。
Google Workspace SSO でログインし、ロール（ADMIN/MANAGER/USER）に応じた機能を利用できます。

## 回答のルール

### 全体
- 以下に提供される情報を**最優先の正解データ**として使用する
- 提供情報にない内容は推測で答えず、「社内ナレッジには未登録です」と正直に伝える
- 箇条書きや番号付きリストを積極的に使う
- ユーザーが今いるページ（currentPage）がある場合、そのページ文脈に沿って回答
- 回答は簡潔に（3〜10文程度）
- 日本語、フレンドリーだが丁寧なトーンで

### 使い方系の質問の場合
- Wiki記事の手順を忠実に伝える
- 回答末尾に \`[記事タイトル](/dashboard/wiki?q=キーワード)\` 形式でリンクを含める

### 営業・事例系の質問の場合
- グループ内の実際の事例を**根拠として引用**する（「〇〇県の〇〇業種で〇〇という方法で成功しています」）
- 投稿者名・所属・業種・結果など、**メタ情報も添えて具体性を出す**
- 該当事例が少ない場合はその旨を正直に伝え、アプローチ事例集への投稿を促す
- 回答末尾に関連機能へのリンクを含める（\`[アプローチ事例集](/dashboard/sales-approaches)\` など）`;

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

  // --- 質問タイプ判定 → 検索先を切り替え ---
  const intent = detectQueryIntent(message.trim());
  const searchQuery = [message.trim(), pageLabel || ""].filter(Boolean).join(" ");

  // Wiki記事は全タイプで検索（使い方系は必須、他は補助）
  const wikiLimit = intent === "howto" || intent === "general" ? 5 : 2;
  const wikiArticles = await searchWikiArticles(searchQuery, wikiLimit);
  const wikiContext = formatArticlesForPrompt(wikiArticles);

  // 営業・事例系のときは社内ナレッジも検索
  let internalSources: Awaited<ReturnType<typeof searchInternalKnowledge>> = [];
  let internalContext = "";
  if (intent === "business" || intent === "case_study" || intent === "general") {
    internalSources = await searchInternalKnowledge(message.trim(), 8);
    internalContext = formatInternalSourcesForPrompt(internalSources);
  }

  // system promptに動的注入
  let contextualPrompt = BASE_SYSTEM_PROMPT;
  contextualPrompt += `\n\n---\n\n# 検出された質問タイプ: ${intent}\n`;

  if (wikiContext) {
    contextualPrompt += `\n\n# 関連Wiki記事\n\n${wikiContext}`;
  }

  if (internalContext) {
    contextualPrompt += `\n\n---\n\n# 社内ナレッジ（グループ内の実例データ）\n\n**これらを根拠として引用し、具体的な成功パターンや事例を示してください。**\n\n${internalContext}`;
  } else if (intent === "business" || intent === "case_study") {
    contextualPrompt += `\n\n---\n\n# 社内ナレッジ\n\n該当する事例がまだ登録されていません。アプローチ事例集への投稿を促してください。\n投稿先: /dashboard/sales-approaches`;
  }

  if (!wikiContext && !internalContext) {
    contextualPrompt += `\n\n参照可能な情報が見つかりませんでした。Wikiまたはアプローチ事例集への登録を促してください。`;
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
    intent,
    sources: {
      wiki: wikiArticles.map((a) => ({ id: a.id, title: a.title })),
      internal: internalSources.map((s) => ({ type: s.type, title: s.title })),
    },
  });
}
