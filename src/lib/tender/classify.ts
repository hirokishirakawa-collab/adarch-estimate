// ==============================================================
// 入札案件の「うちの仕事か」判定
//
// 件名で絞っても、機材購入（映像データ抽出用パソコン）・設備工事
// （プロジェクター更新工事）・備品（高速カラー印刷機）が必ず混ざる。
// ここで落とし切るのが目的。取りこぼしより、外れを掴ませる方が現場では有害。
//
// モデルは既存の自動処理と揃えて Sonnet 固定（日次 cron ＝ ヘッドレス）。
// ==============================================================

import Anthropic from "@anthropic-ai/sdk";
import type { TenderFit, TenderWorkType } from "@/generated/prisma/client";

const MODEL = "claude-sonnet-5";

/** 1回のAPI呼び出しで判定する件数 */
const BATCH_SIZE = 8;
/** 同時に走らせるバッチ数。実行時間の上限（5分）に収めるため直列にはしない */
const CONCURRENCY = 5;
/** 公告文はこの文字数で切る（入札心得・様式の説明が長く、判断には効かない） */
const DESCRIPTION_MAX_CHARS = 2000;

const FITS = ["MATCH", "MAYBE", "MISMATCH"] as const;
const WORK_TYPES = ["VIDEO", "AD", "PRINT", "WEB", "EVENT", "DESIGN", "OTHER"] as const;

export interface ClassifyInput {
  kkjKey: string;
  projectName: string;
  organizationName?: string | null;
  category?: string | null;
  procedureType?: string | null;
  description?: string | null;
}

export interface ClassifyResult {
  kkjKey: string;
  fit: TenderFit;
  workType: TenderWorkType;
  reason: string;
  evidence: string;
  needsQualification: boolean;
}

const SYSTEM_PROMPT = `あなたは広告代理店グループ（Ad Archグループ）の入札担当です。
自治体・官公庁の入札公告を読み、「この案件をグループが受注できる仕事か」を判定します。

グループができる仕事は次の4つです。
  - 動画・映像の企画制作（PR動画、啓発動画、CM、撮影）
  - 広告の出稿（テレビ・新聞・交通・看板・Web広告・SNS広告）
  - 印刷物の企画制作（パンフレット、チラシ、ポスター、冊子、デザイン）
  - イベント・式典の企画運営、Webサイト・SNS運用

【判定区分】以下の3つのみ。
- MATCH    : 上記4つのいずれかの発注。制作物や広報活動そのものを買っている案件。
- MAYBE    : 制作が含まれる可能性はあるが、主たる発注内容が読み取れない。または調査・コンサル等に制作が付随する案件。
- MISMATCH : 制作の仕事ではない。機材・備品・システムの購入や賃貸借、施設の工事、清掃・警備・点検、人材派遣、印刷機など機械の購入。

【最重要ルール】
- 件名に「映像」「印刷」「デザイン」が入っていても、買っているのが機械・パソコン・システム・工事なら必ず MISMATCH。
  例:「映像データ抽出用パソコンの購入」「高速カラー印刷機交換」「プロジェクター更新工事」はすべて MISMATCH。
- 「広告掲出事業」など、行政が広告枠を売る側（事業者が広告料を払う）の案件は MISMATCH。買うのではなく売られている。
- 迷ったら MATCH ではなく MAYBE にすること。

【workType】案件の中身に最も近いものを1つ。
VIDEO=動画・映像 / AD=広告出稿・媒体 / PRINT=印刷物 / WEB=Webサイト・SNS / EVENT=イベント・式典 / DESIGN=デザイン・ロゴ・写真 / OTHER=その他

【needsQualification】
入札参加資格（有資格者名簿への登録、等級・格付、地域要件など）が必要と読める場合は true。
読み取れない場合は false にし、reason には書かないこと。

【出力】
- reason: 営業担当がひと目で判断できる1行（60〜100字）。何を発注しているのかを具体的に書く。
- evidence: 判断の元になった公告文の語句を20〜60字で抜き出す。原文にない言葉を作らないこと。

output_judgements ツールで必ず出力してください。`;

function buildUserMessage(items: ClassifyInput[]): string {
  return items
    .map((it, i) => {
      const desc = (it.description ?? "").slice(0, DESCRIPTION_MAX_CHARS);
      return [
        `### ${i + 1}. [${it.kkjKey}] ${it.projectName}`,
        it.organizationName ? `発注機関: ${it.organizationName}` : null,
        it.category ? `区分: ${it.category}` : null,
        it.procedureType ? `公示種別: ${it.procedureType}` : null,
        desc ? `公告文:\n${desc}` : "公告文: （記載なし）",
      ]
        .filter(Boolean)
        .join("\n");
    })
    .join("\n\n---\n\n");
}

