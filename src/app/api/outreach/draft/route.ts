import Anthropic from "@anthropic-ai/sdk";
import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { checkRateLimit, AI_RATE_LIMIT } from "@/lib/rate-limit";
import type { UserRole } from "@/types/roles";

export const runtime = "nodejs";

// ----------------------------------------------------------------
// POST /api/outreach/draft
// TVer広告/映像制作・一般企業向けの初回コンタクト下書きをAIで生成
// （送信はしない。人がGmailで確認して送る前提）
// ----------------------------------------------------------------

/// 訴求の方向性。画面のセレクトと1対1で対応させる。
const DIRECTIONS = {
  AD_MEDIA: {
    label: "TVer・広告媒体のご提案",
    brief:
      "TVer（民放公式テレビ配信サービス）をはじめとする広告媒体の出稿提案。テレビCMより小さい予算で始められ、地域・年齢などを絞って配信できる点が軸。",
  },
  VIDEO_PRODUCTION: {
    label: "動画・映像制作のご提案",
    brief:
      "会社紹介・商品紹介・採用・店舗紹介などの映像制作提案。企画から撮影・編集まで一貫して対応できる点が軸。",
  },
  SNS_MANAGEMENT: {
    label: "SNS運用のご提案",
    brief:
      "Instagram・TikTok・YouTube等の運用代行と、そこに載せる縦型動画の制作提案。継続的な発信の体制づくりが軸。",
  },
  AD_AND_VIDEO: {
    label: "広告媒体＋動画制作（両方）",
    brief:
      "広告媒体の出稿と、そこに流す映像の制作をまとめて引き受けられる点が軸。媒体だけ・制作だけの会社との違いを出す。",
  },
  FIRST_MEETING: {
    label: "まずは情報交換・ご挨拶",
    brief:
      "具体的な商材を押さずに、地域の企業として一度話す機会をもらうことが目的。売り込み色を最も薄くする。",
  },
} as const;

type DirectionKey = keyof typeof DIRECTIONS;

function buildSystemPrompt(direction: DirectionKey): string {
  const d = DIRECTIONS[direction];
  return `あなたはAd Arch株式会社の営業文面アシスタントです。
一般企業への「初回コンタクトメール」の下書きを作成してください。

【今回の提案の方向性】${d.label}
${d.brief}
この方向性から外れた商材の話は入れないでください。

【方針】
- 1社ごとにパーソナライズ。相手の事業内容に1文触れた上で、上記の方向性が役立つ切り口を提示。
- 価値訴求が主役。相手を過剰に褒めない（上から目線NG）。事実として触れる程度。
- 全国に拠点があり「最寄りの担当が直接訪問・サポートできる」点を必ず一言入れる（東京一極の代理店との差別化）。
  ただし拠点数・社数などの具体的な数字は書かない。
- 押し売りでなく、柔らかい結び（「一度オンラインでお話しさせていただけますと幸いです」程度）。
- **所要時間を書かない。**「15分ほど」「30分程度」のような分数は入れない。
  相手の時間を先に区切る書き方は、送り手の都合を押し付けている印象になる。
- 日程の候補も書かない（送る人が自分の空き状況を見て後から書き足す）。
- 価格は本文に書かない（面談で）。誇大表現・絵文字・記号の乱用はしない。ビジネスメールとして自然に。
- 署名は入れない（送信者が自分の署名で送るため、本文は結びの挨拶までで終える）。
- 長すぎない（本文250〜400字程度）。

output_email ツールで subject と body を返してください。`;
}

const OUTPUT_TOOL: Anthropic.Messages.Tool = {
  name: "output_email",
  description: "メール下書きを出力する",
  input_schema: {
    type: "object",
    properties: {
      subject: { type: "string", description: "件名" },
      body: { type: "string", description: "本文（署名なし）" },
    },
    required: ["subject", "body"],
  },
};

export async function POST(req: NextRequest) {
  const session = await auth();
  const role = (session?.user?.role ?? "USER") as UserRole;
  // 加盟している段階で使える（アウトリーチ画面と同じ範囲）
  if (!session?.user?.email || (role !== "ADMIN" && role !== "MANAGER")) {
    return NextResponse.json({ error: "この機能の利用権限がありません" }, { status: 403 });
  }

  const limited = checkRateLimit(session.user.email, "outreach/draft", AI_RATE_LIMIT);
  if (limited) return limited;

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return NextResponse.json({ error: "ANTHROPIC_API_KEY が設定されていません" }, { status: 500 });

  let body: {
    companyName?: string; contactName?: string; businessNote?: string;
    website?: string; direction?: string;
  };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "リクエストの形式が不正です" }, { status: 400 });
  }
  const companyName = (body.companyName ?? "").trim();
  if (!companyName) return NextResponse.json({ error: "会社名が必要です" }, { status: 400 });

  const direction = (body.direction ?? "AD_MEDIA") as DirectionKey;
  if (!(direction in DIRECTIONS)) {
    return NextResponse.json({ error: "訴求の方向性が不正です" }, { status: 400 });
  }

  const userMessage = `以下の企業への初回コンタクトメール下書きを作成してください。
【会社名】${companyName}
【担当者】${body.contactName?.trim() || "（不明・部署宛 or ご担当者様）"}
【事業メモ】${body.businessNote?.trim() || "（情報なし。一般的な切り口で）"}
【Web】${body.website?.trim() || "なし"}`;

  try {
    const client = new Anthropic({ apiKey });
    const response = await client.messages.create({
      model: "claude-sonnet-5",
      thinking: { type: "disabled" },
      max_tokens: 1500,
      system: [{ type: "text", text: buildSystemPrompt(direction), cache_control: { type: "ephemeral" } }],
      messages: [{ role: "user", content: userMessage }],
      tools: [OUTPUT_TOOL],
      tool_choice: { type: "tool", name: "output_email" },
    });
    const toolBlock = response.content.find(
      (b): b is Anthropic.Messages.ToolUseBlock => b.type === "tool_use" && b.name === "output_email",
    );
    if (!toolBlock) return NextResponse.json({ error: "下書き生成に失敗しました" }, { status: 502 });
    const out = toolBlock.input as { subject?: string; body?: string };
    return NextResponse.json({ subject: out.subject ?? "", body: out.body ?? "" });
  } catch (err) {
    console.error("Outreach draft error:", err);
    return NextResponse.json({ error: "下書き生成中にエラーが発生しました" }, { status: 500 });
  }
}
