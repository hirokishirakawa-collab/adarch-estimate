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
  return `- **${m.emoji} ${m.name}**: 最低予算${(m.minBudget / 10_000).toFixed(0)}万円（4週推奨${(m.recommendedBudget / 10_000).toFixed(0)}万円）/ 強み: ${m.strengths.slice(0, 3).join("、")} / 対応エリア: ${m.coverageNote}`;
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
- 🎬 **動画制作**: 15秒〜30秒の広告用動画で30万円〜。SNS広告・YouTube広告・サイネージ・展示会など複数媒体で横展開可能（費用対効果が高い）
- ▶️ **YouTube広告**: 月額10万円〜（広告費のみ。動画素材がある前提）。幅広い年齢層に興味・属性で細かくターゲティング可能。認知拡大・採用ブランディングに有効
- 📲 **SNS運用（アカウント運用代行）**: 月額5〜30万円程度。フォロワー・潜在顧客へのじっくりした関係構築。飲食・美容・ブランド・採用強化中の企業向け
- 📱 **SNS動画制作**: Instagram Reels、TikTok、YouTube Shorts向けショート動画
- 🖥️ **Web制作・LP制作**: 集客用ランディングページ、コーポレートサイト
- 📸 **写真撮影**: 商品撮影、店舗撮影、スタッフ撮影

指定された企業に対して、**アドアーチの広告媒体枠と映像制作力を活用した具体的な営業提案**を行ってください。

【提案に含める内容】
1. **推奨サービス（1〜2つ）**: 媒体枠・映像制作・YouTube・SNSの中から最適なものを選定し、選定理由と期待効果を具体的に。地方企業で媒体枠が対応エリア外の場合は、動画制作・YouTube・SNS動画を主軸に提案
2. **映像・動画活用の提案**: この企業にとって効果的な動画活用法（YouTube企業チャンネル、SNSショート動画、商品紹介動画、採用動画など）を具体的に提案
3. **初回アプローチ（トーク例）**: 以下のルールで、そのまま電話で使えるリアルなトーク例を作成
4. **想定課題と解決策**: この企業が抱えていそうな広告・集客の課題と、アドアーチのサービスでどう解決できるか
5. **注意点**: アプローチ時に気をつけるべきこと

【初回アプローチのトーク例ルール — 最重要】
- 「お忙しいところ失礼します」「ご提案させていただきたく」のような定型営業フレーズは絶対に使わない
- プロの広告営業として、相手企業のことを事前に調べた上で声をかけるスタンスで書く
- 相手の業種・立地・Google評価・口コミ数などの具体情報を自然に会話に盛り込む（「Google Maps拝見したら評価◯◯で〜」「◯◯エリアで◯◯をされてるんですね」等）
- 最初の一言で相手に「自分のことを知っている人だ」と思わせる
- 売り込みではなく「情報提供」「事例共有」のトーンで入る（「同じ◯◯業界の企業さんで最近こういう動画が反響あって〜」等）
- 具体的なトーク例を会話形式で3〜4往復分書く

【重要ルール】
- 各媒体の最低予算を厳守すること。最低予算を下回る金額で提案しない（例: タクシー広告は最低100万円、推奨400万円）
- 予算感は「◯万円〜」ではなく「最低◯万円、効果を出すなら◯万円」のように正確に記載する
- 独自媒体枠が対応エリア内なら積極的に提案。対応エリア外の場合は動画制作・YouTube・SNS運用を主軸にする
- 地方企業には特に「動画制作＋YouTube/SNS」の組み合わせを積極提案（エリア制約なし・低予算から始められる点を強調）
- 企業のエリアに対応していない媒体枠は推奨しない
- 営業担当が読んですぐ行動できる具体的な内容にする
- 箇条書きを活用して読みやすく
- 500〜800文字程度でまとめる
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
