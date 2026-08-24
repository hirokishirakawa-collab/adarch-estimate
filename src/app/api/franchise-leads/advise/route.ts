import Anthropic from "@anthropic-ai/sdk";
import { NextRequest, NextResponse } from "next/server";
import { validateBody, franchiseLeadAdviseSchema } from "@/lib/validations";
import { checkRateLimit, AI_RATE_LIMIT } from "@/lib/rate-limit";
import { resolveFranchiseAccess } from "@/lib/franchise-leads/access";

export const runtime = "nodejs";
export const maxDuration = 60;

// ----------------------------------------------------------------
// POST /api/franchise-leads/advise
// 特定候補への営業アプローチをClaude AIで生成
// ADMIN限定
// ----------------------------------------------------------------
export async function POST(req: NextRequest) {
  const access = await resolveFranchiseAccess();
  if (!access) {
    return NextResponse.json({ error: "この機能の利用権限がありません" }, { status: 403 });
  }

  const limited = checkRateLimit(access.email, "franchise-leads/advise", AI_RATE_LIMIT);
  if (limited) return limited;

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ error: "ANTHROPIC_API_KEY が設定されていません" }, { status: 500 });
  }

  const parsed = await validateBody(req, franchiseLeadAdviseSchema);
  if (!parsed.success) return parsed.response;
  const body = parsed.data;

  const SYSTEM_PROMPT = `あなたはAd Arch株式会社（代表: 白川裕喜）の、Ad Archグループへの加盟をお声がけする営業コンサルタントです。
指定された企業に対し、グループ加盟をご案内する営業アプローチを提案してください。

【Ad Archグループについて】
- 広告代理店・制作のグループ。OOH広告（屋外広告・デジタルサイネージ・タクシー広告・シネアド等）と映像制作を主力とする全国規模の広告会社グループ。
- フランチャイズ・グループ形式で全国26拠点が参画。
- 強みの中核: TVer・イオンシネマ・タクシー広告等、なかなか手に入らない広告媒体の正規代理店権を所持。
- 本業: クリエイティブ（映像制作・広告運用）で全国の地域貢献を継続。
- 加盟いただくと使えるようになるもの:
  1. 広告媒体の取扱い（TVer、シネアド、タクシー、サイネージ等）
  2. 経営OS（AI営業支援、見積作成、顧客管理、制作管理）
  3. グループ案件の相互紹介
  4. 全国ネットワークを活かした大型案件への参画機会
  5. 営業ツール・テンプレートの共有
- 加盟条件: 加盟金 + 最低ロイヤリティありの月額ロイヤリティ。比較的高い利益率。

【絶対に守るルール】
1. 用語: 「フランチャイズ・グループ形式」「グループ加盟」「加盟金」「ロイヤリティ」「最低ロイヤリティ」は対外的に使ってよい（解禁済み）。"加盟させてもらう側"のような上から表現にはしない。
2. 価格非開示（厳守）: 加盟金・ロイヤリティの具体的な金額（数字）は一切書かない。「加盟金とロイヤリティが必要」「最低ロイヤリティあり」「利益率は比較的高い」の表現に留め、詳細は個別のご説明の場で伝える。
3. 「発注ではなく参画」の明示（厳守）: 制作の発注依頼ではなく、グループへ参画いただく前提のご案内であることを必ず明示し誤読を防ぐ。
4. 数値効果の断定禁止（「売上○％UP」等）。「副業」禁止。
5. 相手の事業を褒めない・評価しない（「魅力的」「素晴らしい」「感銘」「とても良い」等は禁止）。事実として触れるだけ。誠実で落ち着いた丁寧語。

【dmTemplateの推奨構成（draft route と整合）】
①自己紹介（広告代理店・制作のグループ／フランチャイズ・グループ形式／なかなか手に入らない媒体代理店権／クリエイティブで全国地域貢献）→ ②御社事業×グループ加盟で双方メリット／**発注ではなく参画前提**を明示 → ③加盟金とロイヤリティ（最低ロイヤリティあり）が必要だが利益率は比較的高い／金額は個別説明へ → ④詳細URL（https://www.fc-mado.com/detail/3517）案内 → ⑤一度オンラインで少しお話しできれば、で締め

【出力形式】JSON形式で以下の3つを返してください:
{
  "dmTemplate": "初回DMメッセージのテンプレート（丁寧語、320字程度。上記構成に従う／価格非開示は厳守）",
  "talkScript": "電話トーク例（導入→自己紹介→提案趣旨（参画前提）→コスト構造（金額なし）→アポ取りの流れ、箇条書き。価格・金額には触れない）",
  "keyPoints": ["訴求ポイント1", "訴求ポイント2", "訴求ポイント3"]
}`;

  const userMessage = `【対象企業】
- 企業名: ${body.companyName}
- 住所: ${body.address}
- 業種: ${body.businessType}
- Webサイト: ${body.website || "なし"}
- AIスコア: ${body.scoreTotal ?? "未評価"}点
- スコアコメント: ${body.scoreComment || "なし"}

この企業へのグループ参画のお声がけアプローチを提案してください。用語規制・価格非開示を厳守し、JSON形式のみで返答してください。`;

  try {
    const client = new Anthropic({ apiKey });
    const response = await client.messages.create({
      model: "claude-sonnet-5",
      thinking: { type: "disabled" },
      max_tokens: 2048,
      system: [
        { type: "text", text: SYSTEM_PROMPT, cache_control: { type: "ephemeral" } },
      ],
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
