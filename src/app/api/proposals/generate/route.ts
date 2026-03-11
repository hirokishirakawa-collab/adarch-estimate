import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import Anthropic from "@anthropic-ai/sdk";
import {
  DEFAULT_UNLOCK_THRESHOLD,
  SETTING_KEY_UNLOCK_THRESHOLD,
} from "@/lib/constants/proposals";

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

  // アンロック判定
  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const monthCount = await db.salesActivity.count({
    where: { userId: user.id, date: { gte: monthStart } },
  });

  // 閾値取得
  const setting = await db.appSetting.findUnique({
    where: { key: SETTING_KEY_UNLOCK_THRESHOLD },
  });
  const threshold = setting ? parseInt(setting.value, 10) : DEFAULT_UNLOCK_THRESHOLD;

  if (user.role !== "ADMIN" && monthCount < threshold) {
    return NextResponse.json(
      { error: `今月のアクティビティが${threshold}件未満です（現在${monthCount}件）` },
      { status: 403 }
    );
  }

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

  const client = new Anthropic({ apiKey });

  const systemPrompt = `あなたはアドアーチグループの提案書作成AIアシスタントです。
アドアーチグループは映像制作・広告代理を中心としたクリエイティブ企業グループです。

以下の情報をもとに、提案書のコンテンツを生成してください。
出力は必ずJSON形式で、以下の構造に従ってください:

{
  "cover": {
    "title": "提案書のタイトル",
    "subtitle": "サブタイトル",
    "date": "YYYY年MM月DD日",
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

注意事項:
- アドアーチグループの強みは「全国ネットワーク」「映像制作のプロフェッショナル」「広告運用からクリエイティブまでワンストップ」
- 実績は架空で構いませんが、業界に即したリアルな内容にしてください
- ソリューションは提案先の業種と課題に最適化してください
- トーンはプロフェッショナルかつ親しみやすく
- JSON以外のテキストは出力しないでください`;

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
