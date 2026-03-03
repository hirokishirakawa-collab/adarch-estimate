import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import Anthropic from "@anthropic-ai/sdk";

const TTL_DAYS = 7;

export async function GET(request: Request) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "認証が必要です" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const companyName = searchParams.get("company");

  if (!companyName) {
    return NextResponse.json({ error: "company パラメータが必要です" }, { status: 400 });
  }

  // キャッシュチェック（7日TTL）
  const cached = await db.aIMatchingCache.findUnique({
    where: { companyName },
  });

  if (cached) {
    const age = Date.now() - new Date(cached.updatedAt).getTime();
    if (age < TTL_DAYS * 24 * 60 * 60 * 1000) {
      return NextResponse.json(JSON.parse(cached.matchResultJson));
    }
  }

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return NextResponse.json(
      { error: "ANTHROPIC_API_KEY が設定されていません" },
      { status: 500 }
    );
  }

  try {
    // 対象企業の名刺情報を取得
    const targetCards = await db.businessCard.findMany({
      where: { companyName },
      select: {
        companyName: true,
        department: true,
        title: true,
        aiIndustry: true,
        aiSummary: true,
        aiTags: true,
        wantsCollab: true,
      },
      take: 5,
    });

    if (targetCards.length === 0) {
      return NextResponse.json({ error: "企業が見つかりません" }, { status: 404 });
    }

    // DB全社のユニーク企業リストを取得（AIマッチング用）
    const allCompanies = await db.businessCard.findMany({
      where: {
        companyName: { not: companyName },
        isCompetitor: false,
      },
      select: {
        companyName: true,
        aiIndustry: true,
        aiSummary: true,
        wantsCollab: true,
      },
      distinct: ["companyName"],
      take: 200,
    });

    const targetInfo = targetCards[0];
    const companyList = allCompanies
      .map(
        (c) =>
          `${c.companyName}（${c.aiIndustry ?? "不明"}${c.wantsCollab ? "・コラボ希望" : ""}）`
      )
      .join("\n");

    const client = new Anthropic({ apiKey });

    const response = await client.messages.create({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 2000,
      messages: [
        {
          role: "user",
          content: `以下の企業とマッチング（協業・紹介・共同案件）の相性が良い企業を候補リストから最大5社選び、マッチ度とコラボ案を提案してください。

【対象企業】
会社名: ${targetInfo.companyName}
業界: ${targetInfo.aiIndustry ?? "不明"}
事業概要: ${targetInfo.aiSummary ?? "不明"}
AIタグ: ${targetInfo.aiTags ?? "なし"}

【候補企業リスト】
${companyList}

以下のJSON配列形式で回答してください（他の文字は不要）:
[
  {
    "companyName": "マッチ企業名",
    "matchScore": 85,
    "reason": "マッチング理由（1行30文字以内）",
    "collabIdea": "具体的なコラボレーション案（1行50文字以内）"
  }
]`,
        },
      ],
    });

    const text =
      response.content[0].type === "text" ? response.content[0].text : "";
    const jsonMatch = text.match(/\[[\s\S]*\]/);

    if (!jsonMatch) {
      return NextResponse.json(
        { error: "マッチング結果の解析に失敗しました" },
        { status: 500 }
      );
    }

    const matches = JSON.parse(jsonMatch[0]);

    // キャッシュに保存
    await db.aIMatchingCache.upsert({
      where: { companyName },
      create: {
        companyName,
        matchResultJson: JSON.stringify(matches),
      },
      update: {
        matchResultJson: JSON.stringify(matches),
      },
    });

    return NextResponse.json(matches);
  } catch (e) {
    console.error("[Matching] Error:", e);
    return NextResponse.json(
      { error: "マッチング処理中にエラーが発生しました" },
      { status: 500 }
    );
  }
}
