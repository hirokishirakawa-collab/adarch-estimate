import { db } from "@/lib/db";

export interface WikiSearchResult {
  id: string;
  title: string;
  body: string;
  score: number;
}

/**
 * ユーザーの質問文から関連Wiki記事を検索する。
 *
 * ロジック:
 * 1. クエリを2文字以上のキーワードに分割
 * 2. 各記事の title (重み3倍) と body (重み1倍) でキーワード出現回数をカウント
 * 3. スコア降順で上位 limit 件を返す
 *
 * シンプルなキーワードマッチだが、2-46記事規模では十分機能する。
 */
export async function searchWikiArticles(
  query: string,
  limit = 5,
  opts: { isAdmin?: boolean } = {}
): Promise<WikiSearchResult[]> {
  // クエリをキーワード分割（2文字以上）
  const keywords = query
    .replace(/[、。,.?？!！（）()「」\s]+/g, " ")
    .split(" ")
    .map((k) => k.trim())
    .filter((k) => k.length >= 2);

  if (keywords.length === 0) return [];

  const articles = await db.wikiArticle.findMany({
    select: { id: true, title: true, body: true },
  });

  // ADMIN向け記事は一般ユーザーの検索結果から除外
  const filtered = opts.isAdmin
    ? articles
    : articles.filter(
        (a) => !/ADMIN向け|ADMIN専用|本部のみ/i.test(a.title)
      );

  // スコアリング
  const scored = filtered.map((a) => {
    const titleLower = a.title.toLowerCase();
    const bodyLower = a.body.toLowerCase();
    let score = 0;
    for (const k of keywords) {
      const kl = k.toLowerCase();
      // 完全一致は高スコア
      const titleMatches = (titleLower.match(new RegExp(escapeRegExp(kl), "g")) || []).length;
      const bodyMatches = (bodyLower.match(new RegExp(escapeRegExp(kl), "g")) || []).length;
      score += titleMatches * 3 + bodyMatches;
    }
    return { ...a, score };
  });

  return scored
    .filter((a) => a.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit);
}

function escapeRegExp(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/**
 * 記事内容を system prompt 用にフォーマット。
 */
export function formatArticlesForPrompt(articles: WikiSearchResult[]): string {
  if (articles.length === 0) return "";

  return articles
    .map((a) => {
      // 本文が長すぎる場合は先頭1500文字に切り詰め
      const body = a.body.length > 1500 ? a.body.slice(0, 1500) + "..." : a.body;
      return `### ${a.title}\n${body}\n\n[詳細: /dashboard/wiki?q=${encodeURIComponent(a.title.replace(/の使い方$/, ""))}]`;
    })
    .join("\n\n---\n\n");
}
