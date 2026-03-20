import Anthropic from "@anthropic-ai/sdk";
import { auth } from "@/lib/auth";
import { db as prisma } from "@/lib/db";
import { NextRequest } from "next/server";

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.email)
    return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401 });

  const user = await prisma.user.findUnique({ where: { email: session.user.email } });
  if (!user || !user.branchId)
    return new Response(JSON.stringify({ error: "No branch" }), { status: 400 });

  const body = await req.json();
  const { studioClientId, month, rawInsights } = body;

  const studioClient = await prisma.studioClient.findUnique({
    where: { id: studioClientId },
  });
  if (!studioClient)
    return new Response(JSON.stringify({ error: "Client not found" }), { status: 404 });

  // 前月の成果データがあれば比較用に取得
  const prevResult = await prisma.monthlyResult.findFirst({
    where: { studioClientId, month: { lt: month } },
    orderBy: { month: "desc" },
  });

  // 当月の生成プランがあれば参照
  const monthPlan = await prisma.production.findFirst({
    where: { studioClientId, month, type: "SNS_PLAN" },
    orderBy: { createdAt: "desc" },
  });

  const prompt = `あなたはSNS運用のアナリストです。以下のInstagram運用データを分析し、クライアントに提出する月次レポートを作成してください。

## クライアント情報
- 店舗名: ${studioClient.name}
- 業種: ${studioClient.businessType}
- エリア: ${studioClient.area}
- ターゲット: ${studioClient.target}

## 対象月: ${month}

## Instagram Insights データ
${rawInsights}

${prevResult ? `## 前月の成果（比較用）
- フォロワー: ${prevResult.followers ?? "N/A"}
- リーチ: ${prevResult.reach ?? "N/A"}
- エンゲージメント率: ${prevResult.engagementRate ?? "N/A"}%
- 保存数: ${prevResult.saves ?? "N/A"}` : "（前月データなし — 初回レポート）"}

${monthPlan ? `## 当月の運用プラン（参考）
${monthPlan.content.substring(0, 1000)}...` : ""}

## レポートに含めてください

### 1. エグゼクティブサマリー（3行）
クライアントの社長が30秒で理解できる要約

### 2. 主要KPI
| 指標 | 今月 | 前月 | 増減 | 評価 |
の表形式で：
- フォロワー数（増減含む）
- リーチ数
- インプレッション数
- エンゲージメント率
- 保存数
- プロフィールアクセス数
- ウェブサイトクリック数

### 3. トップ投稿分析（上位3投稿）
- どの投稿が最も反応が良かったか
- なぜ良かったかの分析
- 再現するための施策

### 4. 改善ポイント
- 数字が低かった部分の原因分析
- 具体的な改善施策（来月実行可能なもの）

### 5. 来月の戦略提案
- 来月のコンテンツ方針
- 強化すべきポイント
- 試すべき新施策

フォーマットはMarkdownで、クライアントに直接渡せる品質で。`;

  // ストリーミング
  const stream = await anthropic.messages.stream({
    model: "claude-sonnet-4-20250514",
    max_tokens: 4000,
    messages: [{ role: "user", content: prompt }],
  });

  let fullText = "";
  const encoder = new TextEncoder();

  const readable = new ReadableStream({
    async start(controller) {
      for await (const event of stream) {
        if (event.type === "content_block_delta" && event.delta.type === "text_delta") {
          const chunk = event.delta.text;
          fullText += chunk;
          controller.enqueue(encoder.encode(`data: ${JSON.stringify({ text: chunk })}\n\n`));
        }
      }

      // レポートをDB保存
      const production = await prisma.production.create({
        data: {
          type: "REPORT",
          title: `${month} 月次レポート`,
          content: fullText,
          month,
          inputData: { rawInsights },
          metadata: { model: "claude-sonnet-4-20250514", generatedAt: new Date().toISOString() },
          studioClientId,
          branchId: user.branchId!,
          createdById: user.id,
        },
      });

      // 数値データの抽出・保存を試みる（JSONで渡された場合）
      try {
        const insights = JSON.parse(rawInsights);
        await prisma.monthlyResult.upsert({
          where: { studioClientId_month: { studioClientId, month } },
          create: {
            month,
            studioClientId,
            branchId: user.branchId!,
            followers: insights.followers ?? null,
            followersGain: insights.followersGain ?? null,
            reach: insights.reach ?? null,
            impressions: insights.impressions ?? null,
            engagementRate: insights.engagementRate ?? null,
            saves: insights.saves ?? null,
            shares: insights.shares ?? null,
            profileVisits: insights.profileVisits ?? null,
            websiteClicks: insights.websiteClicks ?? null,
            rawData: insights,
            aiSummary: fullText.substring(0, 500),
          },
          update: {
            followers: insights.followers ?? undefined,
            followersGain: insights.followersGain ?? undefined,
            reach: insights.reach ?? undefined,
            impressions: insights.impressions ?? undefined,
            engagementRate: insights.engagementRate ?? undefined,
            saves: insights.saves ?? undefined,
            shares: insights.shares ?? undefined,
            profileVisits: insights.profileVisits ?? undefined,
            websiteClicks: insights.websiteClicks ?? undefined,
            rawData: insights,
            aiSummary: fullText.substring(0, 500),
          },
        });
      } catch {
        // JSON parse失敗 = テキストで貼り付けられた場合。数値保存はスキップ
      }

      // 操作ログ
      await prisma.auditLog.create({
        data: {
          action: "studio_report_generated",
          email: user.email,
          name: user.name,
          entity: "production",
          entityId: production.id,
          detail: `月次レポート生成: ${studioClient.name} / ${month}`,
        },
      });

      controller.enqueue(encoder.encode(`data: ${JSON.stringify({ done: true })}\n\n`));
      controller.close();
    },
  });

  return new Response(readable, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    },
  });
}
