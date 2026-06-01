import Anthropic from "@anthropic-ai/sdk";
import { NextRequest, NextResponse } from "next/server";
import { checkRateLimit, AI_RATE_LIMIT } from "@/lib/rate-limit";
import { resolveCreatorAccess } from "@/lib/creator-leads/access";

export const runtime = "nodejs";
export const maxDuration = 120;

// ----------------------------------------------------------------
// POST /api/creator-leads/search
// Claude + Web検索で個人クリエイターを発掘し、クリエイター加盟プラン適合度をスコアリング
// 白川代表（ADMIN）限定
// ----------------------------------------------------------------

const SYSTEM_PROMPT = `あなたはAd Arch株式会社の「クリエイター発掘AI」です。
Web検索を使って、Ad Archグループの【クリエイター加盟プラン（参画費用120万円＋税）】の候補となる
個人クリエイターを実在ベースで発掘し、適合度をスコアリングしてください。

【狙うクリエイター像】
- 動画・デザイン・Web・写真などの制作を生業とする、1人〜少人数の独立クリエイター/個人事業者。
- 広告媒体プラン代表からの制作発注を受けたり、グループの案件・実績共有・単価向上の仕組みに乗って成長できる人。
- 自己表現に振り切った作家気質ではなく、案件をこなし売上を伸ばす「商売気質」寄り。
- 120万円＋税を投資できる事業体力（継続的な仕事・実績）がうかがえること。

【厳守ルール】
- 実在検証必須：Web検索で実際にヒットした、URLが生きている実在のクリエイターのみ。推測・記憶で人物やURLを創作しない。
- 連絡先は公開ポートフォリオ（Vook / foriio / 個人サイト等）や公開SNSのみ。私的アカウント・非公開連絡先はNG。
- 発信フレッシュネス：直近6ヶ月以内に活動・発信の形跡があること。古い/休止は除外。
- 既に活動が止まっている、または明らかに大手所属・社員多数の制作会社は除外。

【スコアリング（合計100点）— クリエイター加盟プラン適合度】
1. 制作力・実績（25点）: ポートフォリオの質・量、実績の確かさ。
2. 商売気質・ビジネス志向（25点）: 案件志向で売上を伸ばす姿勢か。作家気質に振り切っていないか。
3. 発信の活発さ（15点）: 直近6ヶ月の発信・更新の活発さ。
4. 経済力・独立度（15点）: 120万＋税を払える事業基盤・継続性がうかがえるか。
5. ジャンル適合（20点）: 動画・広告系などグループ案件/媒体との相性。

【出力】
- 必ず最後に output_creators ツールを呼び、発掘した各クリエイターを構造化して返すこと。
- scoreComment は白川代表が読む想定で、適合理由とアプローチのヒントを1〜2文で。
- fitReason はクリエイター加盟プランに合う理由、aiAdvice は初回アプローチの提案。
- URL は実在確認できたものだけ入れる（無いものは空文字）。`;

const OUTPUT_TOOL: Anthropic.Messages.Tool = {
  name: "output_creators",
  description: "発掘したクリエイター候補を構造化して出力する",
  input_schema: {
    type: "object",
    properties: {
      creators: {
        type: "array",
        items: {
          type: "object",
          properties: {
            name: { type: "string", description: "氏名 or 屋号" },
            handle: { type: "string" },
            prefecture: { type: "string" },
            genre: { type: "string", description: "動画/デザイン/Web/写真 等" },
            skills: { type: "string" },
            achievements: { type: "string", description: "実績メモ" },
            portfolioUrl: { type: "string", description: "Vook/foriio/個人サイト等の実在URL" },
            websiteUrl: { type: "string" },
            youtubeUrl: { type: "string" },
            instagramUrl: { type: "string" },
            xUrl: { type: "string" },
            tiktokUrl: { type: "string" },
            email: { type: "string" },
            scoreTotal: { type: "number", description: "合計スコア（0-100）" },
            scoreComment: { type: "string" },
            fitReason: { type: "string" },
            aiAdvice: { type: "string" },
          },
          required: ["name", "genre", "scoreTotal", "scoreComment"],
        },
      },
    },
    required: ["creators"],
  },
};

export async function POST(req: NextRequest) {
  const access = await resolveCreatorAccess();
  if (!access) {
    return NextResponse.json({ error: "この機能の利用権限がありません" }, { status: 403 });
  }

  const limited = checkRateLimit(access.email, "creator-leads/search", AI_RATE_LIMIT);
  if (limited) return limited;

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ error: "ANTHROPIC_API_KEY が設定されていません" }, { status: 500 });
  }

  let body: { genre?: string; area?: string; keywords?: string; count?: number };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "リクエストの形式が不正です" }, { status: 400 });
  }

  const genre = (body.genre ?? "").trim();
  const area = (body.area ?? "").trim();
  const keywords = (body.keywords ?? "").trim();
  const count = Math.min(20, Math.max(1, Math.round(body.count ?? 8)));
  // コスト上限: 件数に応じて Web検索回数を制限（1発掘あたり最大8検索）
  const maxUses = Math.min(8, Math.max(3, Math.ceil(count / 3)));

  const userMessage = `以下の条件でクリエイター加盟プランの候補クリエイターを${count}名、Web検索で発掘してスコアリングしてください。
【ジャンル】${genre || "指定なし（動画・広告系を優先）"}
【地域】${area || "全国"}
【キーワード/補足】${keywords || "なし"}

Vook・foriio・個人サイト・公開SNSなどを検索し、実在を確認した上で、URLと適合スコアを付けてください。最後に必ず output_creators ツールで結果を返してください。`;

  try {
    const client = new Anthropic({ apiKey });
    const response = await client.messages.create({
      model: "claude-sonnet-4-6",
      max_tokens: 8192,
      system: [{ type: "text", text: SYSTEM_PROMPT, cache_control: { type: "ephemeral" } }],
      messages: [{ role: "user", content: userMessage }],
      tools: [
        { type: "web_search_20250305", name: "web_search", max_uses: maxUses },
        OUTPUT_TOOL,
      ],
    });

    const toolBlock = response.content.find(
      (b): b is Anthropic.Messages.ToolUseBlock => b.type === "tool_use" && b.name === "output_creators",
    );
    if (!toolBlock) {
      return NextResponse.json({ error: "発掘結果のパースに失敗しました。条件を変えて再度お試しください。" }, { status: 502 });
    }

    const creators = (toolBlock.input as { creators?: unknown[] }).creators ?? [];
    return NextResponse.json({ creators });
  } catch (err) {
    console.error("Creator lead search error:", err);
    return NextResponse.json({ error: "クリエイター発掘中にエラーが発生しました" }, { status: 500 });
  }
}
