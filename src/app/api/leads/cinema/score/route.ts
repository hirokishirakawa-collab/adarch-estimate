import Anthropic from "@anthropic-ai/sdk";
import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { validateBody, cinemaScoreSchema } from "@/lib/validations";
import { checkRateLimit, AI_RATE_LIMIT } from "@/lib/rate-limit";
import type { CinemaPlaceLead } from "@/lib/constants/cinema-leads";
import type { WebsiteAnalysis, BusinessType } from "@/lib/constants/leads";
import { getSuccessProfileDual } from "@/lib/leads/success-profile";
import { getSessionInfo } from "@/lib/session";

export const runtime = "nodejs";
export const maxDuration = 120;

// ----------------------------------------------------------------
// 簡易Webサイト分析（既存 score/route.ts と同等のロジック）
// ----------------------------------------------------------------
async function analyzeWebsite(url: string): Promise<WebsiteAnalysis> {
  const empty: WebsiteAnalysis = {
    hasWebsite: false,
    hasVideo: false,
    hasYouTube: false,
    hasSns: [],
    siteAge: "unknown",
    hasRecruitPage: false,
    businessType: "unknown" as BusinessType,
    businessTypeReason: "",
    summary: "Webサイトなし",
  };

  if (!url) return empty;

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 6000);

    const res = await fetch(url, {
      signal: controller.signal,
      headers: {
        "User-Agent": "Mozilla/5.0 (compatible; AdArchBot/1.0; +https://adarch.co.jp)",
        Accept: "text/html",
      },
      redirect: "follow",
    });
    clearTimeout(timeout);

    if (!res.ok) return { ...empty, hasWebsite: true, summary: "サイトアクセス不可" };

    const html = await res.text();
    const lower = html.toLowerCase();

    const hasYouTube = lower.includes("youtube.com/embed") || lower.includes("youtube.com/watch") || lower.includes("youtu.be/");
    const hasVideo = hasYouTube || lower.includes("<video") || lower.includes("vimeo.com");

    const snsPatterns: [string, RegExp][] = [
      ["Instagram", /instagram\.com\/[a-zA-Z0-9_.]+/],
      ["Twitter/X", /(?:twitter\.com|x\.com)\/[a-zA-Z0-9_]+/],
      ["Facebook", /facebook\.com\/[a-zA-Z0-9_.]+/],
      ["LINE", /line\.me\//],
    ];
    const hasSns = snsPatterns.filter(([, re]) => re.test(lower)).map(([name]) => name);

    const hasViewport = lower.includes('name="viewport"');
    const siteAge: WebsiteAnalysis["siteAge"] = hasViewport ? "modern" : "outdated";

    const hasRecruitPage = lower.includes("recruit") || lower.includes("career") || lower.includes("採用") || lower.includes("求人");

    const parts: string[] = [];
    if (hasVideo) parts.push("動画あり");
    else parts.push("動画未活用");
    if (hasSns.length > 0) parts.push(`SNS: ${hasSns.join(",")}`);
    else parts.push("SNSなし");
    if (siteAge === "outdated") parts.push("サイト古め");
    if (hasRecruitPage) parts.push("採用ページあり");

    return {
      hasWebsite: true,
      hasVideo,
      hasYouTube,
      hasSns,
      siteAge,
      hasRecruitPage,
      businessType: "independent" as BusinessType,
      businessTypeReason: "",
      summary: parts.join(" / "),
    };
  } catch {
    return { ...empty, hasWebsite: true, summary: "サイト取得タイムアウト" };
  }
}