const TOOL = {
  name: "output_judgements",
  description: "各入札案件がグループの仕事かどうかを出力する",
  input_schema: {
    type: "object" as const,
    properties: {
      judgements: {
        type: "array",
        items: {
          type: "object",
          properties: {
            kkjKey: { type: "string", description: "対象案件のID（角括弧内の値をそのまま）" },
            fit: { type: "string", enum: [...FITS], description: "受注できる仕事か" },
            workType: { type: "string", enum: [...WORK_TYPES], description: "仕事の種類" },
            reason: { type: "string", description: "営業担当向けの1行（60〜100字）" },
            evidence: { type: "string", description: "根拠になった公告文の抜粋（20〜60字）" },
            needsQualification: {
              type: "boolean",
              description: "入札参加資格が必要と読めるか",
            },
          },
          required: ["kkjKey", "fit", "workType", "reason", "evidence", "needsQualification"],
        },
      },
    },
    required: ["judgements"],
  },
};

interface RawJudgement {
  kkjKey?: string;
  fit?: string;
  workType?: string;
  reason?: string;
  evidence?: string;
  needsQualification?: boolean;
}

async function classifyBatch(
  client: Anthropic,
  items: ClassifyInput[],
): Promise<ClassifyResult[]> {
  const response = await client.messages.create({
    model: MODEL,
    thinking: { type: "disabled" as const },
    max_tokens: 4096,
    system: [{ type: "text", text: SYSTEM_PROMPT, cache_control: { type: "ephemeral" } }],
    messages: [{ role: "user", content: buildUserMessage(items) }],
    tools: [TOOL],
    tool_choice: { type: "tool", name: "output_judgements" },
  });

  const block = response.content.find((b) => b.type === "tool_use");
  if (!block || block.type !== "tool_use") return [];

  const parsed = block.input as { judgements?: RawJudgement[] };
  const valid = new Set(items.map((i) => i.kkjKey));

  return (parsed.judgements ?? [])
    // モデルがIDを取り違えた分は捨てる（別案件の判定を貼るくらいなら未判定の方が安全）
    .filter((j): j is RawJudgement & { kkjKey: string } => !!j.kkjKey && valid.has(j.kkjKey))
    .map((j) => ({
      kkjKey: j.kkjKey,
      fit: (FITS as readonly string[]).includes(j.fit ?? "")
        ? (j.fit as TenderFit)
        : ("MAYBE" as TenderFit),
      workType: (WORK_TYPES as readonly string[]).includes(j.workType ?? "")
        ? (j.workType as TenderWorkType)
        : ("OTHER" as TenderWorkType),
      reason: j.reason ?? "",
      evidence: j.evidence ?? "",
      needsQualification: j.needsQualification === true,
    }));
}

export interface ClassifyOptions {
  /** この時刻（Date.now() 基準のミリ秒）を過ぎたら新しいバッチを始めない */
  deadline?: number;
  /**
   * バッチが1つ終わるたびに呼ばれる。ここで保存すること。
   * 全バッチの完了を待ってから保存すると、実行時間の上限で切られたときに
   * それまでの判定が丸ごと捨てられる（実際に683件を取りこぼした）。
   */
  onResults?: (results: ClassifyResult[]) => Promise<void>;
}

/**
 * 案件をまとめて判定する。
 * 1バッチが失敗しても他のバッチは続行する（全滅を避ける）。
 * 締切を過ぎた分は手つかずのまま残し、次回の実行に持ち越す。
 */
export async function classifyTenders(
  items: ClassifyInput[],
  options: ClassifyOptions = {},
): Promise<{ classified: number; failedBatches: number; notStarted: number }> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) throw new Error("[tender] ANTHROPIC_API_KEY が設定されていません");

  const client = new Anthropic({ apiKey });
  const batches: ClassifyInput[][] = [];
  for (let i = 0; i < items.length; i += BATCH_SIZE) {
    batches.push(items.slice(i, i + BATCH_SIZE));
  }

  let next = 0;
  let classified = 0;
  let failedBatches = 0;
  let started = 0;

  const worker = async () => {
    for (;;) {
      const i = next++;
      if (i >= batches.length) return;
      if (options.deadline && Date.now() > options.deadline) return;
      started++;
      try {
        const results = await classifyBatch(client, batches[i]);
        if (options.onResults) await options.onResults(results);
        classified += results.length;
      } catch (e) {
        console.error(`[tender] 判定失敗 batch=${i}`, e);
        failedBatches++;
      }
    }
  };

  await Promise.all(Array.from({ length: CONCURRENCY }, worker));

  return {
    classified,
    failedBatches,
    notStarted: (batches.length - started) * BATCH_SIZE,
  };
}
