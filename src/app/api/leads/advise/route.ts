import Anthropic from "@anthropic-ai/sdk";
import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { MEDIA_MATRIX, MEDIA_ORDER } from "@/lib/strategy-matrix";

export const runtime = "nodejs";
export const maxDuration = 60;

// ----------------------------------------------------------------
// 媒体マトリクス文字列（プロンプト用）
// ----------------------------------------------------------------
const MEDIA_TEXT = MEDIA_ORDER.map((id) => {
  const m = MEDIA_MATRIX[id];
  return `- **${m.emoji} ${m.name}**: 予算${(m.minBudget / 10_000).toFixed(0)}万円〜 / 強み: ${m.strengths.slice(0, 3).join("、")} / 対応エリア: ${m.coverageNote}`;
}).join("\n");

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
アドアーチグループは映像制作・OOH広告（屋外広告）・デジタル広告を強みとする広告会社で、以下の独自広告媒体枠を保有しています。

【アドアーチ取り扱い広告媒体】
${MEDIA_TEXT}

指定された企業に対して、**アドアーチの広告媒体枠を活用した具体的な営業提案**を行ってください。

【提案に含める内容】
1. **推奨媒体（1〜2つ）**: 上記媒体の中から、この企業の業種・エリア・ターゲット層に最も効果的な媒体を選び、選定理由と期待効果を具体的に説明
2. **初回アプローチ方法**: 電話・メール・訪問のどれが最適か、推奨媒体を絡めたトーク例も含めて
3. **想定課題と媒体での解決策**: この企業が抱えていそうな広告・集客の課題と、アドアーチの媒体でどう解決できるか
4. **提案の切り口**: 競合広告会社と差別化できるポイント（独自媒体枠であること、映像制作からワンストップであること等）
5. **注意点**: アプローチ時に気をつけるべきこと

【重要ルール】
- 必ずアドアーチの独自媒体枠（TVer/すかいらーく/イオンシネマ/タクシー/ゴルフカート/おもチャンネル）を中心に提案すること
- SNS・Web広告はサポート的な位置づけにする
- 企業のエリアに対応していない媒体は推奨しない
- 営業担当が読んですぐ行動できる具体的な内容にする
- 箇条書きを活用して読みやすく
- 400〜600文字程度でコンパクトにまとめる
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
      max_tokens: 2048,
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
