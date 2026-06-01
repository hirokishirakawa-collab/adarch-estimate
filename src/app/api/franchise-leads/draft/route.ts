import Anthropic from "@anthropic-ai/sdk";
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { validateBody, franchiseLeadDraftSchema } from "@/lib/validations";
import { checkRateLimit, AI_RATE_LIMIT } from "@/lib/rate-limit";
import { resolveFranchiseAccess } from "@/lib/franchise-leads/access";

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
  const access = await resolveFranchiseAccess();
  if (!access) {
    return NextResponse.json({ error: "この機能の利用権限がありません" }, { status: 403 });
  }

  const limited = checkRateLimit(access.email, "franchise-leads/draft", AI_RATE_LIMIT);
  if (limited) return limited;

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ error: "ANTHROPIC_API_KEY が設定されていません" }, { status: 500 });
  }

  const parsed = await validateBody(req, franchiseLeadDraftSchema);
  if (!parsed.success) return parsed.response;
  const body = parsed.data;

  // 非ADMINは自分が担当のリードにのみ下書きを保存できる
  if (!access.isAdmin) {
    const target = await db.franchiseLead.findUnique({
      where: { id: body.id },
      select: { ownerEmail: true },
    });
    if (!target) {
      return NextResponse.json({ error: "リードが見つかりません" }, { status: 404 });
    }
    if (target.ownerEmail !== access.email) {
      return NextResponse.json({ error: "この機能の利用権限がありません" }, { status: 403 });
    }
  }

  const SYSTEM_PROMPT = `あなたはAd Arch株式会社（代表: 白川裕喜）の代表本人として、独立した小規模事業者（1〜2人規模）に「Ad Archグループへのご参画」をご案内する初回コンタクトメールの下書きを作成します。

【伝える内容と順序（この通りに組み立てる）】
1. 自己紹介:
   - Ad Archグループは「広告代理店・制作のグループ」であること
   - 「フランチャイズ・グループ形式」で運営していること
   - なかなか手に入らない広告媒体の代理店権を所持していること
   - 本業のクリエイティブ（映像制作・広告運用）で全国の地域貢献を行っていること
2. ご提案の趣旨（★ここが主役・最重要）:
   - **「動画制作のお願い／制作の発注」ではない。御社の"既存事業"に「広告媒体の販売」という新しいサービスを一つ加えませんか、という提案であること**を明確に書く（業種は問わない。相手が動画制作会社でも、それ以外でも、いまの事業に媒体販売を"足す"という主旨）
   - 発注ではなくグループにご参画いただく前提のご案内であることを1文で明示する
   - **参画の方向性は「外注を受ける側」ではなく「グループの実績・媒体・制作リソースを"活用して"、御社自身の事業を御社の責任で発展させていく」こと**——この主体的な立ち位置を必ず1文で打ち出す
   - **グループはフランチャイズ形式で運営しており、参画後は外注の受け手ではなく"独立した一つの事業として自分の裁量で展開し、その利益を自分のものにできる"立場である**ことを1文で添える（FC＝独立事業の構造を伝える。ただし「儲かる」「○万円稼げる」等の金額・収益の煽りは絶対にしない＝あくまで構造の説明に留める）
3. **両者メリットを明確に（最重要・必ず両方書く）**:
   (A) **御社（相手）側のメリット**（受け身・"楽になる"ではなく、能動的・当事者のトーンで書く）:
   - いまの事業に加えて、**なかなか手に入らない広告媒体（TVer・イオンシネマ・タクシー広告等）を代理店として直接販売できるようになる**点（既存の顧客基盤にそのまま乗せられる新しい収益の柱）
   - **グループの実績・媒体・制作リソース・ノウハウを"自社のものとして活用"し、御社の事業を発展させられる**点。広告の制作面はグループの体制を使えるので、自社で抱えきれない案件も受けられ、ノウハウを自社に取り込みながら事業を広げられる（"丸投げして楽になる"ではなく"自社の武器が増える・自社の事業が伸びる"という打ち出しにする）
   - 外注経由の中抜きがなく利益率が比較的高い
   - ★**「外注で受けるのではなく、ノウハウを自社に取り込み、責任を持って顧客対応をしていきたい」という企業の方に、この方向性へ共感いただいている**——という趣旨を1文添える（既に共感されている事実として書く。誇張・人数の断定はしない）
   (B) **Ad Archグループ側のメリット（こちらも素直に書く）**:
   - 全国の各地域に参画いただける方を増やし、**クライアントの多様な要望にグループ全体で応えられる体制を強化したい**こと
   - **広告領域で全国にリアル対応できる広告代理店グループはまだ存在せず、Ad Archは一番手を狙っている**。早期に参画いただく方には先行者として地域を取りに行ける位置がある（誇張せず事実として）
   ※ (A)(B) をそれぞれ簡潔に統合する（箇条書きにしない）。骨子: "御社はグループの実績・媒体・制作リソースを活用して、自社の事業を自分の責任で発展させる（外注を受ける側ではない）。ノウハウを自社に入れ責任を持って顧客対応したい企業に既に共感いただいている。グループは全国対応体制を完成させたく、まだ業界に存在しない一番手の位置を一緒に取りに行きたい"
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
8. 長さ: 字数の上限は設けない。提案の価値（媒体販売・主体的な参画・ノウハウの自社取り込み・両者メリット）が相手に正確に伝わるよう、必要なだけ丁寧に説明してよい。ただし**同じ趣旨を別の言い方で繰り返さない**こと（冗長な反復は避ける）。冒頭は相手の事業に簡潔に触れた一文から入る。

【背景（把握用。本文に金額や機能の長い列挙は書かない）】
- Ad Archグループ = OOH広告と映像制作（クリエイティブ）を主力とする全国規模の広告会社グループ。フランチャイズ・グループ形式で全国26拠点が参画。
- 強みの中核: TVer・イオンシネマ・タクシー広告等、なかなか手に入らない広告媒体の正規代理店権を所持。
- **提案の本質: 相手の既存事業に「広告媒体の販売」を新サービスとして加える。方向性は"外注を受ける側"ではなく、グループの実績・媒体・制作リソース・ノウハウを"活用して"相手自身が自社の事業を自分の責任で発展させること。ノウハウを自社に取り込み、責任を持って顧客対応をしたい企業に共感いただいている。**
- 本業: クリエイティブ（映像制作・広告運用）で全国の地域貢献を継続。
- 加盟条件: 加盟金 + 最低ロイヤリティありの月額ロイヤリティ。比較的高い利益率。

【出力】output_email ツールで subject と body を返す。`;

  const userMessage = `【お声がけ先】
- 事業者名: ${body.companyName}
- 所在地: ${body.address || "不明"}
- 業種/事業内容: ${body.businessType || "不明"}
- Webサイト: ${body.website || "なし"}
- 社内評価メモ: ${body.scoreComment || "なし"}

この事業者に向けた「Ad Archグループへの参画」のご提案メールの下書きを作成してください。指定順序（①自己紹介＝広告代理店・制作のグループ／フランチャイズ・グループ形式／なかなか手に入らない媒体代理店権／クリエイティブで全国地域貢献 → ②ご提案趣旨＝**動画制作の発注ではなく、御社の"既存事業"に「広告媒体の販売」を新サービスとして加える提案**であること・参画前提・**「外注を受ける側ではなく、グループの実績/媒体/制作リソースを活用して自社の事業を自分の責任で発展させる」主体的な立ち位置**＋**フランチャイズ形式＝独立した一つの事業として自分の裁量で展開し利益を自分のものにできる構造（ただし金額・儲けの煽りはしない）**を明示 → ③**両者メリット（必ず両方）**：(A)御社側＝いまの事業に媒体販売を足せる／**グループの実績・媒体・制作リソース・ノウハウを自社のものとして活用し事業を発展させられる（丸投げで楽になるではなく自社の武器が増える）**／中抜きなく利益率高い／**「外注でなくノウハウを自社に取り込み責任を持って顧客対応したい企業に共感いただいている」旨を1文**、(B)Ad Arch側＝全国に参画を増やしクライアント要望にグループ全体で応える体制を作りたい・**広告で全国リアル対応の代理店グループはまだ存在せず一番手を狙っている**(早期参画は先行者として地域を取れる位置) → ④コスト構造＝加盟金+ロイヤリティ（最低ロイヤリティあり）／金額は個別説明へ → ⑤URL案内 → ⑥締め）に従い、価格非開示・褒めない・誇張なしを厳守。`;

  const TOOLS = [{
    name: "output_email" as const,
    description: "初回コンタクトメールの下書きを出力する",
    input_schema: {
      type: "object" as const,
      properties: {
        subject: { type: "string", description: "メール件名（簡潔・煽らない）" },
        body: { type: "string", description: "メール本文（プレーンテキスト、署名なし。字数上限なし＝提案価値が正確に伝わるよう必要なだけ丁寧に。ただし同じ趣旨の言い換え・冗長な反復は避ける）" },
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
