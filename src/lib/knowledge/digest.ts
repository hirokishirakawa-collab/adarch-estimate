// ==============================================================
// 資料ライブラリ — AIによる整理（登録時に1回）
//   全文から「要約・検索語・使える中身／価格の扱い／実績の扱い／注意」を作る。
//   他社・媒体社の資料は、価格=卸値・実績=他社分 として切り分けて書かせる。
// ==============================================================

import Anthropic from "@anthropic-ai/sdk";
import type { KnowledgeOrigin } from "@/generated/prisma/client";
import { KNOWLEDGE_USE_RULES } from "./rules";

export interface DigestResult {
  title: string | null;
  publisher: string | null;
  publishedAt: string | null;
  summary: string;
  keywords: string[];
  digest: string;
}

const SYSTEM = `あなたは広告代理店グループ「アドアーチ」の本部で、資料ライブラリ（OSの頭脳）に入れる資料を整理する担当です。
全国の加盟代表（みんな社長）が、営業・提案・企画のときにこの整理を読んで「何が使えて、何がそのまま使えないか」を一目で分かるようにします。

${KNOWLEDGE_USE_RULES}

出力は次のJSONだけ（前後に文章を付けない）:
{
  "title": "資料の正式名称（表紙や題名から。分からなければ null）",
  "publisher": "発行元の会社名・媒体名（分からなければ null）",
  "publishedAt": "資料の年月・版（例: 2026年4月版。分からなければ null）",
  "summary": "この資料が何か・誰向けか・何が分かるかを200字以内で",
  "keywords": ["検索で当てるための語を15〜30個。媒体名・商品名・エリア・業種・仕組みの名前・数字の種類（例: 視聴者数・CPM）・同義語も"],
  "digest": "Markdown。次の見出しを必ずこの順で:\\n### 使える中身（仕組み・仕様・手順）\\n箇条書きで、営業や提案にそのまま参考にできる仕組み・仕様・配信面・エリア・条件・手順・用語を具体的に。数字を含む場合はページ印（p.N）を添える\\n### 価格の扱い\\n資料にある価格・単価・料金表を、どこにあるか（p.N）と種類を書き、【自社】ならそのまま使える旨、【他社・媒体】なら「卸値。販売価格はOSの正本で確認」と明記\\n### 実績・事例の扱い\\n資料にある実績・事例・数字を列挙し、【他社・媒体】なら「◯◯（発行元）の実績。自社実績として語らない」と明記\\n### 提案に使うときの注意\\n相手先固有の条件・古い可能性のある数字・景表法や表現上の注意など\\n### 関連するOSの機能\\nTVerシミュレーター／パッケージ台帳／補助金ファインダー等、この資料と組み合わせるOS機能があれば"
}`;

export function parseJsonLoose<T>(text: string): T | null {
  const trimmed = text.trim().replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "");
  try {
    return JSON.parse(trimmed) as T;
  } catch {
    const s = trimmed.indexOf("{");
    const e = trimmed.lastIndexOf("}");
    if (s >= 0 && e > s) {
      try {
        return JSON.parse(trimmed.slice(s, e + 1)) as T;
      } catch {
        return null;
      }
    }
    return null;
  }
}

export async function buildDigest(input: {
  content: string;
  origin: KnowledgeOrigin;
  title?: string | null;
  publisher?: string | null;
  note?: string | null;
}): Promise<DigestResult> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) throw new Error("ANTHROPIC_API_KEY が未設定です");
  const client = new Anthropic({ apiKey });
  const originLabel = input.origin === "OWN" ? "【自社】アドアーチ自身の資料" : "【他社・媒体】他社・媒体社の資料";
  const user = `## この資料の出どころ
${originLabel}
${input.title ? `登録時の題名: ${input.title}\n` : ""}${input.publisher ? `登録時の発行元: ${input.publisher}\n` : ""}${input.note ? `本部メモ: ${input.note}\n` : ""}
## 全文
${input.content}

上記の全文を読み、指定のJSONだけを出力してください。`;

  const stream = client.messages.stream({
    model: "claude-opus-5",
    max_tokens: 16000,
    system: SYSTEM,
    messages: [{ role: "user", content: user }],
  });
  const msg = await stream.finalMessage();
  if (msg.stop_reason === "refusal") throw new Error("AIが整理を拒否しました");
  const text = msg.content.filter((b): b is Anthropic.Messages.TextBlock => b.type === "text").map((b) => b.text).join("");
  const parsed = parseJsonLoose<Partial<DigestResult>>(text);
  if (!parsed || typeof parsed.summary !== "string" || typeof parsed.digest !== "string") {
    throw new Error("AIの整理結果を読み取れませんでした");
  }
  return {
    title: typeof parsed.title === "string" && parsed.title.trim() ? parsed.title.trim() : null,
    publisher: typeof parsed.publisher === "string" && parsed.publisher.trim() ? parsed.publisher.trim() : null,
    publishedAt: typeof parsed.publishedAt === "string" && parsed.publishedAt.trim() ? parsed.publishedAt.trim() : null,
    summary: parsed.summary.trim().slice(0, 600),
    keywords: Array.isArray(parsed.keywords) ? parsed.keywords.filter((k): k is string => typeof k === "string" && k.trim().length > 0).map((k) => k.trim()).slice(0, 40) : [],
    digest: parsed.digest.trim(),
  };
}
