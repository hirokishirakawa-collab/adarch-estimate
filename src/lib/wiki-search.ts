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
 * 4. 逆引き: 記事の題名・見出しに含まれる語が質問文に入っていれば加点
 *    （日本語の質問は空白で割れず1語になりがちで、1〜3だけでは「入札ファインダーの使い方を教えて」ですら0件だった 2026-09-03）
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
  const queryLower = query.toLowerCase();
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
    // 逆引き: 題名の語（重み3）・見出しの語（重み2）が質問文に含まれるか
    //   さらに語を文字種の切れ目で割った断片（例: 補助金ファインダー→補助金／ファインダー）は重み1
    for (const t of termsOf(a.title)) {
      if (queryLower.includes(t)) score += 3;
      else for (const f of fragmentsOf(t)) if (queryLower.includes(f)) score += 1;
    }
    for (const t of headingTerms(a.body)) {
      if (queryLower.includes(t)) score += 2;
      else for (const f of fragmentsOf(t)) if (queryLower.includes(f)) score += 1;
    }
    return { ...a, score };
  });

  return scored
    .filter((a) => a.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit);
}

/** 題名や見出しを「語」に割る（2〜20文字・小文字）。「〜の使い方」「〜について」等の飾りは落とす */
function termsOf(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/の使い方|の流れ|について|【|】|\(\d{4}年\d{1,2}月[^)）]*[)）]|（\d{4}年\d{1,2}月[^)）]*[)）]/g, " ")
    .split(/[\s（）()「」—\-–:：・／/、。,.?？!！]+/)
    .map((t) => t.trim())
    .filter((t) => t.length >= 2 && t.length <= 20);
}

/** 語を文字種（漢字／カタカナ／英数）の切れ目で割る。ひらがなは助詞が多いので捨てる。2文字以上 */
function fragmentsOf(term: string): string[] {
  const runs = term.match(/[一-龥々]+|[ァ-ヶー]+|[a-z0-9]+/g) ?? [];
  return runs.filter((r) => r.length >= 2 && r !== term);
}

/** 本文の見出し（## / ###）から語を取る */
function headingTerms(body: string): string[] {
  const out = new Set<string>();
  for (const m of body.matchAll(/^#{2,3}\s+(.+)$/gm)) for (const t of termsOf(m[1])) out.add(t);
  return Array.from(out);
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
