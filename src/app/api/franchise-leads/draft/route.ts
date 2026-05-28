import Anthropic from "@anthropic-ai/sdk";
import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { validateBody, franchiseLeadDraftSchema } from "@/lib/validations";
import { checkRateLimit, AI_RATE_LIMIT } from "@/lib/rate-limit";
import type { UserRole } from "@/types/roles";

export const runtime = "nodejs";
export const maxDuration = 60;

// 白川代表の標準署名（feedback-email-signature と一致させること）
const SIGNATURE = `━━━━━━━━━━━━━━━━━━━━━━━━━
Ad Arch株式会社
代表取締役/Producer
白川 裕喜 (Hiroki Shirakawa)
〒107-0062 東京都港区南青山2-15-5 FARO1F
HP: https://www.adarch.co.jp
━━━━━━━━━━━━━━━━━━━━━━━━━`;

// ----------------------------------------------------------------
// POST /api/franchise-leads/draft
// 加盟候補への初回コンタクトメール下書きをClaude AIで生成（ADMIN限定）
// 用語規制・価格非開示・媒体起点訴求をシステムプロンプトに焼き込む
// ----------------------------------------------------------------
export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const role = (session.user.role ?? "USER") as UserRole;
  if (role !== "ADMIN") {
    return NextResponse.json({ error: "管理者権限が必要です" }, { status: 403 });
  }

  const limited = checkRateLimit(session.user.email!, "franchise-leads/draft", AI_RATE_LIMIT);
  if (limited) return limited;

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ error: "ANTHROPIC_API_KEY が設定されていません" }, { status: 500 });
  }

  const parsed = await validateBody(req, franchiseLeadDraftSchema);
  if (!parsed.success) return parsed.response;
  const body = parsed.data;

  const SYSTEM_PROMPT = `あなたはAd Arch株式会社（代表: 白川裕喜）の代表本人として、独立した小規模事業者（1〜2人規模）に「Ad Archグループへの参画」を案内する初回コンタクトメールの下書きを作成します。

【狙い】
- 全国のパートナーと広告媒体（OOH・デジタルサイネージ・タクシー広告・シネアド・TVer等）を一緒に展開する仲間を増やすための、最初の一通。
- 売り込みではなく、相手の事業を一段広げる「ご提案・お声がけ」のトーン。

【絶対に守るルール】
1. 用語規制（厳守）: 「フランチャイズ」「FC」「加盟」「加盟金」「加盟店」「ロイヤリティ」という語は一切使わない。代わりに「グループ参画」「グループにご参画」「参画」「ご一緒に」「月額のグループ費用」等の表現を使う。
2. 価格非開示（厳守）: 参画費用・月額費用・金額の具体的な数字は一切書かない。費用や条件は「個別のご説明の場でお伝えします」に留める。
3. 訴求は媒体起点（厳守）: 「動画制作をしませんか」ではなく「広告媒体を一緒に展開しませんか／取り扱えるようになりませんか」を入口にする。映像制作はあくまで媒体に付随する強みとして軽く触れる程度。
4. 数値効果の断定禁止: 「売上○％UP」「集客○倍」等の数値予測は書かない。定性的表現（認知拡大・商圏拡大・案件の幅が広がる 等）に留める。
5. 「副業」という語は使わない。
6. 過度に大きく見せない・煽らない。誠実で落ち着いた丁寧語。
7. 形式: プレーンテキスト本文のみ（HTMLタグ・マークダウン記法は使わない）。署名はこちらで付与するので本文に署名・会社名フッターを書かない。
8. 長さ: 本文は12〜18行程度。冒頭は相手企業に触れた一文から入り、最後はオンラインの個別説明（OS体験会など）への軽いお誘いで締める。押しつけない退路のある一文にする。

【Ad Archグループ（背景として把握。本文に条件や金額は書かない）】
- OOH広告と映像制作を主力とする全国規模の広告会社グループ。各地に独立した事業者パートナーが参画。
- 参画すると、広告媒体の取扱い・グループ案件の相互紹介・経営支援ツール（OS）などが使えるようになる。

【出力】output_email ツールで subject と body を返す。`;

  const userMessage = `【お声がけ先】
- 事業者名: ${body.companyName}
- 所在地: ${body.address || "不明"}
- 業種/事業内容: ${body.businessType || "不明"}
- Webサイト: ${body.website || "なし"}
- 社内評価メモ: ${body.scoreComment || "なし"}

この事業者に向けた初回コンタクトメールの下書きを作成してください。相手の事業内容に具体的に触れ、媒体起点で、用語規制・価格非開示を厳守してください。`;

  const TOOLS = [{
    name: "output_email" as const,
    description: "初回コンタクトメールの下書きを出力する",
    input_schema: {
      type: "object" as const,
      properties: {
        subject: { type: "string", description: "メール件名（簡潔・煽らない）" },
        body: { type: "string", description: "メール本文（プレーンテキスト、署名なし）" },
      },
      required: ["subject", "body"],
    },
  }];

  try {
    const client = new Anthropic({ apiKey });
    const response = await client.messages.create({
      model: "claude-sonnet-4-6",
      max_tokens: 2048,
      system: [
        { type: "text", text: SYSTEM_PROMPT, cache_control: { type: "ephemeral" } },
      ],
      messages: [{ role: "user", content: userMessage }],
      tools: TOOLS,
      tool_choice: { type: "tool", name: "output_email" },
    });

    const toolBlock = response.content.find(
      (b): b is Anthropic.Messages.ToolUseBlock => b.type === "tool_use"
    );
    if (!toolBlock) {
      return NextResponse.json({ error: "AIレスポンスの取得に失敗しました" }, { status: 500 });
    }

    const out = toolBlock.input as { subject: string; body: string };
    const subject = out.subject.trim();
    const bodyWithSignature = `${out.body.trimEnd()}\n\n${SIGNATURE}`;

    // 下書きをリードに保存
    await db.franchiseLead.update({
      where: { id: body.id },
      data: {
        emailSubject: subject,
        emailBody: bodyWithSignature,
        emailDraftedAt: new Date(),
      },
    });

    return NextResponse.json({ subject, body: bodyWithSignature });
  } catch (err) {
    console.error("Franchise lead draft error:", err);
    return NextResponse.json({ error: "メール下書き生成中にエラーが発生しました" }, { status: 500 });
  }
}
