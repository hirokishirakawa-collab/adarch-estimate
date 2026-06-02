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

const SYSTEM_PROMPT = `あなたはAd Arch株式会社の営業文面アシスタントです。
TVer広告／映像制作の提案として、一般企業への「初回コンタクトメール」の下書きを作成してください。

【方針】
- 1社ごとにパーソナライズ。相手の事業内容に1文触れた上で、TVer広告/映像制作が役立つ切り口を提示。
- 価値訴求が主役。相手を過剰に褒めない（上から目線NG）。事実として触れる程度。
- 全国26拠点のネットワークで「最寄りの担当が直接訪問・サポート可能」である点を必ず一言入れる（東京一極の代理店との差別化）。
- 押し売りでなく、柔らかいCTA（「一度オンラインで15分ほどお話しできれば」程度）。
- 価格は本文に書かない（面談で）。誇大表現・絵文字・記号の乱用はしない。ビジネスメールとして自然に。
- 署名は入れない（送信者が自分の署名で送るため、本文は結びの挨拶までで終える）。
- 長すぎない（本文250〜400字程度）。

output_email ツールで subject と body を返してください。`;

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
  if (!session?.user?.email || role === "USER") {
    return NextResponse.json({ error: "この機能の利用権限がありません" }, { status: 403 });
  }

  const limited = checkRateLimit(session.user.email, "outreach/draft", AI_RATE_LIMIT);
  if (limited) return limited;

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return NextResponse.json({ error: "ANTHROPIC_API_KEY が設定されていません" }, { status: 500 });

  let body: { companyName?: string; contactName?: string; businessNote?: string; website?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "リクエストの形式が不正です" }, { status: 400 });
  }
  const companyName = (body.companyName ?? "").trim();
  if (!companyName) return NextResponse.json({ error: "会社名が必要です" }, { status: 400 });

  const userMessage = `以下の企業へのTVer広告/映像制作の初回コンタクトメール下書きを作成してください。
【会社名】${companyName}
【担当者】${body.contactName?.trim() || "（不明・部署宛 or ご担当者様）"}
【事業メモ】${body.businessNote?.trim() || "（情報なし。一般的な切り口で）"}
【Web】${body.website?.trim() || "なし"}`;

  try {
    const client = new Anthropic({ apiKey });
    const response = await client.messages.create({
      model: "claude-sonnet-4-6",
      max_tokens: 1500,
      system: [{ type: "text", text: SYSTEM_PROMPT, cache_control: { type: "ephemeral" } }],
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
