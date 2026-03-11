import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import Anthropic from "@anthropic-ai/sdk";
import { MEDIA_MENU_OPTIONS } from "@/lib/constants/leads";
import { validateBody, proposalGenerateSchema } from "@/lib/validations";
import { checkRateLimit, AI_RATE_LIMIT } from "@/lib/rate-limit";

export const runtime = "nodejs";
export const maxDuration = 120;

// ---- Google Places API で提案先企業の情報・口コミを取得 ----
async function fetchPlacesInfo(companyName: string) {
  const apiKey = process.env.GOOGLE_PLACES_API_KEY;
  if (!apiKey) return null;

  try {
    // 1. Text Search で企業を検索
    const searchRes = await fetch(
      "https://places.googleapis.com/v1/places:searchText",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Goog-Api-Key": apiKey,
          "X-Goog-FieldMask": [
            "places.id",
            "places.displayName",
            "places.formattedAddress",
            "places.rating",
            "places.userRatingCount",
            "places.websiteUri",
            "places.googleMapsUri",
            "places.types",
            "places.reviews",
          ].join(","),
        },
        body: JSON.stringify({
          textQuery: companyName,
          maxResultCount: 1,
          languageCode: "ja",
        }),
      }
    );

    if (!searchRes.ok) return null;

    const data = await searchRes.json();
    const place = data.places?.[0];
    if (!place) return null;

    // 口コミテキストを抽出（最大5件）
    const reviews = (place.reviews ?? [])
      .slice(0, 5)
      .map((r: { text?: { text?: string }; rating?: number }) => ({
        text: r.text?.text ?? "",
        rating: r.rating ?? 0,
      }))
      .filter((r: { text: string }) => r.text);

    return {
      name: place.displayName?.text ?? companyName,
      address: place.formattedAddress ?? "",
      rating: place.rating ?? 0,
      ratingCount: place.userRatingCount ?? 0,
      websiteUrl: place.websiteUri ?? "",
      mapsUrl: place.googleMapsUri ?? "",
      types: place.types ?? [],
      reviews,
    };
  } catch (err) {
    console.error("Places info fetch error:", err);
    return null;
  }
}

