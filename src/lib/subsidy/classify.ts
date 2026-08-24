// ==============================================================
// 広告費適合度の AI 判定
//
// jGrants の本文には「対象経費」が書かれていない。
// だからここでの判定は「当たりをつける」までで、断言はしない。
//   - CONFIRMED は絶対に返さない（人が公募要領を読んだ curated 層の専権）
//   - 返せるのは LIKELY / UNKNOWN / EXCLUDED の3つだけ
//
// モデルは既存の自動処理と揃えて Sonnet 固定（日次 cron ＝ ヘッドレス）。
// ==============================================================

import Anthropic from "@anthropic-ai/sdk";
import type { AdCostFit } from "@/generated/prisma/client";

const MODEL = "claude-sonnet-5";

/** 1回のAPI呼び出しで判定する件数 */
const BATCH_SIZE = 8;
/** 本文はこの文字数で切る（申請システムの動作環境説明などが長く、判断には効かない） */
const DETAIL_MAX_CHARS = 2500;

export interface ClassifyInput {
  jgrantsId: string;
  title: string;
  catchPhrase?: string | null;
  usePurpose?: string | null;
  industry?: string | null;
  detailText?: string | null;
}

export interface ClassifyResult {
  jgrantsId: string;
  fit: AdCostFit;
  reason: string;
  evidence: string;
}

const SYSTEM_PROMPT = `あなたは広告代理店（Ad Archグループ）の補助金リサーチ担当です。
補助金制度の公開情報を読み、「クライアントの広告費（動画制作・媒体出稿・チラシ・看板・Web広告・SNS広告など）がこの制度の補助対象経費になりうるか」を判定します。

【判定区分】以下の3つのみ。これ以外は返さないこと。
- LIKELY   : 販路開拓・広報・PR・展示会・ブランディング・マーケティングが事業目的や支援カテゴリに入っており、広告関連費が対象経費に含まれる可能性が高い
- UNKNOWN  : 判断材料が足りない。目的が広範すぎる、または記載が事務手続きの説明ばかりで内容が読み取れない
- EXCLUDED : 設備投資・研究開発・省エネ設備・人件費・雇用・施設整備などに限定されており、広告費が対象になるとは読めない

【最重要ルール】
- あなたが読んでいるのは制度の概要であって、公募要領（対象経費の一覧）ではありません。
  したがって「広告費が対象です」と断言してはいけません。LIKELY は「可能性が高い」までの意味です。
- 補助対象が事業者本人ではない制度（商工会等の支援機関が申請者、自治体が申請者など）は、
  営業先の事業者が使えないため UNKNOWN 以下にし、reason にその旨を必ず書くこと。
- 立地促進・設備投資・奨励金など、広告と無関係な制度に無理に LIKELY を付けないこと。
  外れを掴ませる方が、取りこぼすより営業現場では有害です。

【出力】
- reason: 営業担当が客先で読む1行（60〜100字）。結論と、根拠になった事業目的を書く。
- evidence: 判断の元になった原文の語句を20〜60字で抜き出す。原文にない言葉を作らないこと。

output_judgements ツールで必ず出力してください。`;

function buildUserMessage(items: ClassifyInput[]): string {
  return items
    .map((it, i) => {
      const detail = (it.detailText ?? "").slice(0, DETAIL_MAX_CHARS);
      return [
        `### ${i + 1}. [${it.jgrantsId}] ${it.title}`,
        it.catchPhrase ? `キャッチ: ${it.catchPhrase}` : null,
        it.usePurpose ? `利用目的: ${it.usePurpose}` : null,
        it.industry ? `対象業種: ${it.industry}` : null,
        detail ? `本文:\n${detail}` : "本文: （記載なし）",
      ]
        .filter(Boolean)
        .join("\n");
    })
    .join("\n\n---\n\n");
}

const TOOL = {
  name: "output_judgements",
  description: "各制度の広告費適合度を出力する",
  input_schema: {
    type: "object" as const,
    properties: {
      judgements: {
        type: "array",
        items: {
          type: "object",
          properties: {
            jgrantsId: { type: "string", description: "対象制度のID（角括弧内の値をそのまま）" },
            fit: {
              type: "string",
              enum: ["LIKELY", "UNKNOWN", "EXCLUDED"],
              description: "広告費適合度",
            },
            reason: { type: "string", description: "営業担当向けの1行（60〜100字）" },
            evidence: { type: "string", description: "根拠になった原文の抜粋（20〜60字）" },
          },
          required: ["jgrantsId", "fit", "reason", "evidence"],
        },
      },
    },
    required: ["judgements"],
  },
};

async function classifyBatch(
  client: Anthropic,
  items: ClassifyInput[],
): Promise<ClassifyResult[]> {
  const response = await client.messages.create({
    model: MODEL,
    thinking: { type: "disabled" as const },
    max_tokens: 4096,
    system: [
      { type: "text", text: SYSTEM_PROMPT, cache_control: { type: "ephemeral" } },
    ],
    messages: [{ role: "user", content: buildUserMessage(items) }],
    tools: [TOOL],
    tool_choice: { type: "tool", name: "output_judgements" },
  });

  const block = response.content.find((b) => b.type === "tool_use");
  if (!block || block.type !== "tool_use") return [];

  const parsed = block.input as { judgements?: ClassifyResult[] };
  const valid = new Set(items.map((i) => i.jgrantsId));

  return (parsed.judgements ?? [])
    // モデルがIDを取り違えた分は捨てる（別制度の判定を貼るくらいなら未判定の方が安全）
    .filter((j) => valid.has(j.jgrantsId))
    .map((j) => ({
      jgrantsId: j.jgrantsId,
      fit: (["LIKELY", "UNKNOWN", "EXCLUDED"] as const).includes(
        j.fit as "LIKELY" | "UNKNOWN" | "EXCLUDED",
      )
        ? j.fit
        : ("UNKNOWN" as AdCostFit),
      reason: j.reason ?? "",
      evidence: j.evidence ?? "",
    }));
}

/**
 * 制度をまとめて判定する。
 * 1バッチが失敗しても他のバッチは続行する（全滅を避ける）。
 */
export async function classifySubsidies(
  items: ClassifyInput[],
): Promise<{ results: ClassifyResult[]; failedBatches: number }> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) throw new Error("[subsidy] ANTHROPIC_API_KEY が設定されていません");

  const client = new Anthropic({ apiKey });
  const results: ClassifyResult[] = [];
  let failedBatches = 0;

  for (let i = 0; i < items.length; i += BATCH_SIZE) {
    const batch = items.slice(i, i + BATCH_SIZE);
    try {
      results.push(...(await classifyBatch(client, batch)));
    } catch (e) {
      console.error(`[subsidy] 判定失敗 batch=${i / BATCH_SIZE}`, e);
      failedBatches++;
    }
  }

  return { results, failedBatches };
}
