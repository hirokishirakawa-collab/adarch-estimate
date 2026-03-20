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
  const { businessType, area, businessName, target, competitorUrls, studioClientId } = body;

  const prompt = `あなたはSNSマーケティングの競合分析スペシャリストです。以下の条件で、Instagram上の競合アカウントを分析し、差別化戦略を提案してください。

## 分析対象
- クライアント業種: ${businessType}
- エリア: ${area}
- クライアント名: ${businessName || "未定"}
- ターゲット: ${target || "未設定"}
${competitorUrls ? `\n## 指定された競合アカウント\n${competitorUrls}` : ""}

## 分析してください

### 1. エリア×業種の市場概況
- ${area}における${businessType}のInstagram活用状況
- 推定アカウント数・競合密度
- この地域のSNSユーザーの特徴（年齢層・利用時間帯・好まれるコンテンツ）

### 2. 想定される主要競合（上位5アカウント）
${competitorUrls ? "指定された競合を含めて分析：" : "この業種×エリアで一般的に存在する競合パターン："}
各競合について：
- アカウント名（想定 or 指定）
- 推定フォロワー規模
- 投稿頻度
- コンテンツの特徴（何を・どう見せているか）
- ハッシュタグ戦略
- 強み
- 弱み（つけ入る隙）

### 3. コンテンツ傾向分析
この業種×エリアで：
- 反応が良い投稿パターン（リール vs フィード、時間帯、曜日）
- よく使われるハッシュタグTOP20（エリア系・業種系・トレンド系）
- フォロワーが求めている情報（口コミ分析的な観点）
- やってはいけないNG投稿パターン

### 4. 差別化戦略
${businessName || "クライアント"}が競合と差別化するための具体的戦略：
- ポジショニングマップ（軸2つで4象限に分類）
- 推奨する差別化軸（価格 vs 品質、カジュアル vs プレミアム等）
- 競合がやっていない空白ポジションの提案
- 「これだけやれば勝てる」3つのアクション

### 5. ベンチマーク目標
- 3ヶ月後の目標（フォロワー・リーチ・エンゲージメント率）
- 6ヶ月後の目標
- 12ヶ月後の目標
- 目標達成に必要な投稿頻度・コンテンツ品質

### 6. 即実行可能なアクションプラン
明日から始められる施策を5つ、優先度順に：
- 何をするか（具体的に）
- なぜ効くか（根拠）
- 必要な時間・コスト
- 期待効果

フォーマットはMarkdownで、表・箇条書きを使って見やすく整形してください。
ポジショニングマップはテキストで表現してください（例: 高品質↑ / カジュアル← →プレミアム / 低価格↓）。`;

  const stream = await anthropic.messages.stream({
    model: "claude-sonnet-4-20250514",
    max_tokens: 6000,
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

      // DB保存（クライアント紐づけがある場合）
      if (studioClientId && fullText.length > 0) {
        await prisma.production.create({
          data: {
            type: "SNS_PLAN",
            title: `競合分析: ${area} × ${businessType}`,
            content: fullText,
            month: new Date().toISOString().slice(0, 7),
            inputData: { businessType, area, businessName, target, competitorUrls },
            metadata: { model: "claude-sonnet-4-20250514", type: "competitor_analysis", generatedAt: new Date().toISOString() },
            studioClientId,
            branchId: user.branchId!,
            createdById: user.id,
          },
        });
      }

      await prisma.auditLog.create({
        data: {
          action: "studio_competitor_analysis",
          email: user.email,
          name: user.name,
          entity: "studio_client",
          entityId: studioClientId || null,
          detail: `競合分析: ${area} × ${businessType}${businessName ? ` (${businessName})` : ""}`,
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
