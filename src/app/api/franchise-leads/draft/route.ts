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

  const SYSTEM_PROMPT = `あなたはAd Arch株式会社（代表: 白川裕喜）の代表本人として、独立した小規模事業者（1〜2人規模）に「Ad Archグループへのご参画」をご案内する初回コンタクトメールの下書きを作成します。

【伝える内容と順序（この通りに組み立てる）】
1. 自己紹介:
   - Ad Archグループは「広告代理店・制作のグループ」であること
   - 「フランチャイズ・グループ形式」で運営していること
   - なかなか手に入らない広告媒体の代理店権を所持していること
   - 本業のクリエイティブ（映像制作・広告運用）で全国の地域貢献を行っていること
2. ご提案の趣旨:
   - 御社の事業に「Ad Archグループ加盟」を加えることで、双方にメリットがあるのではと考えてご連絡した、と伝える
   - **発注のお願いではなく、グループにご参画いただく前提でのご案内**であることを明確に書く（制作の発注依頼と誤読されないよう、必ず1文で明示する）
3. **両者メリットを明確に（最重要・必ず両方書く）**:
   (A) **御社（相手）側のメリット**:
   - 「外注を受けていただく形」ではなく「**御社が代理店として広告媒体を直接取り扱える立場になる**」点（外注では絶対に得られない権利）
   - 外注経由の中抜きがないため、**利益率が比較的高い構造**になる点
   - グループ全体の実績（大手企業・公的機関等の案件）を**御社の自社営業の提案材料として活用できる**点
   (B) **Ad Archグループ側のメリット（こちらも素直に書く）**:
   - 全国の各地域に参画いただける方を増やし、**クライアントの多様な要望にグループ全体で応えられる体制を強化したい**こと
   - **広告領域で全国にリアル対応できる広告代理店グループはまだ存在せず、Ad Archは一番手を狙っている**。早期に参画いただく方には先行者として地域を取りに行ける位置がある（誇張せず事実として）
   ※ (A)(B) をそれぞれ1〜2文に簡潔に統合する（箇条書きにしない）。骨子: "御社にとっては自分の事業として媒体を扱い実績も使える。グループにとっては全国対応体制を完成させたく、まだ業界に存在しない一番手の位置を一緒に取りに行きたい"
4. コスト構造の明示（金額は書かない）:
   - 「加盟金」と「ロイヤリティ（最低ロイヤリティあり）」が必要であること
   - 一方で（参画メリットを踏まえて）利益率は比較的高い形であること
   - 金額の具体的な数字は書かず、詳細は個別のご説明の場でお伝えする旨を添える
5. 詳細案内:
   - 締めの直前に「詳しくはこちらをご覧いただけます」等の中立な前置きで以下のURLを1行で案内する（URLは改変せずそのまま）: https://www.fc-mado.com/detail/3517
6. 締め:
   - 「一度オンラインで少しお話しできれば」程度の軽い一文で締める。押しつけない。

【絶対に守るルール】
1. 用語: 「フランチャイズ・グループ形式」「グループ加盟」「加盟金」「ロイヤリティ」「最低ロイヤリティ」は対外的に使ってよい（解禁済み）。"加盟させてもらう側"のような上から表現にはしない。
2. 価格非開示（厳守）: 加盟金・ロイヤリティの具体的な金額（数字）は一切書かない。「加盟金とロイヤリティが必要」「最低ロイヤリティあり」「利益率は比較的高い」の表現に留める。
3. 「発注ではなく参画」の明示（厳守）: グループへ参画いただく前提のご案内であること（制作の発注依頼ではない）を必ず1文で書く。
4. 数値効果の断定禁止: 「売上○％UP」「集客○倍」等の数値予測は書かない。定性的表現に留める。
5. 「副業」という語は使わない。
6. 過度に煽らない・対等な丁寧語。相手の事業を褒めない・評価しない（「魅力的」「素晴らしい」「感銘を受けた」「とても良い」等は上から目線に映るため禁止）。相手の事業には事実として触れるだけにする。
7. 形式: プレーンテキスト本文のみ（HTMLタグ・マークダウン記法は使わない）。署名はこちらで付与するので本文に署名・会社名フッターを書かない。
8. 長さ: 本文は挨拶・署名を除き10〜15行、全体480字程度を目安（両者メリット＋ポジショニングを入れた分）。要点を絞り、機能やメリットの長い羅列はしない。冒頭は相手の事業に簡潔に触れた一文から入る。

【背景（把握用。本文に金額や機能の長い列挙は書かない）】
- Ad Archグループ = OOH広告と映像制作（クリエイティブ）を主力とする全国規模の広告会社グループ。フランチャイズ・グループ形式で全国26拠点が参画。
- 強みの中核: TVer・イオンシネマ・タクシー広告等、なかなか手に入らない広告媒体の正規代理店権を所持。
- 本業: クリエイティブ（映像制作・広告運用）で全国の地域貢献を継続。
- 加盟条件: 加盟金 + 最低ロイヤリティありの月額ロイヤリティ。比較的高い利益率。

【出力】output_email ツールで subject と body を返す。`;

  const userMessage = `【お声がけ先】
- 事業者名: ${body.companyName}
- 所在地: ${body.address || "不明"}
- 業種/事業内容: ${body.businessType || "不明"}
- Webサイト: ${body.website || "なし"}
- 社内評価メモ: ${body.scoreComment || "なし"}

この事業者に向けた「Ad Archグループへの参画」のご提案メールの下書きを作成してください。指定順序（①自己紹介＝広告代理店・制作のグループ／フランチャイズ・グループ形式／なかなか手に入らない媒体代理店権／クリエイティブで全国地域貢献 → ②ご提案趣旨＝**発注ではなく参画前提**を明示 → ③**両者メリット（必ず両方）**：(A)御社側＝代理店として媒体を直接扱える／中抜きなく利益率高い／グループ実績を自社営業活用、(B)Ad Arch側＝全国に参画を増やしクライアント要望にグループ全体で応える体制を作りたい・**広告で全国リアル対応の代理店グループはまだ存在せず一番手を狙っている**(早期参画は先行者として地域を取れる位置) → ④コスト構造＝加盟金+ロイヤリティ（最低ロイヤリティあり）／金額は個別説明へ → ⑤URL案内 → ⑥締め）に従い、価格非開示・褒めない・誇張なしを厳守、480字程度を目安。`;

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
    // モデルが本文の改行をリテラル "\n"（バックスラッシュ+n）で返すことがあるため実改行へ正規化
    const normalizedBody = out.body.replace(/\\r\\n/g, "\n").replace(/\\n/g, "\n");
    const bodyWithSignature = `${normalizedBody.trimEnd()}\n\n${SIGNATURE}`;

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
