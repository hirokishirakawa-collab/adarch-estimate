import Anthropic from "@anthropic-ai/sdk";
import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { validateBody, franchiseLeadAdviseSchema } from "@/lib/validations";
import { checkRateLimit, AI_RATE_LIMIT } from "@/lib/rate-limit";
import type { UserRole } from "@/types/roles";

export const runtime = "nodejs";
export const maxDuration = 60;

// ----------------------------------------------------------------
// POST /api/franchise-leads/advise
// 特定候補への営業アプローチをClaude AIで生成
// ADMIN限定
// ----------------------------------------------------------------
export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const role = (session.user.role ?? "USER") as UserRole;
  if (role !== "ADMIN") {
    return NextResponse.json({ error: "管理者権限が必要です" }, { status: 403 });
  }

  const limited = checkRateLimit(session.user.email!, "franchise-leads/advise", AI_RATE_LIMIT);
  if (limited) return limited;

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ error: "ANTHROPIC_API_KEY が設定されていません" }, { status: 500 });
  }

  const parsed = await validateBody(req, franchiseLeadAdviseSchema);
  if (!parsed.success) return parsed.response;
  const body = parsed.data;

  const SYSTEM_PROMPT = `あなたはAd Arch株式会社（代表: 白川裕喜）の加盟促進営業コンサルタントです。
指定された企業に対する加盟勧誘の営業アプローチを提案してください。

【Ad Archグループについて】
- OOH広告（屋外広告・デジタルサイネージ・タクシー広告・シネアド等）と映像制作を主力とする広告会社グループ
- 全国26社のパートナーネットワーク、年間数百件の案件実績
- 加盟条件: 加盟金50万円+税、ロイヤリティ月額5万円
- 加盟メリット:
  1. OOH広告媒体の取扱い権（TVer、シネアド、タクシー、サイネージ等）
  2. 経営OS（AI営業支援、見積作成、顧客管理、制作管理）
  3. グループ案件の相互紹介
  4. 全国ネットワークを活かした大型案件への参画機会
  5. 営業ツール・テンプレートの共有

【出力形式】JSON形式で以下の3つを返してください:
{
  "dmTemplate": "初回DMメッセージのテンプレート（丁寧語、200字程度）",
  "talkScript": "電話トーク例（導入→メリット提示→アポ取りの流れ、箇条書き）",
  "keyPoints": ["訴求ポイント1", "訴求ポイント2", "訴求ポイント3"]
}`;

  const userMessage = `【対象企業】
- 企業名: ${body.companyName}
- 住所: ${body.address}
- 業種: ${body.businessType}
- Webサイト: ${body.website || "なし"}
- AIスコア: ${body.scoreTotal ?? "未評価"}点
- スコアコメント: ${body.scoreComment || "なし"}

この企業への加盟勧誘アプローチを提案してください。JSON形式のみで返答してください。`;

  try {
    const client = new Anthropic({ apiKey });
    const response = await client.messages.create({
      model: "claude-sonnet-4-20250514",
      max_tokens: 2048,
      system: SYSTEM_PROMPT,
      messages: [{ role: "user", content: userMessage }],
    });

    const text = response.content[0].type === "text" ? response.content[0].text : "";

    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      return NextResponse.json({ error: "AIレスポンスのパースに失敗しました" }, { status: 500 });
    }

    const advice = JSON.parse(jsonMatch[0]);
    return NextResponse.json(advice);
  } catch (err) {
    console.error("Franchise lead advise error:", err);
    return NextResponse.json({ error: "営業アドバイス生成中にエラーが発生しました" }, { status: 500 });
  }
}
