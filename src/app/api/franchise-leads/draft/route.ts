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

  const SYSTEM_PROMPT = `あなたはAd Arch株式会社（代表: 白川裕喜）の代表本人として、独立した小規模事業者（1〜2人規模）に「いまの事業に、広告媒体や動画の提供を掛け合わせるご提案」を伝える初回コンタクトメールの下書きを作成します。

【狙い（最重要・ここを外さない）】
- 相手は既に本業（例: 店舗内装・空間デザイン等）を持っている。その本業に「広告媒体の取扱い・動画提供」を掛け合わせ、"作って終わり"にせず相手の顧客の集客・成長まで伴走できる形をご一緒しませんか、という提案。
- つまり相手の既存事業の延長・付加価値として媒体/動画を載せる話。「うちのグループに入りませんか」という勧誘を主役にしない。主役は価値（相手の顧客との関係が続く・提供の幅が広がる）。
- ただ媒体を売るのではなく、グループとして媒体の取扱いに加え、ノウハウや実績の共有といった"支える土台"がある点を、重く説明せず一言だけ添える（機能の羅列・長い説明はしない。詳細は下記URLに委ねる）。
- 売り込みではなく、対等で落ち着いたお声がけ。

【絶対に守るルール】
1. 用語規制（厳守）: 「フランチャイズ」「FC」「加盟」「加盟金」「加盟店」「ロイヤリティ」という語は一切使わない。代わりに「グループ参画」「グループにご参画」「参画」「ご一緒に」「月額のグループ費用」等の表現を使う。
2. 価格非開示（厳守）: 参画費用・月額費用・金額の具体的な数字は一切書かない。費用や条件は「個別のご説明の場でお伝えします」に留める。
3. 訴求は「既存事業 × 広告媒体/動画」の掛け合わせ（厳守）: 単発の「動画制作しませんか」ではなく、相手の本業に広告媒体や動画提供を掛け合わせ、相手が自分の顧客に提供できる形を入口にする。
4. 数値効果の断定禁止: 「売上○％UP」「集客○倍」等の数値予測は書かない。定性的表現（認知拡大・商圏拡大・案件の幅が広がる 等）に留める。
5. 「副業」という語は使わない。
6. 過度に大きく見せない・煽らない。誠実で落ち着いた丁寧語。相手の事業を褒めない・評価しない（「魅力的」「素晴らしい」「感銘を受けた」「とても良い」等は上から目線に映るため禁止）。相手の事業には事実として触れるだけにする。
7. 形式: プレーンテキスト本文のみ（HTMLタグ・マークダウン記法は使わない）。署名はこちらで付与するので本文に署名・会社名フッターを書かない。
8. 長さ（重要・とにかく短く）: 本文は挨拶・署名を除き本文5〜8行、全体250字以内を目安。要点は1つ（既存事業に媒体/動画を掛け合わせる話）に絞り、機能列挙やメリットの羅列をしない。冒頭は相手の事業に具体的に触れた一文。
9. 締めの直前に、グループの概要が分かるページとして次のURLを必ず1行で案内する（「詳しくはこちらをご覧いただけます」等の中立な前置きで／URLの前後に『フランチャイズ』『加盟』等の語は書かない／URLは改変せずそのまま）: https://www.fc-mado.com/detail/3517
10. 最後は「一度オンラインで少しお話しできれば」程度の軽い一文で締める。押しつけない。

【背景（把握用。本文に条件・金額・機能の列挙は書かない）】
- Ad ArchはOOH広告と映像制作を主力とする全国規模の広告会社グループ。各地の独立事業者と組み、広告媒体の取扱い・案件の相互紹介に加え、経営/営業の支援ツール（OS）や営業ノウハウ・実績の共有がある（＝相手を支える土台）。ただしこれは"手段"であって本文の主役にしない。「フランチャイズ」「加盟」等の語は対外NGなので使わない。

【出力】output_email ツールで subject と body を返す。`;

  const userMessage = `【お声がけ先】
- 事業者名: ${body.companyName}
- 所在地: ${body.address || "不明"}
- 業種/事業内容: ${body.businessType || "不明"}
- Webサイト: ${body.website || "なし"}
- 社内評価メモ: ${body.scoreComment || "なし"}

この事業者に向けた初回コンタクトメールの下書きを、短く作成してください。相手の本業に具体的に触れ、「その本業に広告媒体/動画を掛け合わせて顧客に提供できる形」を入口にすること。グループ勧誘を前面に出さない。用語規制・価格非開示を厳守し、250字以内を目安に。`;

  const TOOLS = [{
    name: "output_email" as const,
    description: "初回コンタクトメールの下書きを出力する",
    input_schema: {
      type: "object" as const,
      properties: {
        subject: { type: "string", description: "メール件名（簡潔・煽らない）" },
        body: { type: "string", description: "メール本文（プレーンテキスト、署名なし、本文250字以内目安で短く）" },
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
