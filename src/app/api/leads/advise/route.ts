import Anthropic from "@anthropic-ai/sdk";
import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";

export const runtime = "nodejs";
export const maxDuration = 60;

// ----------------------------------------------------------------
// POST /api/leads/advise
// 特定企業向けの営業アプローチをAIで提案
// ----------------------------------------------------------------
export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return NextResponse.json(
      { error: "ANTHROPIC_API_KEY が設定されていません" },
      { status: 500 }
    );
  }

  const body = (await req.json()) as {
    name: string;
    address: string | null;
    phone: string | null;
    industry: string | null;
    area: string | null;
    rating: number;
    ratingCount: number;
    types: string[];
    businessStatus: string | null;
    scoreTotal: number;
    scoreComment: string | null;
    memo: string | null;
  };

  const SYSTEM_PROMPT = `あなたはアドアーチグループの営業支援AIです。
アドアーチグループは映像制作・OOH広告（屋外広告）・デジタル広告を強みとする広告会社です。

指定された企業に対して、最適な営業アプローチ方法を具体的に提案してください。

【提案に含める内容】
1. **初回アプローチ方法**: 電話・メール・訪問のどれが最適か、トーク例も含めて
2. **提案すべきサービス**: アドアーチの強み（映像制作/OOH広告/デジタル広告/SNS運用）のうち、この企業に最も刺さるもの
3. **想定課題**: この企業が抱えていそうな広告・集客の課題
4. **提案の切り口**: 競合と差別化できるポイント、刺さりそうなキーワード
5. **注意点**: アプローチ時に気をつけるべきこと

【出力ルール】
- 営業担当が読んですぐ行動できる具体的な内容にする
- 箇条書きを活用して読みやすく
- 300〜500文字程度でコンパクトにまとめる
- マークダウン形式で返答`;

  const userMessage = `【企業情報】
企業名: ${body.name}
住所: ${body.address ?? "不明"}
電話: ${body.phone ?? "なし"}
業種: ${body.industry ?? "不明"}
エリア: ${body.area ?? "不明"}
Google評価: ${body.rating}（${body.ratingCount}件）
業態タグ: ${body.types?.join(", ") ?? "なし"}
営業ステータス: ${body.businessStatus ?? "不明"}
AIスコア: ${body.scoreTotal}点
AIコメント: ${body.scoreComment ?? "なし"}
${body.memo ? `営業メモ: ${body.memo}` : ""}

この企業への最適な営業アプローチを提案してください。`;

  try {
    const client = new Anthropic({ apiKey });
    const response = await client.messages.create({
      model: "claude-sonnet-4-20250514",
      max_tokens: 1024,
      system: SYSTEM_PROMPT,
      messages: [{ role: "user", content: userMessage }],
    });

    const text =
      response.content[0].type === "text" ? response.content[0].text : "";

    return NextResponse.json({ advice: text });
  } catch (err) {
    console.error("Advise error:", err);
    return NextResponse.json(
      { error: "AI提案の生成中にエラーが発生しました" },
      { status: 500 }
    );
  }
}
