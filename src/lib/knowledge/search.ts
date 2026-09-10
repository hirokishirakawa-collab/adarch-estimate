// ==============================================================
// 資料ライブラリ — 検索（キーワード採点・AI呼び出しなし）
//   題名・発行元・検索語・要約・整理・本文で採点。Wiki検索と同じ発想（逆引きつき）。
//   READY だけ。hqOnly は ADMIN 以外に出さない。
// ==============================================================

import { db } from "@/lib/db";
import type { KnowledgeOrigin } from "@/generated/prisma/client";
import { ORIGIN_SHORT } from "./rules";

export interface KnowledgeHit {
  id: string;
  title: string;
  origin: KnowledgeOrigin;
  publisher: string | null;
  publishedAt: string | null;
  summary: string | null;
  digest: string | null;
  keywords: string[];
  pageCount: number | null;
  score: number;
  /** 質問語が本文で最初に当たった付近（前後）を返す */
  excerpt: string | null;
}

function keywordsOf(query: string): string[] {
  return query
    .toLowerCase()
    .replace(/[、。,.?？!！（）()「」【】\s]+/g, " ")
    .split(" ")
    .map((k) => k.trim())
    .filter((k) => k.length >= 2);
}

function fragmentsOf(term: string): string[] {
  const runs = term.match(/[一-龥々]+|[ァ-ヶー]+|[a-z0-9]+/g) ?? [];
  return runs.filter((r) => r.length >= 2 && r !== term);
}

function countOccurrences(hay: string, needle: string): number {
  if (!needle) return 0;
  let n = 0, i = 0;
  while ((i = hay.indexOf(needle, i)) !== -1) { n++; i += needle.length; }
  return n;
}

export function knowledgeWhere(opts: { isAdmin: boolean; origin?: KnowledgeOrigin }) {
  return {
    status: "READY" as const,
    ...(opts.isAdmin ? {} : { hqOnly: false }),
    ...(opts.origin ? { origin: opts.origin } : {}),
  };
}

export async function searchKnowledge(
  query: string,
  limit = 5,
  opts: { isAdmin: boolean; origin?: KnowledgeOrigin } = { isAdmin: false }
): Promise<KnowledgeHit[]> {
  const kws = keywordsOf(query);
  if (kws.length === 0) return [];
  const rows = await db.knowledgeSource.findMany({
    where: knowledgeWhere(opts),
    select: { id: true, title: true, origin: true, publisher: true, publishedAt: true, summary: true, digest: true, keywords: true, pageCount: true, content: true },
  });
  const q = query.toLowerCase();
  const scored = rows.map((r) => {
    const title = r.title.toLowerCase();
    const head = [r.publisher ?? "", r.summary ?? "", r.keywords.join(" ")].join(" ").toLowerCase();
    const digest = (r.digest ?? "").toLowerCase();
    const body = r.content.toLowerCase();
    let score = 0;
    let firstHit = -1;
    for (const k of kws) {
      score += countOccurrences(title, k) * 6;
      score += countOccurrences(head, k) * 4;
      score += countOccurrences(digest, k) * 2;
      const b = countOccurrences(body, k);
      score += Math.min(b, 20); // 本文の連呼で他を押しのけない
      if (b > 0 && firstHit < 0) firstHit = body.indexOf(k);
    }
    // 逆引き: 検索語（AIが付けた語）が質問文に含まれていれば加点
    for (const kw of r.keywords) {
      const t = kw.toLowerCase();
      if (t.length >= 2 && q.includes(t)) score += 5;
      else for (const f of fragmentsOf(t)) if (q.includes(f)) score += 1;
    }
    const excerpt = firstHit >= 0 ? r.content.slice(Math.max(0, firstHit - 120), firstHit + 200).replace(/\s+/g, " ") : null;
    return { id: r.id, title: r.title, origin: r.origin, publisher: r.publisher, publishedAt: r.publishedAt, summary: r.summary, digest: r.digest, keywords: r.keywords, pageCount: r.pageCount, score, excerpt };
  });
  return scored.filter((s) => s.score > 0).sort((a, b) => b.score - a.score).slice(0, limit);
}

/** アーチくん・チャットの system 用（整理だけ・本文は渡さない） */
export function formatKnowledgeForPrompt(hits: KnowledgeHit[], maxDigestChars = 1800): string {
  if (hits.length === 0) return "";
  return hits
    .map((h) => {
      const digest = h.digest ? (h.digest.length > maxDigestChars ? h.digest.slice(0, maxDigestChars) + "…" : h.digest) : "";
      return `### 【${ORIGIN_SHORT[h.origin]}】${h.title}${h.publisher ? `（発行元: ${h.publisher}）` : ""}${h.publishedAt ? ` ${h.publishedAt}` : ""}\n${h.summary ?? ""}\n${digest}\n[資料: /dashboard/knowledge/${h.id}]`;
    })
    .join("\n\n---\n\n");
}
