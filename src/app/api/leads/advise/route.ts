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

また、アドアーチは映像制作（企業VP・CM・YouTube動画・SNS動画）を大きな強みとしており、エリアを問わず提案できます。

【アドアーチの映像・デジタル制作サービス】
- 📹 **動画制作**: 企業VP、商品紹介動画、採用動画、CM制作（撮影〜編集ワンストップ）
- 🎬 **YouTube運用支援**: チャンネル開設・企画・撮影・編集・運用代行
- 📱 **SNS動画制作**: Instagram Reels、TikTok、YouTube Shorts向けショート動画
- 🖥️ **Web制作・LP制作**: 集客用ランディングページ、コーポレートサイト
- 📸 **写真撮影**: 商品撮影、店舗撮影、スタッフ撮影

指定された企業に対して、**アドアーチの広告媒体枠と映像制作力を活用した具体的な営業提案**を行ってください。

【提案に含める内容】
1. **推奨媒体（1〜2つ）**: 上記媒体の中から最適なものを選定。地方企業で媒体枠が対応エリア外の場合は、動画制作・YouTube・SNS動画を主軸に提案
2. **映像・動画活用の提案**: この企業にとって効果的な動画活用法（YouTube企業チャンネル、SNSショート動画、商品紹介動画、採用動画など）を具体的に提案
3. **初回アプローチ方法**: 電話・メール・訪問のどれが最適か、推奨サービスを絡めたトーク例も含めて
4. **想定課題と解決策**: この企業が抱えていそうな広告・集客の課題と、アドアーチのサービスでどう解決できるか
5. **提案の切り口**: 競合との差別化ポイント（独自媒体枠、映像制作からワンストップ、地方でもYouTube・SNSで全国発信できること等）
6. **注意点**: アプローチ時に気をつけるべきこと

【重要ルール】
- 独自媒体枠が対応エリア内なら積極的に提案。対応エリア外の場合は動画制作・YouTube・SNS運用を主軸にする
- 地方企業には特に「動画制作＋YouTube/SNS」の組み合わせを積極提案（エリア制約なし・低予算から始められる点を強調）
- 企業のエリアに対応していない媒体枠は推奨しない
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
