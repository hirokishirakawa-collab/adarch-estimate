import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import Anthropic from "@anthropic-ai/sdk";

export const runtime = "nodejs";
export const maxDuration = 120;

// POST /api/proposals/generate
export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.email) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return NextResponse.json(
      { error: "ANTHROPIC_API_KEY が設定されていません" },
      { status: 500 }
    );
  }

  const user = await db.user.findUnique({ where: { email: session.user.email } });
  if (!user) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

  // NOTE: アンロック判定は一時的に無効化中（テスト期間）
  // 本番運用時は閾値チェックを再有効化すること

  const body = (await req.json()) as {
    companyName: string;
    industry: string;
    challenge: string;
  };

  if (!body.companyName || !body.industry || !body.challenge) {
    return NextResponse.json(
      { error: "companyName, industry, challenge は必須です" },
      { status: 400 }
    );
  }

  // ---- 実績データ取得 ----

  // 1. プロジェクト（受注・完了済み）から業種に関連しそうなもの
  const projects = await db.project.findMany({
    where: {
      status: { in: ["COMPLETED", "IN_PROGRESS"] },
    },
    select: {
      title: true,
      description: true,
      customer: { select: { name: true, industry: true } },
    },
    orderBy: { createdAt: "desc" },
    take: 30,
  });

  // 2. 競合実績DB（VideoAchievement）— アドアーチ自身の実績として使える参考データ
  const achievements = await db.videoAchievement.findMany({
    select: {
      companyName: true,
      industry: true,
      videoType: true,
      contentSummary: true,
    },
    orderBy: { createdAt: "desc" },
    take: 30,
  });

  // 実績データをプロンプト用テキストに整形
  const projectLines = projects
    .filter((p) => p.title)
    .map((p) => {
      const customer = p.customer?.name || "非公開";
      const industry = p.customer?.industry || "";
      const desc = p.description ? `（${p.description.slice(0, 80)}）` : "";
      return `- ${p.title} / ${customer}${industry ? ` [${industry}]` : ""}${desc}`;
    })
    .join("\n");

  const achievementLines = achievements
    .filter((a) => a.companyName)
    .map((a) => {
      const summary = a.contentSummary ? `（${a.contentSummary.slice(0, 80)}）` : "";
      return `- ${a.companyName} [${a.industry}] ${a.videoType}${summary}`;
    })
    .join("\n");

  const today = new Date();
  const dateStr = `${today.getFullYear()}年${today.getMonth() + 1}月${today.getDate()}日`;

  const client = new Anthropic({ apiKey });

  const systemPrompt = `あなたはアドアーチグループの提案書作成AIアシスタントです。
アドアーチグループは映像制作・広告代理を中心としたクリエイティブ企業グループです。

以下の情報をもとに、提案書のコンテンツを生成してください。
出力は必ずJSON形式で、以下の構造に従ってください:

{
  "cover": {
    "title": "提案書のタイトル",
    "subtitle": "サブタイトル",
    "date": "${dateStr}",
    "to": "提案先企業名 御中"
  },
  "companyIntro": {
    "heading": "アドアーチグループについて",
    "description": "グループ紹介文（3〜4文）",
    "strengths": ["強み1", "強み2", "強み3"]
  },
  "proposal": {
    "heading": "ご提案",
    "challenge": "課題の要約（1〜2文）",
    "solutions": [
      {
        "title": "ソリューション名",
        "description": "説明（2〜3文）"
      }
    ]
  },
  "cases": {
    "heading": "関連実績",
    "items": [
      {
        "title": "実績タイトル",
        "description": "概要（1〜2文）"
      }
    ]
  },
  "nextSteps": {
    "heading": "次のステップ",
    "steps": ["ステップ1", "ステップ2", "ステップ3"],
    "contact": "お気軽にご相談ください。"
  }
}

【重要ルール】
- 日付は必ず「${dateStr}」を使用してください
- アドアーチグループの強みは「全国ネットワーク」「映像制作のプロフェッショナル」「広告運用からクリエイティブまでワンストップ」
- 関連実績は、以下の「実際のプロジェクト実績」と「映像制作実績」から、提案先の業種・課題に近いものを選んで記載してください
- 実績データが提案先の業種に合わない場合は、最も近いものを選び、業種横断的な価値（映像制作力・広告運用力など）を強調してください
- 絶対に架空の実績を作らないでください。下記データにある実績のみ使用してください
- 顧客名はそのまま記載して構いません
- ソリューションは提案先の業種と課題に最適化してください
- トーンはプロフェッショナルかつ親しみやすく
- JSON以外のテキストは出力しないでください

--- 実際のプロジェクト実績 ---
${projectLines || "（データなし）"}

--- 映像制作実績（競合分析データベースより） ---
${achievementLines || "（データなし）"}`;

  const userPrompt = `提案先企業: ${body.companyName}
業種: ${body.industry}
課題・ニーズ: ${body.challenge}`;

  const response = await client.messages.create({
    model: "claude-sonnet-4-20250514",
    max_tokens: 4096,
    messages: [{ role: "user", content: userPrompt }],
    system: systemPrompt,
  });

  const text =
    response.content[0].type === "text" ? response.content[0].text : "";

  let content;
  try {
    // JSON block may be wrapped in ```json ... ```
    const jsonMatch = text.match(/```json\s*([\s\S]*?)```/) || [null, text];
    content = JSON.parse(jsonMatch[1]!.trim());
  } catch {
    return NextResponse.json(
      { error: "AI応答のパースに失敗しました", raw: text },
      { status: 500 }
    );
  }

  // DB保存
  const proposal = await db.proposal.create({
    data: {
      userId: user.id,
      companyName: body.companyName,
      industry: body.industry,
      challenge: body.challenge,
      content,
    },
  });

  return NextResponse.json({ proposal });
}
