import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import Anthropic from "@anthropic-ai/sdk";

const anthropic = new Anthropic();

// 実績ベースで営業文を AI 生成
export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.email) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const user = await db.user.findUnique({
    where: { email: session.user.email },
  });
  if (!user) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

  const body = await req.json();
  const { targetType, industry } = body as {
    targetType: string;
    industry?: string;
  };

  if (!targetType) {
    return NextResponse.json({ error: "targetType は必須です" }, { status: 400 });
  }

  // ── 成功実績を収集 ──

  // 1. SalesApproach（手動共有の成功事例）
  const approachFilter: Record<string, unknown> = {
    result: { in: ["DEAL", "REPLIED_NG"] },
  };
  if (industry) {
    approachFilter.industry = { contains: industry, mode: "insensitive" };
  }

  const successApproaches = await db.salesApproach.findMany({
    where: approachFilter,
    select: {
      industry: true,
      method: true,
      messageBody: true,
      result: true,
      learnings: true,
    },
    orderBy: { createdAt: "desc" },
    take: 10,
  });

  // 2. AutoSalesJob（自動営業の反響データ）
  const jobFilter: Record<string, unknown> = {
    hasResponse: true,
    status: "COMPLETED",
  };
  if (industry) {
    jobFilter.target = { industry: { contains: industry, mode: "insensitive" } };
  }

  const successJobs = await db.autoSalesJob.findMany({
    where: jobFilter,
    select: {
      responseNote: true,
      responseSnippet: true,
      template: {
        select: { pitchText: true, targetType: true, serviceTypes: true },
      },
      target: {
        select: { industry: true, area: true },
      },
    },
    orderBy: { respondedAt: "desc" },
    take: 10,
  });

  // ── 実績をプロンプト用テキストに組み立て ──
  const approachExamples = successApproaches.map((a, i) =>
    `【事例${i + 1}】結果: ${a.result === "DEAL" ? "商談化" : "返信あり"} / 業種: ${a.industry} / 方法: ${a.method}\n文面:\n${a.messageBody.substring(0, 400)}${a.learnings ? `\n学び: ${a.learnings.substring(0, 150)}` : ""}`
  ).join("\n\n");

  const jobExamples = successJobs.map((j, i) =>
    `【自動営業${i + 1}】業種: ${j.target.industry ?? "不明"} / エリア: ${j.target.area ?? "不明"}\n訴求文: ${j.template.pitchText.substring(0, 300)}${j.responseSnippet ? `\n先方反応: ${j.responseSnippet.substring(0, 100)}` : ""}`
  ).join("\n\n");

  const totalExamples = successApproaches.length + successJobs.length;

  if (totalExamples === 0) {
    return NextResponse.json({
      pitchText: null,
      approach: null,
      message: "まだ成功実績データがありません。営業活動を重ねてデータが蓄積されると、ここに実績ベースの営業文が生成されます。",
      exampleCount: 0,
    });
  }

  const targetLabel = targetType === "BTOB" ? "法人（BtoB）" : "個人・店舗（BtoC）";

  const response = await anthropic.messages.create({
    model: "claude-haiku-4-5-20251001",
    max_tokens: 1024,
    messages: [
      {
        role: "user",
        content: `あなたはアドアーチグループの営業コンサルタントです。
以下の実際の成功実績データを分析し、最も効果的な営業文テンプレートを1つ作成してください。

【条件】
- ターゲット: ${targetLabel}
${industry ? `- 業種: ${industry}` : "- 業種: 指定なし（汎用）"}

【アドアーチグループの強み（営業文に自然に組み込むこと）】
- 正規広告代理店として TVer・イオンシネマ・タクシー広告・ゴルフカート広告 等の独自媒体枠を保有
- 動画制作（15秒〜30秒の広告動画）
- SNS運用・YouTube チャンネル運用
- 地方の事業を全国的にPR

${approachExamples ? `【手動営業の成功事例】\n${approachExamples}\n` : ""}
${jobExamples ? `【自動営業の反響実績】\n${jobExamples}\n` : ""}

【出力形式】
以下の2つを出力してください。区切りに「---APPROACH---」を使用。

1. 営業文テンプレート（150〜250文字）
- 成功事例のトーンと構成を踏襲
- {industry}, {area}, {companyInsight} の変数を使用
- 自己紹介→相手への関心→提供サービス→打ち合わせ提案の流れ
- 自然体で堅すぎないトーン
- クライアント名や他社実績には絶対に言及しない

---APPROACH---

2. この営業文が効く理由（50〜100文字）
- 成功実績から読み取れるパターンを1〜2行で

営業文とアプローチのみ出力（説明や補足は不要）。`,
      },
    ],
  });

  const text = response.content[0].type === "text" ? response.content[0].text : "";
  const parts = text.split("---APPROACH---");
  const pitchText = parts[0]?.trim() ?? "";
  const approach = parts[1]?.trim() ?? "";

  return NextResponse.json({
    pitchText,
    approach,
    exampleCount: totalExamples,
    message: null,
  });
}
