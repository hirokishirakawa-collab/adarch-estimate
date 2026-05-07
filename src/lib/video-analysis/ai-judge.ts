import Anthropic from "@anthropic-ai/sdk";
import { readFileSync } from "fs";
import type { DetectedChange } from "./types";

const client = new Anthropic();

interface FramePair {
  timecode: number;
  beforeFramePath: string;
  afterFramePath: string;
  diffRatio: number;
}

interface AiJudgment {
  isIntentionalChange: boolean;
  changeType: "TELOP" | "CUT_REPLACE" | "COLOR" | "DURATION" | "ANIMATION" | "OTHER" | "NONE";
  description: string;
  confidence: number;
}

/**
 * Claude Vision で差分フレームペアを判定。
 * バッチで送信してコスト効率化。
 */
export async function judgeChangesWithAI(
  framePairs: FramePair[],
  context?: { hasDurationChange: boolean; durationDiff?: number },
  maxBatchSize: number = 5
): Promise<DetectedChange[]> {
  const changes: DetectedChange[] = [];

  for (let i = 0; i < framePairs.length; i += maxBatchSize) {
    const batch = framePairs.slice(i, i + maxBatchSize);
    const batchResults = await judgeBatch(batch, context);
    changes.push(...batchResults);
  }

  return changes;
}

async function judgeBatch(
  pairs: FramePair[],
  context?: { hasDurationChange: boolean; durationDiff?: number }
): Promise<DetectedChange[]> {
  const durationNote = context?.hasDurationChange
    ? `\n\n重要な前提条件：
この動画は尺変更（${context.durationDiff && context.durationDiff > 0 ? "+" : ""}${context.durationDiff?.toFixed(1)}秒）が検出されています。
尺変更により、以下のような「見かけ上の差分」が発生します。これらは意図的な修正ではないため、NONEとして扱ってください：
- テロップやオブジェクトのタイミングのズレ（内容は同一だが表示タイミングが前後にシフト）
- フレーム位置のズレによる映像の微妙な違い
- 同じテロップが少し早く/遅く表示されているだけのケース

報告すべきは、テロップの「内容自体」が変わっている場合や、映像素材が別のものに差し替えられている場合など、尺変更では説明できない変更のみです。`
    : "";

  const content: Anthropic.Messages.ContentBlockParam[] = [
    {
      type: "text",
      text: `あなたは映像制作の修正チェック専門AIです。
修正前と修正後のフレーム画像を比較し、意図的な修正が行われたかを判定してください。

以下のルールに従ってください：
- エンコード差やノイズ（圧縮アーティファクト）は無視してください
- 意図的な修正のみを報告してください
- 各ペアについてJSON形式で回答してください${durationNote}

修正の種類：
- TELOP: テロップ・字幕・テキストの内容変更（文字の追加・削除・書き換え）
- CUT_REPLACE: カット（映像素材）の差し替え
- COLOR: カラーグレーディング・色味の変更
- ANIMATION: アニメーション・動きの変更
- OTHER: その他の意図的な変更
- NONE: 意図的な変更なし（ノイズ・圧縮差・タイミングズレのみ）

${pairs.length}組のフレームペアを比較してください。回答は以下のJSON配列のみ（説明不要）：
[{"index": 0, "type": "TELOP", "description": "画面下部にテロップ「○○」が追加", "confidence": 0.95}, ...]`,
    },
  ];

  // 各ペアの画像を追加
  for (let i = 0; i < pairs.length; i++) {
    const pair = pairs[i];

    content.push({
      type: "text",
      text: `\n--- ペア ${i} (タイムコード: ${formatTime(pair.timecode)}, ピクセル変化率: ${(pair.diffRatio * 100).toFixed(1)}%) ---\n修正前:`,
    });

    try {
      const beforeData = readFileSync(pair.beforeFramePath);
      content.push({
        type: "image",
        source: {
          type: "base64",
          media_type: "image/png",
          data: beforeData.toString("base64"),
        },
      });
    } catch {
      content.push({ type: "text", text: "[画像読み込み失敗]" });
    }

    content.push({ type: "text", text: "修正後:" });

    try {
      const afterData = readFileSync(pair.afterFramePath);
      content.push({
        type: "image",
        source: {
          type: "base64",
          media_type: "image/png",
          data: afterData.toString("base64"),
        },
      });
    } catch {
      content.push({ type: "text", text: "[画像読み込み失敗]" });
    }
  }

  try {
    const response = await client.messages.create({
      model: "claude-sonnet-4-6",
      max_tokens: 2000,
      messages: [{ role: "user", content }],
    });

    const text = response.content
      .filter((b): b is Anthropic.Messages.TextBlock => b.type === "text")
      .map((b) => b.text)
      .join("");

    // JSONを抽出
    const jsonMatch = text.match(/\[[\s\S]*\]/);
    if (!jsonMatch) return [];

    const judgments: { index: number; type: string; description: string; confidence: number }[] =
      JSON.parse(jsonMatch[0]);

    const changes: DetectedChange[] = [];
    for (const j of judgments) {
      if (j.type === "NONE") continue;
      const pair = pairs[j.index];
      if (!pair) continue;

      changes.push({
        type: j.type as DetectedChange["type"],
        timecodeIn: pair.timecode,
        description: j.description,
        confidence: j.confidence,
      });
    }

    return changes;
  } catch (e) {
    console.error("[ai-judge] Claude API error:", e);
    return [];
  }
}

function formatTime(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}
