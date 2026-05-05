import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import Anthropic from "@anthropic-ai/sdk";
import { MEDIA_MENU_OPTIONS } from "@/lib/constants/leads";
import { validateBody, proposalGenerateSchema } from "@/lib/validations";
import { checkRateLimit, AI_RATE_LIMIT } from "@/lib/rate-limit";

export const runtime = "nodejs";
export const maxDuration = 120;

// ---- 提案先企業のWebサイトを分析 ----
async function fetchWebsiteAnalysis(websiteUrl: string): Promise<string | null> {
  if (!websiteUrl) return null;

  try {
    const url = websiteUrl.startsWith("http") ? websiteUrl : `https://${websiteUrl}`;
    const res = await fetch(url, {
      headers: { "User-Agent": "Mozilla/5.0 (compatible; AdArchBot/1.0)" },
      signal: AbortSignal.timeout(5000),
      redirect: "follow",
    });

    if (!res.ok) return null;

    const html = await res.text();

    // メタ情報
    const titleMatch = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
    const descMatch = html.match(/<meta[^>]*name=["']description["'][^>]*content=["']([\s\S]*?)["']/i)
      || html.match(/<meta[^>]*content=["']([\s\S]*?)["'][^>]*name=["']description["']/i);
    const ogImageMatch = html.match(/<meta[^>]*property=["']og:image["'][^>]*content=["']([\s\S]*?)["']/i);

    // 見出し抽出（H1〜H3）
    const headings: string[] = [];
    const hMatches = html.matchAll(/<h[123][^>]*>([\s\S]*?)<\/h[123]>/gi);
    for (const m of hMatches) {
      const text = m[1].replace(/<[^>]+>/g, "").trim();
      if (text && text.length < 100) headings.push(text);
      if (headings.length >= 10) break;
    }

    // SNSリンク検出
    const socialLinks: string[] = [];
    const socialPatterns = [
      { name: "Instagram", pattern: /instagram\.com\/[^"'\s]+/i },
      { name: "Facebook", pattern: /facebook\.com\/[^"'\s]+/i },
      { name: "Twitter/X", pattern: /(?:twitter|x)\.com\/[^"'\s]+/i },
      { name: "YouTube", pattern: /youtube\.com\/[^"'\s]+/i },
      { name: "LINE", pattern: /line\.me\/[^"'\s]+/i },
      { name: "TikTok", pattern: /tiktok\.com\/@[^"'\s]+/i },
    ];
    for (const { name, pattern } of socialPatterns) {
      if (pattern.test(html)) socialLinks.push(name);
    }

    // 広告・分析ツール検出
    const adTools: string[] = [];
    if (/gtag|google-analytics|googletagmanager/i.test(html)) adTools.push("Google Analytics/GTM");
    if (/fbq|facebook.*pixel|meta.*pixel/i.test(html)) adTools.push("Meta Pixel");
    if (/yjtag|yahoo.*tag|yads/i.test(html)) adTools.push("Yahoo広告タグ");
    if (/linead|line.*tag/i.test(html)) adTools.push("LINE広告タグ");
    if (/adsbygoogle/i.test(html)) adTools.push("Google AdSense");

    // 予約・EC系
    const platforms: string[] = [];
    if (/hotpepper/i.test(html)) platforms.push("ホットペッパー");
    if (/tabelog|食べログ/i.test(html)) platforms.push("食べログ");
    if (/gurunavi|ぐるなび/i.test(html)) platforms.push("ぐるなび");
    if (/shopify/i.test(html)) platforms.push("Shopify");
    if (/stores\.jp/i.test(html)) platforms.push("STORES");
    if (/base\.(in|ec)/i.test(html)) platforms.push("BASE");

    const lines: string[] = ["--- 提案先Webサイト分析結果 ---"];
    lines.push(`URL: ${url}`);
    if (titleMatch?.[1]) lines.push(`サイトタイトル: ${titleMatch[1].trim()}`);
    if (descMatch?.[1]) lines.push(`メタディスクリプション: ${descMatch[1].trim().slice(0, 200)}`);
    if (headings.length > 0) lines.push(`主な見出し: ${headings.slice(0, 5).join(" / ")}`);
    if (socialLinks.length > 0) lines.push(`SNSアカウント: ${socialLinks.join(", ")}`);
    else lines.push("SNSアカウント: リンクなし（SNS活用の余地あり）");
    if (adTools.length > 0) lines.push(`導入済み広告ツール: ${adTools.join(", ")}`);
    else lines.push("広告ツール: 未検出（デジタル広告は未着手の可能性）");
    if (platforms.length > 0) lines.push(`連携プラットフォーム: ${platforms.join(", ")}`);
    if (ogImageMatch?.[1]) lines.push("OGP画像: 設定あり");
    else lines.push("OGP画像: 未設定（SNSシェア時の見栄えに改善余地）");

    return lines.join("\n");
  } catch (err) {
    console.error("Website analysis error:", err);
    return null;
  }
}

// ---- 業種別のプロンプト強化ヒント ----
function getIndustryHints(industry: string): string {
  const hints: Record<string, string> = {
    restaurant: "飲食業向け: 口コミ活用・来店促進・メニュー動画・Googleマップ対策・SNS映えコンテンツが効果的。季節メニューやイベントに合わせた提案を。",
    retail: "小売業向け: 店頭POP連動・EC送客・チラシ代替デジタル広告・LINE集客・セール告知動画が効果的。オンライン×オフラインの統合提案を。",
    realestate: "不動産業向け: エリアマーケティング・物件動画（ルームツアー）・看板広告・Web広告での反響獲得が効果的。地域密着型の施策提案を。",
    beauty: "美容業向け: Instagram/TikTok活用・ビフォーアフター動画・口コミ促進・リピーター獲得施策が効果的。ビジュアル重視の提案を。",
    medical: "医療・クリニック向け: 信頼感を重視したWebサイト・Google対策・院内動画・患者向け説明コンテンツが効果的。薬機法・医療広告ガイドラインへの準拠に注意。",
    education: "教育業向け: 体験授業の動画・保護者向けSNS広告・地域密着型OOH・季節（入学/夏期講習）に合わせた広告が効果的。",
    manufacturing: "製造業向け: BtoB向けの技術動画・展示会連動コンテンツ・採用ブランディング・企業PR映像が効果的。専門性と信頼感を訴求。",
    it: "IT/テック向け: サービス紹介動画・ウェビナー連動広告・リード獲得型LP・テック系メディアへの出稿が効果的。",
    hotel: "宿泊・観光向け: 施設紹介動画・OTA連携・SNSでの体験共有促進・地域観光との連携・インバウンド対応が効果的。",
    automotive: "自動車関連向け: 店舗周辺OOH・試乗動画・Google広告（地域指定）・イベント告知が効果的。",
    fitness: "フィットネス向け: トレーニング動画・ビフォーアフター・SNSチャレンジ企画・地域ターゲティング広告が効果的。",
    wedding: "ブライダル向け: 感動的な映像制作・SNS広告（25-35歳女性ターゲット）・口コミ促進・フェア告知が効果的。",
    other: "業種横断: クライアントの事業内容をよく理解し、最も効果的な媒体ミックスを提案してください。",
  };
  return hints[industry] || hints.other;
}

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

  const [projects, placesInfo, leadData, hearingSheet] = await Promise.all([
    // 1. アドアーチグループのプロジェクト実績（自社サーバーのデータのみ）
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

    // 2. Google Places API で提案先の口コミ・評価を取得（提案先企業の情報として使用）
    fetchPlacesInfo(body.companyName),

    // 3. リードDBに該当企業があればスコア情報を取得（営業履歴として使用）
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

    // 4. ヒアリングシート（営業履歴として使用）
    body.hearingSheetId
      ? db.hearingSheet.findUnique({ where: { id: body.hearingSheetId } })
      : Promise.resolve(null),
  ]);

  // 5. Webサイト分析（Places or Lead からURLを取得して分析）
  const websiteUrl = placesInfo?.websiteUrl || leadData?.websiteUrl || "";
  const websiteAnalysis = await fetchWebsiteAnalysis(websiteUrl);

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

  const presenterName = body.presenter?.company || "アドアーチグループ";

  const industryHints = getIndustryHints(body.industry);

  const systemPrompt = `あなたは${presenterName}（アドアーチグループ）の提案書作成AIアシスタントです。
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
    "heading": "${presenterName}について",
    "description": "グループ紹介文（3〜4文）",
    "strengths": ["強み1", "強み2", "強み3"]
  },
  "proposal": {
    "heading": "ご提案したいこと",
    "challenge": "お力になれるポイントの要約（1〜2文。「課題」という言葉は使わず、「〜のお手伝いができればと考えております」のような柔らかい表現で）",
    "solutions": [
      {
        "title": "ご提案内容の名称",
        "description": "説明（2〜3文）"
      }
    ]
  },
  "mediaPlan": {
    "heading": "推奨メディアプラン",
    "description": "メディアプラン全体の説明（1〜2文。提案先の特性を踏まえたメディアミックスの考え方）",
    "items": [
      {
        "media": "媒体名（例: Instagram広告、交通広告、TVer等）",
        "purpose": "目的（例: 認知拡大、来店促進、ブランディング等）",
        "approach": "手法の概要（1文）",
        "expectedEffect": "期待される効果（1文）"
      }
    ]
  },
  "timeline": {
    "heading": "実施スケジュール（案）",
    "phases": [
      {
        "period": "期間（例: 1ヶ月目）",
        "title": "フェーズ名",
        "items": ["実施項目1", "実施項目2"]
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
- 【最重要】実績データはアドアーチグループのサーバーに登録されている「実際のプロジェクト実績」のみ使用してください。それ以外のソースから実績を生成・捏造することは絶対に禁止です
- 下記の「実際のプロジェクト実績」に記載のある案件のみを「関連実績」セクションに使用してください。データにない実績は一切記載しないでください
- 実績データが提案先の業種に合わない場合は、最も近いものを選び、業種横断的な価値（映像制作力・広告運用力など）を強調してください
- 実績データが「（データなし）」の場合は、casesセクションのitemsを空配列にしてください。架空の実績で埋めることは絶対にしないでください
- 顧客名はそのまま記載して構いません
- ソリューションは提案先の業種に最適化し、下記の「アドアーチが提供可能な広告媒体」から適切なものを提案に組み込んでください
- 提案先のGoogle口コミ情報がある場合、口コミから読み取れる強みやポテンシャルを活かした提案にしてください（例: 口コミで「ファンが熱い」→ファンマーケティング提案）
- リードAI分析データがある場合、そのスコアやコメントも提案内容に活用してください
- ヒアリングシートがある場合、顧客の事業内容・ターゲット・予算感・温度感を最大限に反映し、具体的で的を射た提案にしてください
- ヒアリングシートの「興味のあるサービス」や「動画の用途」があれば、ソリューションに優先的に組み込んでください
- 【重要】初回商談前の提案書です。相手の「課題」を決めつける表現は絶対に避けてください。「課題」「問題点」「ニーズ」という言葉は使わず、「お力になれること」「ご提案したいこと」「お手伝いできるポイント」のような柔らかく前向きな表現を使ってください
- トーンはプロフェッショナルかつ丁寧で謙虚に。上から目線にならないよう注意してください
- JSON以外のテキストは出力しないでください

【mediaPlan セクションのルール】
- 提案先の業種・規模・現在のデジタル活用状況に合わせて、最適な媒体を2〜4つ選定してください
- Webサイト分析結果がある場合、SNS未活用ならSNS広告を、広告ツール未導入ならデジタル広告の導入を優先的に提案してください
- Web広告とOOH/マス広告の両方を組み合わせた「メディアミックス」を心がけてください
- 具体的な媒体名を使ってください（「デジタル広告」ではなく「Instagram広告」「Google検索広告」等）

【timeline セクションのルール】
- 3〜4フェーズで実施スケジュール案を構成してください（準備→実施→効果検証→改善のサイクル）
- 各フェーズの期間は「1ヶ月目」「2〜3ヶ月目」等の形式で
- 提案内容に対応した具体的な実施項目を記載してください

【業種別ヒント】
${industryHints}

--- アドアーチが提供可能な広告媒体（業種マッチ） ---
${matchingMedia.length > 0 ? mediaLines : "（業種に直接マッチする媒体なし。以下全媒体から最適なものを選択してください）\n" + allMediaLines}

--- アドアーチグループの実際のプロジェクト実績（自社サーバー登録データ） ---
${projectLines || "（データなし — 実績セクションは空にしてください）"}

${placesSection}

${leadSection}

${hearingSection}

${websiteAnalysis || ""}`;

  const titleInstruction = body.proposalTitle
    ? `\n提案書タイトル: 「${body.proposalTitle}」を cover.title にそのまま使用してください`
    : "";

  const userPrompt = `提案先企業: ${body.companyName}
業種: ${body.industry}
ご提案したいこと: ${body.challenge}${titleInstruction}`;

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

  // presenterをcontentにマージ
  if (body.presenter) {
    content.presenter = body.presenter;
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
