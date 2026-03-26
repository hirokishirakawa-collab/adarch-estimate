import Anthropic from "@anthropic-ai/sdk";
import { auth } from "@/lib/auth";
import { db as prisma } from "@/lib/db";
import { NextRequest } from "next/server";
import { checkRateLimit, AI_RATE_LIMIT } from "@/lib/rate-limit";

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.email)
    return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401 });

  const limited = checkRateLimit(session.user.email!, "studio/caption", AI_RATE_LIMIT);
  if (limited) return limited;

  const user = await prisma.user.findUnique({ where: { email: session.user.email } });
  if (!user || !user.branchId)
    return new Response(JSON.stringify({ error: "No branch" }), { status: 400 });

  const body = await req.json();
  const { studioClientId, postTheme, postFormat, additionalNotes } = body;

  let clientContext = "";
  if (studioClientId) {
    const client = await prisma.studioClient.findUnique({ where: { id: studioClientId } });
    if (client) {
      clientContext = `
## クライアント情報
- 店舗名: ${client.name}
- 業種: ${client.businessType}
- エリア: ${client.area}
- ターゲット: ${client.target}
- 強み: ${client.sellingPoints || "未設定"}`;
    }
  }

  const prompt = `あなたはInstagram運用のプロのコピーライターです。以下の投稿用キャプションを3案作成してください。
${clientContext}

## 投稿内容
- テーマ: ${postTheme}
- 投稿形式: ${postFormat || "リール"}
${additionalNotes ? `- 補足: ${additionalNotes}` : ""}

## 各案に含めてください
1. キャプション本文（改行・絵文字を効果的に使用。自然な日本語で）
2. CTA（行動喚起: 保存促進・フォロー促進・DM誘導・コメント促進など具体的に）
3. 想定効果（この書き方にした理由を1行で）

## ルール
- 1案あたり150-300文字程度
- 最初の1行で止まる人を引き込む「フック」を入れる
- 宣伝臭くない自然なトーン
- ハッシュタグは不要（アルゴリズム重要度低下のため）
- 3案はそれぞれトーンを変える（例: 親しみやすい / プロフェッショナル / ストーリー性）`;

  const stream = await anthropic.messages.stream({
    model: "claude-sonnet-4-20250514",
    max_tokens: 2000,
    messages: [{ role: "user", content: prompt }],
  });

  let fullText = "";
  const encoder = new TextEncoder();

  const readable = new ReadableStream({
    async start(controller) {
      for await (const event of stream) {
        if (event.type === "content_block_delta" && event.delta.type === "text_delta") {
          const chunk = event.delta.text;
          fullText += chunk;
          controller.enqueue(encoder.encode(`data: ${JSON.stringify({ text: chunk })}\n\n`));
        }
      }

      if (studioClientId && fullText.length > 0) {
        await prisma.production.create({
          data: {
            type: "CAPTION",
            title: `キャプション: ${postTheme}`,
            content: fullText,
            inputData: { postTheme, postFormat, additionalNotes },
            studioClientId,
            branchId: user.branchId!,
            createdById: user.id,
          },
        });
      }

      await prisma.auditLog.create({
        data: {
          action: "studio_caption_generated",
          email: user.email,
          name: user.name,
          entity: "production",
          detail: `キャプション生成: ${postTheme}`,
        },
      });

      controller.enqueue(encoder.encode(`data: ${JSON.stringify({ done: true })}\n\n`));
      controller.close();
    },
  });

  return new Response(readable, {
    headers: { "Content-Type": "text/event-stream", "Cache-Control": "no-cache", Connection: "keep-alive" },
  });
}
