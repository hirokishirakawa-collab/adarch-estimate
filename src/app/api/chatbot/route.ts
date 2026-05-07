import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import Anthropic from "@anthropic-ai/sdk";
import { checkRateLimit, AI_RATE_LIMIT } from "@/lib/rate-limit";
import { searchWikiArticles, formatArticlesForPrompt } from "@/lib/wiki-search";
import {
  detectQueryIntent,
  searchInternalKnowledge,
  formatInternalSourcesForPrompt,
} from "@/lib/internal-knowledge-search";

export const runtime = "nodejs";

const BASE_SYSTEM_PROMPT = `あなたは「Ad-Arch Group OS」のヘルプ＆ナレッジアシスタント「アーチくん」です。
ユーザーの質問に対して、常に役立つ回答を返すことを最優先します。

## システム概要
Ad-Arch Group OS は広告映像制作グループ「アドアーチ」の業務統合システムです。
グループには26社の加盟パートナーがおり、全国で広告・映像制作事業を展開しています。

## 回答の基本姿勢（最重要）

**「未登録です」「登録されていません」と答えることを避けてください。** 以下の順序で必ず何らかの価値ある回答を返します。

1. **完全一致する情報がある場合**: その情報を根拠として引用しつつ、具体的に回答する
2. **部分的に関連する情報がある場合**: 類推・関連付けをして回答する
   - 例: 「小売業の事例」しかなくても、類似業種（物販・飲食）のアプローチから応用可能な示唆を引き出す
   - 例: Deal情報から「この業種の商談は〇件受注」のような傾向を読み取る
3. **社内情報が薄い場合**: 一般的な広告営業・映像制作のベストプラクティスを提示し、末尾に「社内で〇〇の事例が増えるとより具体的にお答えできます」と補足する
4. **使い方系はWiki記事があれば**それを参照、なければ「関連する機能名」を推測して案内する

## 回答のルール

- 提供された社内データは **可能な限り引用・活用** する（件数が少なくても）
- 「グループで〇件受注している業種です」「類似アプローチが〇件あります」など、**データ件数にも触れて実感を持たせる**
- 投稿者名・業種・エリア・金額など、**具体的なメタ情報を添えて具体性を出す**
- 箇条書き・番号リストを積極的に使い、読みやすく
- 回答は3〜10文程度、日本語、フレンドリーだが丁寧なトーン
- ユーザーが今いるページ（currentPage）がある場合、そのページ文脈に沿って回答
- 回答末尾には関連するOS機能・Wiki記事・投稿先へのリンクを1つ以上含める
  - 例: \`[アプローチ事例集](/dashboard/sales-approaches)\`
  - 例: \`[Wiki: 〇〇の使い方](/dashboard/wiki?q=〇〇)\`

## データが薄いときのフォールバック

社内ナレッジが2件以下の時は、必ず以下を添える:
「現在この領域のグループ事例は少ないため、一般的な知見と合わせてお答えします。実践された方は [アプローチ事例集](/dashboard/sales-approaches/new) への投稿をお願いします」

**要するに: 役に立つ回答を常に返す。ただし、社内データとそれ以外を明確に区別して伝える。**

## ツール活用
データベースを検索するツールが利用可能です。ユーザーが具体的な商談・顧客・実績について質問した場合は、ツールを使って実データを取得してから回答してください。
ツールで取得したデータは件数や具体名を引用して回答に含めてください。`;

// ----------------------------------------------------------------
// Tool Use: アーチくんが OS データベースを検索できるツール定義
// ----------------------------------------------------------------
const CHATBOT_TOOLS: Anthropic.Messages.Tool[] = [
  {
    name: "search_deals",
    description: "商談を検索する。顧客名・タイトル・ステータスで絞り込み可能。",
    input_schema: {
      type: "object" as const,
      properties: {
        query: { type: "string", description: "顧客名やタイトルのキーワード" },
        status: { type: "string", description: "ステータス: PROSPECTING, PROPOSAL, NEGOTIATION, WON, LOST" },
      },
    },
  },
  {
    name: "search_customers",
    description: "顧客（取引先）を名前で検索する。",
    input_schema: {
      type: "object" as const,
      properties: {
        query: { type: "string", description: "顧客名のキーワード" },
      },
      required: ["query"],
    },
  },
  {
    name: "get_my_stats",
    description: "自分（またはログインユーザー）の商談件数・売上サマリーを取得する。",
    input_schema: {
      type: "object" as const,
      properties: {},
    },
  },
  {
    name: "check_report_status",
    description: "月次報告（売上報告）の提出状況を確認する。管理者のみ全拠点の提出状況を取得可能。",
    input_schema: {
      type: "object" as const,
      properties: {
        month: { type: "string", description: "対象月 YYYY-MM（省略時は今月）" },
      },
    },
  },
];

