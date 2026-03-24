import Link from "next/link";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { getMockBranchId } from "@/lib/data/customers";
import { BookOpen, Plus, Search } from "lucide-react";
import type { UserRole } from "@/types/roles";
import type { Prisma } from "@/generated/prisma/client";

interface PageProps {
  searchParams: Promise<{ q?: string; tag?: string }>;
}

export default async function WikiPage({ searchParams }: PageProps) {
  const { q, tag } = await searchParams;

  const session = await auth();
  const role = (session?.user?.role ?? "MANAGER") as UserRole;
  const email = session?.user?.email ?? "";
  const userBranchId = getMockBranchId(email, role);

  const where: Prisma.WikiArticleWhereInput = {
    ...(role === "ADMIN" || !userBranchId ? {} : { branchId: userBranchId }),
    ...(q
      ? {
          OR: [
            { title: { contains: q, mode: "insensitive" } },
            { body: { contains: q, mode: "insensitive" } },
          ],
        }
      : {}),
    ...(tag ? { tags: { some: { name: tag } } } : {}),
  };

  const [articles, allTags] = await Promise.all([
    db.wikiArticle.findMany({
      where,
      orderBy: { updatedAt: "desc" },
      select: {
        id: true,
        title: true,
        authorName: true,
        updatedAt: true,
        createdAt: true,
        tags: { select: { id: true, name: true, color: true } },
      },
    }),
    db.wikiTag.findMany({ orderBy: { name: "asc" } }),
  ]);

  const fmt = (d: Date) =>
    new Intl.DateTimeFormat("ja-JP", { year: "numeric", month: "short", day: "numeric", timeZone: "Asia/Tokyo" }).format(
      new Date(d)
    );

  return (
    <div className="px-6 py-6 max-w-screen-xl mx-auto w-full space-y-5">
      {/* ヘッダー */}
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 bg-teal-50 rounded-xl flex items-center justify-center">
            <BookOpen className="text-teal-600" style={{ width: "1.125rem", height: "1.125rem" }} />
          </div>
          <div>
            <h2 className="text-lg font-bold text-zinc-900">社内Wiki</h2>
            <p className="text-xs text-zinc-500 mt-0.5">ナレッジベース・社内ドキュメント</p>
          </div>
        </div>
        <Link
          href="/dashboard/wiki/new"
          data-tour="wiki-new"
          className="flex items-center gap-1.5 px-3 py-1.5 bg-teal-600 text-white text-xs font-medium rounded-lg hover:bg-teal-700 transition-colors"
        >
          <Plus className="w-3.5 h-3.5" />
          新規記事
        </Link>
      </div>

      {/* 検索 */}
      <form data-tour="wiki-search" method="GET" className="flex items-center gap-2">
        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-zinc-400" />
          <input
            name="q"
            type="text"
            defaultValue={q}
            placeholder="タイトル・本文で検索"
            className="pl-8 pr-3 py-1.5 text-xs border border-zinc-200 rounded-lg w-56 focus:outline-none focus:ring-2 focus:ring-teal-500"
          />
        </div>
        {tag && <input type="hidden" name="tag" value={tag} />}
        <button
          type="submit"
          className="px-3 py-1.5 text-xs bg-zinc-100 hover:bg-zinc-200 text-zinc-700 rounded-lg transition-colors"
        >
          検索
        </button>
        {(q || tag) && (
          <Link href="/dashboard/wiki" className="text-xs text-zinc-500 hover:text-zinc-700">
            クリア
          </Link>
        )}
      </form>

      {/* タグフィルター */}
      {allTags.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {allTags.map((t) => (
            <Link
              key={t.id}
              href={tag === t.name ? `/dashboard/wiki${q ? `?q=${q}` : ""}` : `/dashboard/wiki?tag=${encodeURIComponent(t.name)}${q ? `&q=${q}` : ""}`}
              className={`px-2.5 py-1 text-xs rounded-full border transition-all ${
                tag === t.name
                  ? "border-transparent text-white font-semibold"
                  : "border-zinc-200 text-zinc-500 hover:border-zinc-300"
              }`}
              style={tag === t.name ? { backgroundColor: t.color } : {}}
            >
              {t.name}
            </Link>
          ))}
        </div>
      )}

      {/* 記事一覧 */}
      <div className="bg-white rounded-xl border border-zinc-200 overflow-hidden">
        {articles.length === 0 ? (
          <div className="py-20 text-center">
            <p className="text-sm text-zinc-400">
              {q || tag ? "条件に一致する記事がありません" : "記事がまだありません"}
            </p>
            {!q && !tag && (
              <Link
                href="/dashboard/wiki/new"
                className="mt-3 inline-flex items-center gap-1 text-xs text-teal-600 hover:underline"
              >
                <Plus className="w-3 h-3" /> 最初の記事を作成する
              </Link>
            )}
          </div>
        ) : (
          <ul className="divide-y divide-zinc-100">
            {articles.map((article) => (
              <li key={article.id}>
                <Link
                  href={`/dashboard/wiki/${article.id}`}
                  className="flex items-center justify-between px-5 py-3.5 hover:bg-zinc-50 transition-colors group"
                >
                  <div>
                    <p className="text-sm font-semibold text-zinc-800 group-hover:text-teal-700 transition-colors">
                      {article.title}
                    </p>
                    <div className="flex items-center gap-2 mt-1">
                      <p className="text-[11px] text-zinc-400">
                        {article.authorName} · 更新: {fmt(article.updatedAt)}
                      </p>
                      {article.tags.length > 0 && (
                        <div className="flex gap-1">
                          {article.tags.map((t) => (
                            <span
                              key={t.id}
                              className="px-1.5 py-0.5 text-[10px] rounded-full text-white font-medium"
                              style={{ backgroundColor: t.color }}
                            >
                              {t.name}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                  <span className="text-[11px] text-zinc-400 flex-shrink-0">
                    作成: {fmt(article.createdAt)}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