// ----------------------------------------------------------------
// POST /api/leads/cinema/score
// シネアド特化のAIスコアリング
// ----------------------------------------------------------------
export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const limited = checkRateLimit(session.user.email!, "leads/cinema/score", AI_RATE_LIMIT);
  if (limited) return limited;

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ error: "ANTHROPIC_API_KEY が設定されていません" }, { status: 500 });
  }

  const parsed = await validateBody(req, cinemaScoreSchema);
  if (!parsed.success) return parsed.response;
  const body = parsed.data as {
    places: CinemaPlaceLead[];
    theaterName: string;
    industry: string;
  };

  // 拠点情報を取得
  const sessionInfo = await getSessionInfo();
  const branchIds = sessionInfo
    ? [sessionInfo.branchId, sessionInfo.branchId2].filter((id): id is string => !!id)
    : [];

  // Webサイト分析 + 成功プロファイル（並列）
  const [analyses, dualProfile] = await Promise.all([
    Promise.all(body.places.map((p) => analyzeWebsite(p.websiteUrl))),
    getSuccessProfileDual(body.industry, "CINEMA_AD", branchIds),
  ]);
  const successProfile = dualProfile?.primary ?? null;

  const SYSTEM_PROMPT = `あなたはアドアーチグループのシネマ広告（イオンシネマ）営業支援AIです。
イオンシネマ劇場周辺の企業リストを受け取り、シネマ広告のリード（見込み客）としての優先度をスコアリングしてください。

【シネマ広告の特徴】
- 映画上映前のスクリーン広告（15秒/30秒）
- 大画面・高音質でブランド訴求力が高い
- 商圏は劇場から半径3〜20kmの地元企業がターゲット
- 映画来場者（ファミリー・カップル・シニア）にリーチ
- 想定月額: 約30万円〜（ランク・本数による）

【スコアリング基準（合計100点）】
1. 業種適合度（25点）: シネアドと相性の良い業種か。不動産・自動車・ブライダル・クリニック・地場建設業の採用 → 高得点。Google業種ラベルやAIプレイスサマリーが付記されている場合はそれも参考にする。
2. 劇場距離（20点）: 劇場に近いほど高得点。3km以内: 18-20点、5km: 14-17点、10km: 10-13点、15km: 6-9点、20km: 2-5点
3. 規模感（15点）: 月30万円以上の広告予算が見込めるか。複数店舗・知名度・サイト整備 → 高得点。AIレビューサマリーの評判・繁盛度も参考にする。
4. デジタル活用度（15点）: 動画やSNSを活用している企業 = 広告への理解・投資意欲が高い → 高得点。デジタル未活用 = 広告に予算を割く文化がない可能性 → 低得点
5. 地域密着度（15点）: 地元の来場者にリーチできる業態か。地域に根差した事業 → 高得点。全国チェーンの一店舗 → 低得点。周辺エリアサマリーが付記されている場合はエリアの商業ポテンシャルも考慮。
6. 接触しやすさ（10点）: 電話番号の有無、営業ステータスから判定。近日開業予定（FUTURE_OPENING）の場合は開業前アプローチの好機として加点。

【Google AIサマリーの活用】
- 「Googleレビュー要約」: 顧客の評判から繁盛度・サービス品質を判断。ネガティブ評価→ブランディング提案の好機
- 「Google概要」: 事業内容・業種の正確な把握。typesだけでは分からない詳細を補完
- 「周辺エリア」: 劇場周辺の商業的ポテンシャル。地域密着度スコアの判断材料
- 「近日開業」: 新規開業=広告ニーズ最大。開業告知としてのシネアド活用をコメントで提案

【重要ルール】
- コメントに具体的な数値予測（「売上○％UP」等）は絶対に書かない
- 必ずJSON配列のみで返答（前置きや後書き一切不要）
- コメントはシネアド営業担当が読む想定で、「この企業にシネアドをどう提案するか」のヒントを含める
- 採用ページがある建設業は「採用動画→シネアド上映」のクロスセル提案を示唆

【出力JSON形式】
[
  {
    "name": "企業名",
    "total": 78,
    "breakdown": {
      "industryMatch": 22,
      "proximity": 18,
      "scale": 12,
      "digitalPresence": 12,
      "localFit": 10,
      "accessibility": 7
    },
    "comment": "劇場から3km圏内の独立系不動産。動画未活用でシネアド提案に最適。モデルルーム来場誘導に映画館広告が効果的。"
  }
]`;

  const placeSummary = body.places
    .map(
      (p, i) => {
        // Google AIサマリー情報を構築
        const aiParts: string[] = [];
        if (p.reviewSummary) aiParts.push(`Googleレビュー要約:${p.reviewSummary}`);
        if (p.placeSummary) aiParts.push(`Google概要:${p.placeSummary}`);
        if (p.neighborhoodSummary) aiParts.push(`周辺エリア:${p.neighborhoodSummary}`);
        if (p.googleMapsTypeLabel) aiParts.push(`Google業種ラベル:${p.googleMapsTypeLabel}`);
        if (p.isFutureOpening) aiParts.push(`★近日開業予定★`);
        const aiInfo = aiParts.length > 0 ? ` | ${aiParts.join(" | ")}` : "";
        return `${i + 1}. ${p.name} | ${p.address} | 劇場から${p.distanceKm}km（${p.radiusBand}km圏） | 電話:${p.phone || "なし"} | 評価:${p.rating}(${p.ratingCount}件) | ステータス:${p.businessStatus} | 業態:${p.types.slice(0, 5).join(",")} | Web:${p.websiteUrl || "なし"} | サイト分析:${analyses[i].summary}${aiInfo}`;
      }
    )
    .join("\n");

  // 成功プロファイルがあれば注入
  const profileSection = successProfile
    ? `\n${successProfile.promptText}\n`
    : "";

  const userMessage = `【対象劇場】イオンシネマ${body.theaterName}
【対象業種】${body.industry}
${profileSection}
【企業リスト】
${placeSummary}

上記の企業リストをシネマ広告のリードとしてスコアリングしてください。JSON配列のみで返答してください。`;

  try {
    const client = new Anthropic({ apiKey });
    const response = await client.messages.create({
      model: "claude-sonnet-4-20250514",
      max_tokens: 4096,
      system: SYSTEM_PROMPT,
      messages: [{ role: "user", content: userMessage }],
    });

    const text = response.content[0].type === "text" ? response.content[0].text : "";
    const jsonMatch = text.match(/\[[\s\S]*\]/);
    if (!jsonMatch) {
      return NextResponse.json({ error: "AIレスポンスのパースに失敗しました" }, { status: 500 });
    }

    const scores = JSON.parse(jsonMatch[0]);

    const analysisMap: Record<string, WebsiteAnalysis> = {};
    body.places.forEach((p, i) => {
      analysisMap[p.name] = analyses[i];
    });

    return NextResponse.json({
      scores,
      analyses: analysisMap,
      successProfile: successProfile
        ? {
            successCount: successProfile.successCount,
            skippedCount: successProfile.skippedCount,
            avgTotal: successProfile.avgTotal,
            avgBreakdown: successProfile.avgBreakdown,
            dataSource: successProfile.dataSource,
          }
        : null,
      groupProfile: dualProfile?.groupProfile
        ? {
            successCount: dualProfile.groupProfile.successCount,
            avgTotal: dualProfile.groupProfile.avgTotal,
            avgBreakdown: dualProfile.groupProfile.avgBreakdown,
          }
        : null,
    });
  } catch (err) {
    console.error("Cinema scoring error:", err);
    return NextResponse.json({ error: "スコアリング中にエラーが発生しました" }, { status: 500 });
  }
}
