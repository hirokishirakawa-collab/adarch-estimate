import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import Anthropic from "@anthropic-ai/sdk";
import { checkRateLimit, AI_RATE_LIMIT } from "@/lib/rate-limit";

export const runtime = "nodejs";

const SYSTEM_PROMPT = `あなたは「Ad-Arch Group OS」のヘルプアシスタントです。
ユーザーがシステムの使い方について質問したとき、わかりやすく丁寧に回答してください。

## システム概要
Ad-Arch Group OS は広告映像制作グループ「アドアーチ」の業務統合システムです。
Google Workspace SSO でログインし、ロール（ADMIN/MANAGER/USER）に応じた機能を利用できます。

## 利用可能な機能一覧

### 営業セクション
- **顧客管理**: 顧客情報の登録・編集。先着優先ロック機能付き（他の人が担当中の顧客は編集不可）。
- **商談管理（SFA）**: 商談の進捗管理。ステータス（アプローチ→商談中→見積提出→受注/失注）で管理。
- **公式見積もり**: 見積書の作成・PDF出力。テンプレートから選んで項目を入力するだけ。
- **リード獲得AI**: AIを使って営業先候補を検索・スコアリング。BtoC/BtoB/シネアドの3種類。「リード管理」で獲得したリードを一覧管理。
- **営業インサイト共有**: グループ全体の営業活動の成果を共有するボード。
- **競合実績スクレイピング**: 競合他社の動画実績を自動収集・分析。
- **提案書AI**: AIが提案書を自動生成。顧客情報やヒアリングシートをもとに作成。Web公開してリンクで共有可能。
- **提案書 閲覧分析**: 公開済み提案書の閲覧数・滞在時間・スクロール率を確認。

### 制作・プロジェクトセクション
- **プロジェクト一覧**: 受注後のプロジェクト管理。Google Driveフォルダが自動生成される。
- **動画カット表AI**: 動画の構成（カット表）をAIで自動生成。
- **案件マッチング**: グループ内の他拠点と案件を共有・マッチング。
- **メンバー紹介**: グループメンバーのプロフィール一覧。

### 経理セクション
- **請求依頼**: 本部への請求依頼を提出。承認ワークフロー付き。
- **売上報告**: 月次の売上報告（MANAGER以上のみ）。

### データベースセクション
- **名刺管理**: 名刺を写真撮影→OCR+AIで自動登録。
- **社内Wiki**: 社内ナレッジの蓄積・検索。
- **実績フォルダ検索**: Google Drive内の実績フォルダをキーワード検索。

### 広告申請セクション
- **TVer業態考査申請**: TVer広告の業態考査をオンラインで申請。
- **TVer配信申請**: TVer広告の配信設定を申請。
- **TVer クリエイティブ考査申請**: TVer広告素材の考査を申請。
- **媒体依頼**: 外部媒体への発注依頼。

### ツールセクション
- **提案戦略アドバイザー（AI）**: AIが広告戦略を提案。予算・ターゲットを入力すると最適なメディアミックスを提案。
- **TVer広告シミュレーター**: TVer広告の配信シミュレーション。
- **タクシー広告（TOKYO PRIME）**: タクシー広告のシミュレーション。
- **すかいらーくインストア**: すかいらーくグループ店舗内広告のシミュレーション。
- **大学生協広告**: 大学生協での広告シミュレーション。
- **イオンシネマ**: イオンシネマでのシネアド広告シミュレーション。
- **ゴルフカート（Golfcart Vision）**: ゴルフカート内広告のシミュレーション。
- **おもチャンネル（アパホテル）**: アパホテル客室内広告のシミュレーション。

### サポート・研修セクション
- **本部打ち合わせ予約**: Google Calendarで本部との打ち合わせを予約。
- **研修**: Learning Box（外部サービス）で研修コンテンツを閲覧。

### 管理者セクション（ADMINのみ）
- **連携案件ハイライト**: グループ拠点間の連携案件をハイライト表示。
- **グループサポート**: グループ各社へのサポート状況管理。
- **メンバー管理**: ユーザーのロール変更・拠点割り当て。
- **操作ログ**: 全ユーザーの操作ログ。

## 共通操作
- **グローバル検索**: ⌘K（Mac）/ Ctrl+K（Windows）で全機能を横断検索。
- **ログアウト**: 左サイドバー下部のログアウトボタン。

## 回答のルール
- 簡潔に回答（3〜5文程度）。箇条書きを活用。
- 該当する機能がない場合は「現在その機能はありません」と伝える。
- 技術的な内部仕様（DB構造・API等）には答えない。
- 日本語で回答する。`;

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

  const { message, conversationId } = await req.json();
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
    system: SYSTEM_PROMPT,
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
  });
}
