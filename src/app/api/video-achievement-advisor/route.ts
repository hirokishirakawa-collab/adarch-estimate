export const runtime = "nodejs";
export const maxDuration = 30;

import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { auth } from "@/lib/auth";

interface AdvisorRequest {
  companyName:       string;
  productionCompany: string;
  videoType:         string;
  industry:          string;
  contentSummary?:   string;
}

interface AdvisorResponse {
  talkPoint:         string;
  keyQuestion:       string;
  adArchStrengths:   string[];
  replaceHook:       string;
}

// ---------------------------------------------------------------
// POST /api/video-achievement-advisor
// ---------------------------------------------------------------
export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ error: "AI機能が設定されていません" }, { status: 500 });
  }

  let body: AdvisorRequest;
  try {
    body = await req.json() as AdvisorRequest;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const { companyName, productionCompany, videoType, industry, contentSummary } = body;
  if (!companyName || !productionCompany) {
    return NextResponse.json({ error: "companyName と productionCompany は必須です" }, { status: 400 });
  }

  const client = new Anthropic({ apiKey });

  const prompt = `あなたはアドアーチグループの営業支援AIです。
競合の${productionCompany}が${companyName}（${industry}業）に制作した
${videoType}実績:「${contentSummary ?? "詳細不明"}」を踏まえ、
アドアーチが「より良い提案」でリプレイスするための
乗り換え提案スクリプトをJSONで返してください。
前置き・後書き・Markdownコードブロック不要。JSONのみ出力してください。

{
  "talkPoint": "切り出しトーク（150文字以内）",
  "keyQuestion": "アポで使える質問（1文）",
  "adArchStrengths": ["優位性1", "優位性2", "優位性3"],
  "replaceHook": "現在の取引先からの乗り換えを後押しするフック（1文）"
}`;

  try {
    const message = await client.messages.create({
      model:      "claude-haiku-4-5-20251001",
      max_tokens: 1024,
      messages:   [{ role: "user", content: prompt }],
    });

    const content = message.content[0];
    if (content.type !== "text") {
      return NextResponse.json({ error: "AIの応答が不正です" }, { status: 500 });
    }

    const result = JSON.parse(content.text) as AdvisorResponse;
    return NextResponse.json(result);
  } catch (e) {
    console.error("[video-achievement-advisor]", e);
    return NextResponse.json({ error: "AI処理に失敗しました" }, { status: 500 });
  }
}
