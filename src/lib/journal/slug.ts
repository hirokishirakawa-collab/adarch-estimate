import { randomUUID } from "node:crypto";
import { createAnthropic } from "@/lib/ai/anthropic-client";
import { slugSchema, type DraftContent } from "./model";

// Journal記事のURL名（/journal/<slug>/）を、地域名と中身から付ける。
// 書く人に英語のURL名を考えさせない。本部が承認時に直せ、承認で固定する。
const MODEL = "claude-sonnet-5";
const MAX = 60;

export function normalizeSlug(raw: string) {
  let s = raw.normalize("NFKC").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
  if (s.length > MAX) s = s.slice(0, MAX).replace(/-[^-]*$/, "");
  return slugSchema.safeParse(s).success ? s : null;
}

const fallback = (kind: DraftContent["kind"]) => `${kind === "person" ? "person" : "article"}-${randomUUID().slice(0, 8)}`;

export async function suggestSlug(c: DraftContent): Promise<string> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return fallback(c.kind);
  const facts = c.kind === "person"
    ? `人物ページ。氏名: ${c.authorName}／会社: ${c.company}`
    : `記事タイトル: ${c.title}\n地域: ${c.region}\nカテゴリー: ${c.category}\n紹介文: ${c.summary}`;
  const rule = c.kind === "person"
    ? "氏名を『姓-名』のヘボン式ローマ字にする（例: 白川 大樹 → shirakawa-hiroki）。読みが不明なら一般的な読み。"
    : "『地域のローマ字-中身の英語』を2〜5語にする（例: 関市でTVer CMを撮影 → seki-tver-cm-shooting）。市・町・村・県は付けない。日付・番号・社名の略称は入れない。";
  try {
    const client = createAnthropic("journal-slug", { apiKey, timeout: 15_000, maxRetries: 1 });
    const res = await client.messages.create({
      model: MODEL, max_tokens: 80,
      thinking: { type: "disabled" }, // 既定の思考モードで max_tokens を使い切ると本文が空になる
      // 地名・氏名の読み違い（例: 大野城→onaka）を防ぐため、先に読みを書かせてからURL名を作らせる
      system: `Webページの英字URL名（半角小文字・数字・ハイフンのみ）を作る。${rule}\n出力は2行だけ:\nよみ: <地名または氏名の正しい読みをひらがなで>\nslug: <URL名>`,
      messages: [{ role: "user", content: facts }],
    });
    const text = res.content.map((b) => (b.type === "text" ? b.text : "")).join("");
    const line = text.split("\n").find((l) => /^\s*slug\s*[:：]/i.test(l))?.replace(/^\s*slug\s*[:：]/i, "").trim() ?? "";
    return normalizeSlug(line.split(/\s+/)[0] ?? "") ?? fallback(c.kind);
  } catch {
    return fallback(c.kind);
  }
}

type SlugLookup = { journalEntry: { findFirst(args: { where: { kind: string; slug: string } }): Promise<{ id: string } | null> } };
/** 同じ種類で使われていれば -2, -3 … を付ける。取り下げた記事のURLも使い回さない（行は消さないため自然に除外される）。 */
export async function uniqueSlug(store: SlugLookup, kind: string, base: string, selfId?: string) {
  for (let n = 1; n < 100; n++) {
    const suffix = n === 1 ? "" : `-${n}`;
    const slug = `${base.slice(0, MAX - suffix.length).replace(/-+$/, "")}${suffix}`;
    const hit = await store.journalEntry.findFirst({ where: { kind, slug } });
    if (!hit || hit.id === selfId) return slug;
  }
  return `${base.slice(0, MAX - 9)}-${randomUUID().slice(0, 8)}`;
}