// POST /api/proposals/generate
export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.email) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const limited = checkRateLimit(session.user.email, "proposals/generate", AI_RATE_LIMIT);
  if (limited) return limited;

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return NextResponse.json(
      { error: "ANTHROPIC_API_KEY が設定されていません" },
      { status: 500 }
    );
  }

  const user = await db.user.findUnique({ where: { email: session.user.email } });
  if (!user) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

  // NOTE: アンロック判定は一時的に無効化中（テスト期間）

  const parsed = await validateBody(req, proposalGenerateSchema);
  if (!parsed.success) return parsed.response;
  const body = parsed.data;

  // ---- データ収集（並行実行） ----

  const [projects, achievements, placesInfo, leadData, hearingSheet] = await Promise.all([
    // 1. プロジェクト実績
    db.project.findMany({
      where: { status: { in: ["COMPLETED", "IN_PROGRESS"] } },
      select: {
        title: true,
        description: true,
        customer: { select: { name: true, industry: true } },
      },
      orderBy: { createdAt: "desc" },
      take: 30,
    }),

    // 2. 競合実績DB
    db.videoAchievement.findMany({
      select: {
        companyName: true,
        industry: true,
        videoType: true,
        contentSummary: true,
      },
      orderBy: { createdAt: "desc" },
      take: 30,
    }),

    // 3. Google Places API で提案先の口コミ・評価を取得
    fetchPlacesInfo(body.companyName),

    // 4. リードDBに該当企業があればスコア情報を取得
    db.lead.findFirst({
      where: { name: { contains: body.companyName } },
      select: {
        name: true,
        scoreTotal: true,
        scoreBreakdown: true,
        scoreComment: true,
        rating: true,
        ratingCount: true,
        websiteUrl: true,
        address: true,
      },
    }),

    // 5. ヒアリングシート
    body.hearingSheetId
      ? db.hearingSheet.findUnique({ where: { id: body.hearingSheetId } })
      : Promise.resolve(null),
  ]);

  // ---- データ整形 ----

  const projectLines = projects
    .filter((p) => p.title)
    .map((p) => {
      const customer = p.customer?.name || "非公開";
      const industry = p.customer?.industry || "";
      const desc = p.description ? `（${p.description.slice(0, 80)}）` : "";
      return `- ${p.title} / ${customer}${industry ? ` [${industry}]` : ""}${desc}`;
    })
    .join("\n");

  const achievementLines = achievements
    .filter((a) => a.companyName)
    .map((a) => {
      const summary = a.contentSummary ? `（${a.contentSummary.slice(0, 80)}）` : "";
      return `- ${a.companyName} [${a.industry}] ${a.videoType}${summary}`;
    })
    .join("\n");

  // 広告媒体: 提案先の業種にマッチするものをフィルタ
  const matchingMedia = MEDIA_MENU_OPTIONS.filter((m) =>
    (m.targetIndustries as readonly string[]).includes(body.industry)
  );
  const mediaLines = matchingMedia
    .map((m) => `- ${m.label}: ${m.description}（${m.scoringHint.split("。")[0]}）`)
    .join("\n");
  // マッチしない場合は全媒体を簡易表示
  const allMediaLines = MEDIA_MENU_OPTIONS
    .map((m) => `- ${m.label}: ${m.description}`)
    .join("\n");

  // Google Places 口コミ情報
  let placesSection = "";
  if (placesInfo) {
    placesSection += `--- 提案先企業のGoogle情報 ---
企業名: ${placesInfo.name}
住所: ${placesInfo.address}
Google評価: ${placesInfo.rating}（${placesInfo.ratingCount}件）
Webサイト: ${placesInfo.websiteUrl || "なし"}
Google Maps: ${placesInfo.mapsUrl}
業種タグ: ${placesInfo.types.join(", ")}`;

    if (placesInfo.reviews.length > 0) {
      placesSection += "\n\n口コミ:";
      for (const r of placesInfo.reviews) {
        placesSection += `\n- ★${r.rating} 「${r.text.slice(0, 100)}」`;
      }
    }
  }

  // リードDB情報
  let leadSection = "";
  if (leadData) {
    leadSection = `--- リードAI分析データ ---
スコア: ${leadData.scoreTotal}/100
コメント: ${leadData.scoreComment || "なし"}
Google評価: ${leadData.rating}（${leadData.ratingCount}件）
Webサイト: ${leadData.websiteUrl || "なし"}`;
  }

  // ヒアリングシート情報
  let hearingSection = "";
  if (hearingSheet) {
    const h = hearingSheet;
    const lines: string[] = ["--- ヒアリングシート（営業担当が記録済み） ---"];
    if (h.businessDescription) lines.push(`事業内容: ${h.businessDescription}`);
    if (h.targetCustomers.length > 0) lines.push(`ターゲット顧客: ${h.targetCustomers.join("、")}`);
    if (h.tradeArea) lines.push(`商圏: ${h.tradeArea}`);
    if (h.annualRevenue) lines.push(`年商規模: ${h.annualRevenue}`);
    if (h.employeeCount) lines.push(`従業員数: ${h.employeeCount}`);
    if (h.currentChannels.length > 0) lines.push(`現在の集客手段: ${h.currentChannels.join("、")}`);
    if (h.monthlyAdBudget) lines.push(`月間広告費: ${h.monthlyAdBudget}`);
    if (h.pastEfforts) lines.push(`過去に試した施策: ${h.pastEfforts}`);
    if (h.competitors) lines.push(`競合: ${h.competitors}`);
    if (h.primaryChallenge) lines.push(`最も解決したい課題: ${h.primaryChallenge}`);
    if (h.challengeDetail) lines.push(`課題の詳細: ${h.challengeDetail}`);
    if (h.interestedServices.length > 0) lines.push(`興味のあるサービス: ${h.interestedServices.join("、")}`);
    if (h.desiredTimeline) lines.push(`希望開始時期: ${h.desiredTimeline}`);
    if (h.decisionMaker) lines.push(`決裁者: ${h.decisionMaker}`);
    if (h.budgetStatus) lines.push(`予算確保状況: ${h.budgetStatus}`);
    if (h.competingVendors) lines.push(`検討中の他社: ${h.competingVendors}`);
    if (h.videoPurposes.length > 0) lines.push(`動画の用途: ${h.videoPurposes.join("、")}`);
    if (h.videoBudget) lines.push(`動画制作予算: ${h.videoBudget}`);
    if (h.temperature) lines.push(`温度感: ${h.temperature}`);
    hearingSection = lines.join("\n");
  }

  const today = new Date();
  const dateStr = `${today.getFullYear()}年${today.getMonth() + 1}月${today.getDate()}日`;

  const client = new Anthropic({ apiKey });

  const systemPrompt = `あなたはアドアーチグループの提案書作成AIアシスタントです。
アドアーチグループは映像制作・広告代理を中心としたクリエイティブ企業グループです。

以下の情報をもとに、提案書のコンテンツを生成してください。
出力は必ずJSON形式で、以下の構造に従ってください:

{
  "cover": {
    "title": "提案書のタイトル",
    "subtitle": "サブタイトル",
    "date": "${dateStr}",
    "to": "提案先企業名 御中"
  },
  "companyIntro": {
    "heading": "アドアーチグループについて",
    "description": "グループ紹介文（3〜4文）",
    "strengths": ["強み1", "強み2", "強み3"]
  },
  "proposal": {
    "heading": "ご提案",
    "challenge": "課題の要約（1〜2文）",
    "solutions": [
      {
        "title": "ソリューション名",
        "description": "説明（2〜3文）"
      }
    ]
  },
  "cases": {
    "heading": "関連実績",
    "items": [
      {
        "title": "実績タイトル",
        "description": "概要（1〜2文）"
      }
    ]
  },
  "nextSteps": {
    "heading": "次のステップ",
    "steps": ["ステップ1", "ステップ2", "ステップ3"],
    "contact": "お気軽にご相談ください。"
  }
}

【重要ルール】
- 日付は必ず「${dateStr}」を使用してください
- アドアーチグループの強みは「全国ネットワーク」「映像制作のプロフェッショナル」「広告運用からクリエイティブまでワンストップ」
- 関連実績は、以下の「実際のプロジェクト実績」と「映像制作実績」から、提案先の業種・課題に近いものを選んで記載してください
- 実績データが提案先の業種に合わない場合は、最も近いものを選び、業種横断的な価値（映像制作力・広告運用力など）を強調してください
- 絶対に架空の実績を作らないでください。下記データにある実績のみ使用してください
- 顧客名はそのまま記載して構いません
- ソリューションは提案先の業種と課題に最適化し、下記の「アドアーチが提供可能な広告媒体」から適切なものを提案に組み込んでください
- 提案先のGoogle口コミ情報がある場合、口コミから読み取れる強み・課題を提案に反映してください（例: 口コミで「認知度が低い」→広告強化提案、「ファンが熱い」→ファンマーケティング提案）
- リードAI分析データがある場合、そのスコアやコメントも提案内容に活用してください
- ヒアリングシートがある場合、顧客の事業内容・ターゲット・予算感・課題・温度感を最大限に反映し、具体的で的を射た提案にしてください
- ヒアリングシートの「興味のあるサービス」や「動画の用途」があれば、ソリューションに優先的に組み込んでください
- トーンはプロフェッショナルかつ親しみやすく
- JSON以外のテキストは出力しないでください

--- アドアーチが提供可能な広告媒体（業種マッチ） ---
${matchingMedia.length > 0 ? mediaLines : "（業種に直接マッチする媒体なし。以下全媒体から最適なものを選択してください）\n" + allMediaLines}

--- 実際のプロジェクト実績 ---
${projectLines || "（データなし）"}

--- 映像制作実績（競合分析データベースより） ---
${achievementLines || "（データなし）"}

${placesSection}

${leadSection}

${hearingSection}`;

  const userPrompt = `提案先企業: ${body.companyName}
業種: ${body.industry}
課題・ニーズ: ${body.challenge}`;

  const response = await client.messages.create({
    model: "claude-sonnet-4-20250514",
    max_tokens: 4096,
    messages: [{ role: "user", content: userPrompt }],
    system: systemPrompt,
  });

  const text =
    response.content[0].type === "text" ? response.content[0].text : "";

  let content;
  try {
    const jsonMatch = text.match(/```json\s*([\s\S]*?)```/) || [null, text];
    content = JSON.parse(jsonMatch[1]!.trim());
  } catch {
    return NextResponse.json(
      { error: "AI応答のパースに失敗しました", raw: text },
      { status: 500 }
    );
  }

  // DB保存
  const proposal = await db.proposal.create({
    data: {
      userId: user.id,
      companyName: body.companyName,
      industry: body.industry,
      challenge: body.challenge,
      content,
    },
  });

  return NextResponse.json({ proposal });
}