// ----------------------------------------------------------------
// ツール実行関数
// ----------------------------------------------------------------
async function executeTool(
  name: string,
  input: Record<string, unknown>,
  user: { id: string; branchId: string | null; role: string },
): Promise<unknown> {
  const isAdmin = user.role === "ADMIN";
  const branchFilter = isAdmin ? {} : user.branchId ? { branchId: user.branchId } : {};

  switch (name) {
    case "search_deals": {
      const where: Record<string, unknown> = { ...branchFilter };
      if (input.query) {
        where.OR = [
          { title: { contains: input.query as string, mode: "insensitive" } },
          { customer: { name: { contains: input.query as string, mode: "insensitive" } } },
        ];
      }
      if (input.status) where.status = input.status;

      const deals = await db.deal.findMany({
        where,
        include: { customer: { select: { name: true } }, assignedTo: { select: { name: true } } },
        orderBy: { updatedAt: "desc" },
        take: 10,
      });

      return deals.map((d) => ({
        title: d.title,
        customer: d.customer.name,
        assignedTo: d.assignedTo?.name || "未割当",
        amount: d.amount ? `¥${Number(d.amount).toLocaleString()}` : "未設定",
        status: d.status,
        probability: d.probability ? `${d.probability}%` : null,
        expectedClose: d.expectedCloseDate?.toISOString().split("T")[0],
        updated: d.updatedAt.toISOString().split("T")[0],
      }));
    }

    case "search_customers": {
      const customers = await db.customer.findMany({
        where: {
          ...branchFilter,
          name: { contains: input.query as string, mode: "insensitive" },
        },
        select: {
          name: true,
          industry: true,
          status: true,
          contactName: true,
          phone: true,
          prefecture: true,
          _count: { select: { deals: true } },
        },
        orderBy: { updatedAt: "desc" },
        take: 10,
      });

      return customers.map((c) => ({
        name: c.name,
        industry: c.industry || "未設定",
        status: c.status,
        contactName: c.contactName,
        phone: c.phone,
        prefecture: c.prefecture,
        dealCount: c._count.deals,
      }));
    }

    case "get_my_stats": {
      const [dealCounts, thisMonthRevenue] = await Promise.all([
        db.deal.groupBy({
          by: ["status"],
          where: branchFilter,
          _count: true,
        }),
        db.revenueReport.aggregate({
          where: {
            ...branchFilter,
            targetMonth: {
              gte: new Date(new Date().getFullYear(), new Date().getMonth(), 1),
            },
          },
          _sum: { amount: true },
          _count: true,
        }),
      ]);

      return {
        deals: dealCounts.map((d) => ({ status: d.status, count: d._count })),
        thisMonth: {
          revenue: thisMonthRevenue._sum.amount
            ? `¥${Number(thisMonthRevenue._sum.amount).toLocaleString()}`
            : "¥0",
          reportCount: thisMonthRevenue._count,
        },
      };
    }

    case "check_report_status": {
      if (!isAdmin) return { error: "この機能は管理者のみ利用可能です" };

      const now = new Date();
      const monthStr =
        (input.month as string) ||
        `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
      const [y, m] = monthStr.split("-").map(Number);
      const targetMonth = new Date(y, m - 1, 1);

      const [reports, branches] = await Promise.all([
        db.revenueReport.findMany({
          where: { targetMonth },
          include: {
            branch: { select: { name: true } },
            createdBy: { select: { name: true } },
          },
        }),
        db.branch.findMany({
          where: { isActive: true },
          select: { id: true, name: true },
        }),
      ]);

      const submittedIds = new Set(reports.map((r) => r.branchId));
      return {
        month: monthStr,
        submitted: reports.map((r) => ({
          branch: r.branch.name,
          by: r.createdBy.name,
          amount: `¥${Number(r.amount).toLocaleString()}`,
        })),
        missing: branches.filter((b) => !submittedIds.has(b.id)).map((b) => b.name),
      };
    }

    default:
      return { error: `不明なツール: ${name}` };
  }
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.email) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const rateLimited = checkRateLimit(session.user.email, "chatbot", AI_RATE_LIMIT);
  if (rateLimited) return rateLimited;

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ error: "API key not configured" }, { status: 500 });
  }

  const { message, conversationId, currentPage, pageLabel } = await req.json();
  if (!message || typeof message !== "string" || message.trim().length === 0) {
    return NextResponse.json({ error: "Message is required" }, { status: 400 });
  }

  // ユーザーを取得
  const user = await db.user.findUnique({ where: { email: session.user.email } });
  if (!user) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

  // 会話を取得 or 作成
  let conversation;
  if (conversationId) {
    conversation = await db.chatbotConversation.findFirst({
      where: { id: conversationId, userId: user.id },
      include: { messages: { orderBy: { createdAt: "asc" }, take: 20 } },
    });
  }

  if (!conversation) {
    conversation = await db.chatbotConversation.create({
      data: { userId: user.id },
      include: { messages: { orderBy: { createdAt: "asc" } } },
    });
  }

  // ユーザーメッセージを保存
  await db.chatbotMessage.create({
    data: {
      conversationId: conversation.id,
      role: "user",
      content: message.trim(),
    },
  });

  // --- 質問タイプ判定 → 検索先を切り替え ---
  const intent = detectQueryIntent(message.trim());
  const searchQuery = [message.trim(), pageLabel || ""].filter(Boolean).join(" ");

  // Wikiと社内ナレッジを常に両方検索（営業系・事例系のときは社内ナレッジを優先）
  const wikiLimit = intent === "howto" ? 5 : 3;
  const internalLimit = intent === "howto" ? 4 : 10;

  const [wikiArticles, internalSources] = await Promise.all([
    searchWikiArticles(searchQuery, wikiLimit),
    searchInternalKnowledge(message.trim(), internalLimit),
  ]);

  const wikiContext = formatArticlesForPrompt(wikiArticles);
  const internalContext = formatInternalSourcesForPrompt(internalSources);

  // 動的コンテキストを構築（BASE_SYSTEM_PROMPTはキャッシュ対象として分離）
  let dynamicContext = `\n\n---\n\n# 検出された質問タイプ: ${intent}\n# 見つかった社内データ件数: ${internalSources.length}件\n# 見つかったWiki記事: ${wikiArticles.length}件`;

  if (wikiContext) {
    dynamicContext += `\n\n---\n\n# 関連Wiki記事\n\n${wikiContext}`;
  }

  if (internalContext) {
    dynamicContext += `\n\n---\n\n# 社内ナレッジ（グループ内の実例データ）\n\n**これらを根拠として引用・類推し、具体的なアドバイスを返してください。件数が少なくても必ず活用してください。**\n\n${internalContext}`;
  }

  if (!wikiContext && !internalContext) {
    dynamicContext += `\n\n---\n\n# 情報源\n\n関連する社内データは今回見つかりませんでした。一般的な広告営業・映像制作のベストプラクティスで回答してください。末尾に「社内で〇〇の事例が増えるとより具体的にお答えできます」と添えてください。`;
  }

  if (currentPage && pageLabel) {
    dynamicContext += `\n\n---\n\n## 現在のコンテキスト
- ユーザーが今見ているページ: ${pageLabel}（${currentPage}）
- ユーザーのロール: ${user.role}
- ユーザー名: ${user.name || "不明"}
このページに関連する質問には、より具体的なガイドを提供してください。`;
  }

  // 過去メッセージを Anthropic 形式に変換
  const history = (conversation.messages ?? []).map((m: { role: string; content: string }) => ({
    role: m.role as "user" | "assistant",
    content: m.content,
  }));
  history.push({ role: "user", content: message.trim() });

  // Claude API 呼び出し（ストリーミング + Tool Use + プロンプトキャッシュ）
  const client = new Anthropic({ apiKey });
  const systemPrompt = [
    { type: "text" as const, text: BASE_SYSTEM_PROMPT, cache_control: { type: "ephemeral" as const } },
    { type: "text" as const, text: dynamicContext },
  ];

  const encoder = new TextEncoder();
  let fullText = "";
  const metadata = {
    conversationId: conversation.id,
    intent,
    sources: {
      wiki: wikiArticles.map((a) => ({ id: a.id, title: a.title })),
      internal: internalSources.map((s) => ({ type: s.type, title: s.title })),
    },
  };

  const readable = new ReadableStream({
    async start(controller) {
      controller.enqueue(encoder.encode(`data: ${JSON.stringify(metadata)}\n\n`));

      let currentMessages: Anthropic.Messages.MessageParam[] = [...history];
      let iterations = 0;

      while (iterations < 3) {
        const stream = client.messages.stream({
          model: "claude-sonnet-4-6",
          max_tokens: 1024,
          system: systemPrompt,
          messages: currentMessages,
          tools: CHATBOT_TOOLS,
        });

        for await (const event of stream) {
          if (
            event.type === "content_block_delta" &&
            event.delta.type === "text_delta"
          ) {
            fullText += event.delta.text;
            controller.enqueue(encoder.encode(`data: ${JSON.stringify({ text: event.delta.text })}\n\n`));
          }
        }

        const finalMessage = await stream.finalMessage();
        if (finalMessage.stop_reason !== "tool_use") break;

        // ツール実行
        const toolBlocks = finalMessage.content.filter(
          (b): b is Anthropic.Messages.ToolUseBlock => b.type === "tool_use",
        );

        const toolResults: Anthropic.Messages.ToolResultBlockParam[] = await Promise.all(
          toolBlocks.map(async (block) => ({
            type: "tool_result" as const,
            tool_use_id: block.id,
            content: JSON.stringify(
              await executeTool(
                block.name,
                block.input as Record<string, unknown>,
                { id: user.id, branchId: user.branchId, role: user.role },
              ),
            ),
          })),
        );

        currentMessages = [
          ...currentMessages,
          { role: "assistant" as const, content: finalMessage.content },
          { role: "user" as const, content: toolResults },
        ];

        iterations++;
      }

      await db.chatbotMessage.create({
        data: {
          conversationId: conversation.id,
          role: "assistant",
          content: fullText,
        },
      });

      controller.enqueue(encoder.encode(`data: ${JSON.stringify({ done: true })}\n\n`));
      controller.close();
    },
  });

  return new Response(readable, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    },
  });
}
