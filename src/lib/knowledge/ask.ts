// ==============================================================
// 資料ライブラリ — 質問に出典つきで答える（NotebookLM相当）
//   1) 質問語で資料を選ぶ（キーワード採点。指定があればその資料）
//   2) 選んだ資料の全文を document ブロック（citations 有効）で渡す
//   3) 回答の text ブロックに付く citation を [n] に変換し、資料名・ページを添えて返す
//   出どころの決まり（自社=そのまま／他社=価格は卸値・実績は他社分）は system で徹底する
// ==============================================================

import Anthropic from "@anthropic-ai/sdk";
import { db } from "@/lib/db";
import type { KnowledgeOrigin } from "@/generated/prisma/client";
import { KNOWLEDGE_USE_RULES, ORIGIN_SHORT } from "./rules";
import { searchKnowledge, knowledgeWhere } from "./search";

export interface AskCitation {
  n: number;
  sourceId: string;
  title: string;
  origin: KnowledgeOrigin;
  page: number | null;
  citedText: string;
}

export interface AskResult {
  answer: string;
  citations: AskCitation[];
  sources: { id: string; title: string; origin: KnowledgeOrigin; publisher: string | null; truncated: boolean }[];
  usedModel: string;
}

const TOTAL_CHAR_BUDGET = 160_000; // 1回の質問で渡す全文の上限（費用の蓋）
const MIN_PER_DOC = 20_000;

const SYSTEM = `あなたは広告代理店グループ「アドアーチ」の資料ライブラリ（OSの頭脳）の司書です。
渡された資料だけを根拠に、加盟代表（みんな社長）の質問に日本語で答えます。

${KNOWLEDGE_USE_RULES}

## 答え方
- 先に結論。次に根拠。箇条書きは使ってよいが、1項目は2文以内
- 資料に書いてあることは必ず引用（citation）を付ける。資料に無いことは「資料には記載がありません」と言い、推測で補わない
- 他社・媒体の資料の価格を引くときは「卸値」と書き、末尾に「販売価格はOSの正本（TVerシミュレーター／パッケージ台帳）で確認」を1行添える
- 他社・媒体の実績を引くときは発行元名を添え、「◯◯の資料に記載の実績」と書く
- 最後に「そのまま使える点」と「参考にとどめる点」を1〜3行ずつ分けて書く
- 見出し（#）は使わない。全体で長くても600字程度`;

function pageOf(content: string, charIndex: number): number | null {
  // 「## p.N」の印から、その位置のページを求める
  const head = content.slice(0, Math.max(0, charIndex));
  const m = head.match(/## p\.(\d+)/g);
  if (!m || m.length === 0) return null;
  const last = m[m.length - 1].match(/(\d+)/);
  return last ? Number(last[1]) : null;
}

export async function askKnowledge(input: {
  question: string;
  isAdmin: boolean;
  sourceIds?: string[];
  origin?: KnowledgeOrigin;
}): Promise<AskResult> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) throw new Error("ANTHROPIC_API_KEY が未設定です");

  // 1) 資料を選ぶ
  let ids: string[];
  if (input.sourceIds && input.sourceIds.length > 0) {
    ids = input.sourceIds.slice(0, 8);
  } else {
    const hits = await searchKnowledge(input.question, 6, { isAdmin: input.isAdmin, origin: input.origin });
    ids = hits.map((h) => h.id);
  }
  if (ids.length === 0) {
    return {
      answer: "この質問に当たる資料がライブラリに見つかりませんでした。別の言い方（媒体名・商品名・エリア名）で聞くか、資料の一覧から読む資料を指定してください。",
      citations: [],
      sources: [],
      usedModel: "",
    };
  }
  const rows = await db.knowledgeSource.findMany({
    where: { id: { in: ids }, ...knowledgeWhere({ isAdmin: input.isAdmin }) },
    select: { id: true, title: true, origin: true, publisher: true, publishedAt: true, content: true },
  });
  // 採点順を保つ
  const ordered = ids.map((id) => rows.find((r) => r.id === id)).filter((r): r is NonNullable<typeof r> => Boolean(r));
  if (ordered.length === 0) {
    return { answer: "指定の資料は読めません（存在しないか、本部限定です）。", citations: [], sources: [], usedModel: "" };
  }

  // 2) 費用の蓋: 合計文字数を抑える
  let budget = TOTAL_CHAR_BUDGET;
  const docs = ordered.map((r) => {
    const allow = Math.max(MIN_PER_DOC, Math.min(r.content.length, budget));
    const truncated = r.content.length > allow;
    const text = truncated ? r.content.slice(0, allow) + "\n\n（以降は省略。全文はOSの資料ページで）" : r.content;
    budget = Math.max(0, budget - text.length);
    return { ...r, text, truncated };
  });

  const docBlocks: Anthropic.Messages.ContentBlockParam[] = docs.map((d) => ({
    type: "document",
    source: { type: "text", media_type: "text/plain", data: d.text },
    title: `【${ORIGIN_SHORT[d.origin]}】${d.title}${d.publisher ? `（発行元: ${d.publisher}）` : ""}${d.publishedAt ? ` ${d.publishedAt}` : ""}`,
    citations: { enabled: true },
  }));

  const client = new Anthropic({ apiKey });
  const model = "claude-sonnet-5";
  const res = await client.messages.create({
    model,
    max_tokens: 3000,
    system: SYSTEM,
    messages: [
      {
        role: "user",
        content: [...docBlocks, { type: "text", text: `質問: ${input.question}` }],
      },
    ],
  });
  if (res.stop_reason === "refusal") throw new Error("AIが回答を拒否しました");

  // 3) 引用を [n] に変換
  const citations: AskCitation[] = [];
  const keyOf = (docIndex: number, start: number) => `${docIndex}:${start}`;
  const seen = new Map<string, number>();
  let answer = "";
  for (const block of res.content) {
    if (block.type !== "text") continue;
    answer += block.text;
    const cs = (block as Anthropic.Messages.TextBlock).citations ?? [];
    const refs: number[] = [];
    for (const c of cs) {
      if (c.type !== "char_location") continue;
      const doc = docs[c.document_index];
      if (!doc) continue;
      const k = keyOf(c.document_index, c.start_char_index);
      let n = seen.get(k);
      if (!n) {
        n = citations.length + 1;
        seen.set(k, n);
        citations.push({
          n,
          sourceId: doc.id,
          title: doc.title,
          origin: doc.origin,
          page: pageOf(doc.text, c.start_char_index),
          citedText: c.cited_text.replace(/\s+/g, " ").trim().slice(0, 300),
        });
      }
      if (!refs.includes(n)) refs.push(n);
    }
    if (refs.length) answer += refs.map((n) => `[${n}]`).join("");
  }

  return {
    answer: answer.trim(),
    citations,
    sources: docs.map((d) => ({ id: d.id, title: d.title, origin: d.origin, publisher: d.publisher, truncated: d.truncated })),
    usedModel: model,
  };
}
