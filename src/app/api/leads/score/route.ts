import Anthropic from "@anthropic-ai/sdk";
import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import type { PlaceLead } from "@/lib/constants/leads";

export const runtime = "nodejs";
export const maxDuration = 60;

// ----------------------------------------------------------------
// POST /api/leads/score
// Anthropic API で企業リストをスコアリング
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
    places: PlaceLead[];
    industry: string;
    area: string;
  };

  const SYSTEM_PROMPT = `あなたはアドアーチグループの営業支援AIです。
企業リストを受け取り、広告営業のリード（見込み客）としての優先度をスコアリングしてください。

【スコアリング基準（合計100点）】
1. 業種一致度（30点）: 指定業種とのマッチ度。業種が一致すれば高得点。
2. 活発度（20点）: Googleレビュー数・評価から推測する事業活動レベル。レビューが多く評価も高ければ活発。
3. 規模感（20点）: 住所・レビュー数・業態から推測する企業規模。
4. 競合優位性（15点）: アドアーチの強み（映像制作・OOH広告）が活きそうか。
5. 接触しやすさ（15点）: 電話番号の有無、営業ステータス（OPERATIONAL等）から判定。

【重要ルール】
- 必ずJSON配列のみで返答（前置きや後書き一切不要）
- 各企業に対して上記5項目の内訳スコアと合計スコア、1行コメントを付与
- 合計スコアは各項目の合計（最大100点）
- コメントは営業担当が読む想定で、アプローチのヒントを含める

【出力JSON形式】
[
  {
    "name": "企業名",
    "total": 75,
    "breakdown": {
      "industryMatch": 25,
      "activity": 15,
      "scale": 15,
      "competitive": 10,
      "accessibility": 10
    },
    "comment": "レビュー数が多く活発。飲食チェーンでOOH広告との相性良好。電話番号あり、直接アプローチ推奨。"
  }
]`;

  const placeSummary = body.places
    .map(
      (p, i) =>
        `${i + 1}. ${p.name} | ${p.address} | 電話:${p.phone || "なし"} | 評価:${p.rating}(${p.ratingCount}件) | ステータス:${p.businessStatus} | 業態:${p.types.slice(0, 5).join(",")}`
    )
    .join("\n");

  const userMessage = `【対象業種】${body.industry}
【対象エリア】${body.area}

【企業リスト】
${placeSummary}

上記の企業リストをスコアリングしてください。JSON配列のみで返答してください。`;

  try {
    const client = new Anthropic({ apiKey });
    const response = await client.messages.create({
      model: "claude-sonnet-4-20250514",
      max_tokens: 4096,
      system: SYSTEM_PROMPT,
      messages: [{ role: "user", content: userMessage }],
    });

    const text =
      response.content[0].type === "text" ? response.content[0].text : "";

    // JSON部分を抽出（万が一マークダウンで囲まれていた場合も対応）
    const jsonMatch = text.match(/\[[\s\S]*\]/);
    if (!jsonMatch) {
      return NextResponse.json(
        { error: "AIレスポンスのパースに失敗しました" },
        { status: 500 }
      );
    }

    const scores = JSON.parse(jsonMatch[0]);
    return NextResponse.json({ scores });
  } catch (err) {
    console.error("Scoring error:", err);
    return NextResponse.json(
      { error: "スコアリング中にエラーが発生しました" },
      { status: 500 }
    );
  }
}
