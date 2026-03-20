import Anthropic from "@anthropic-ai/sdk";
import { auth } from "@/lib/auth";
import { db as prisma } from "@/lib/db";
import { NextRequest, NextResponse } from "next/server";

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.email) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const user = await prisma.user.findUnique({ where: { email: session.user.email } });
  if (!user || !user.branchId) return NextResponse.json({ error: "No branch" }, { status: 400 });

  const body = await req.json();
  const { studioClientId, month, postsPerMonth } = body;

  // クライアント情報を取得（ヒアリングデータ含む）
  const studioClient = studioClientId
    ? await prisma.studioClient.findUnique({ where: { id: studioClientId } })
    : null;

  const businessType = studioClient?.businessType || body.businessType;
  const businessName = studioClient?.name || body.businessName;
  const area = studioClient?.area || body.area;
  const target = studioClient?.target || body.target;
  const sellingPoints = studioClient?.sellingPoints || body.sellingPoints;
  const snsAccounts = studioClient?.snsAccounts || body.snsAccounts;
  const posts = studioClient?.postsPerMonth || postsPerMonth || 12;

  // 過去の制作物があれば参照
  let pastContext = "";
  if (studioClientId) {
    const pastProductions = await prisma.production.findMany({
      where: { studioClientId },
      orderBy: { createdAt: "desc" },
      take: 1,
    });
    const pastResults = await prisma.monthlyResult.findMany({
      where: { studioClientId },
      orderBy: { month: "desc" },
      take: 1,
    });
    if (pastProductions.length > 0) {
      pastContext += `\n\n## 前回の制作内容（参考）\n${pastProductions[0].content.substring(0, 500)}...`;
    }
    if (pastResults.length > 0) {
      const r = pastResults[0];
      pastContext += `\n\n## 前月の成果データ\nフォロワー: ${r.followers || "N/A"}, リーチ: ${r.reach || "N/A"}, エンゲージ率: ${r.engagementRate || "N/A"}%`;
    }
  }

  const prompt = `あなたはSNS運用のプロフェッショナルディレクターです。地方のtoC企業のInstagram運用を月額10万円で受注した場合の、実践的な運用プランを一括生成してください。

## クライアント情報
- 業種: ${businessType}
- 店舗名: ${businessName}
- エリア: ${area}
- ターゲット: ${target}
- 強み・売り: ${sellingPoints}
- SNSアカウント: ${snsAccounts || "未開設"}
- 対象月: ${month}
- 月間投稿数: ${posts}本（リール+フィード混合）
${pastContext}

## 生成してください（全て日本語）

### 1. コンテンツカレンダー（${month}の1ヶ月分）
各投稿について：
- 投稿日（曜日含む）
- 投稿形式（リール/フィード/ストーリーズ）
- 投稿テーマ・内容（具体的に）
- なぜこのタイミングか（季節・トレンド・曜日の理由）
- 想定エンゲージメント（高/中/低）

### 2. カット表（上位4投稿分の詳細）
リール動画のカット表を4本分：
- シーン番号
- 秒数（累積タイムコード付き）
- 映像内容（カメラアングル・被写体・動き）
- テロップ/テキスト
- BGM/SE指示
- 狙い（なぜこのカットか）

### 3. 撮影指示書（クライアントがスマホで撮影するための指示）
クライアントに渡す撮影指示：
- 撮影カット一覧（言葉で具体的に）
- 「縦で撮影」「明るい場所で」等の基本注意事項
- 各カットの参考構図（言葉で詳細に描写）
- 必要な小道具・準備物
- 所要時間の目安

### 4. キャプション案（上位4投稿分）
各投稿のキャプション：
- キャプション本文（改行・絵文字含む）
- ハッシュタグ30個（エリア系10+業種系10+トレンド系10）
- CTA（行動喚起）

### 5. 月次KPI目標
- フォロワー増加目標
- リーチ目標
- エンゲージメント率目標
- 保存数目標
- プロフィールアクセス目標

フォーマットはMarkdownで、見出し・表・箇条書きを使って見やすく整形してください。`;

  const message = await client.messages.create({
    model: "claude-sonnet-4-20250514",
    max_tokens: 8000,
    messages: [{ role: "user", content: prompt }],
  });

  const text = message.content[0].type === "text" ? message.content[0].text : "";

  // 制作物をDBに保存
  if (studioClientId) {
    await prisma.production.create({
      data: {
        type: "SNS_PLAN",
        title: `${month} SNS運用プラン`,
        content: text,
        month: month,
        inputData: { businessType, businessName, area, target, sellingPoints, snsAccounts, postsPerMonth: posts },
        studioClientId,
        branchId: user.branchId,
        createdById: user.id,
      },
    });
  }

  return NextResponse.json({ result: text });
}
