import Link from "next/link";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { getMockBranchId } from "@/lib/data/customers";
import { BookOpen, Plus, Search } from "lucide-react";
import type { UserRole } from "@/types/roles";
import type { Prisma } from "@/generated/prisma/client";

interface PageProps {
  searchParams: Promise<{ q?: string }>;
}

export default async function WikiPage({ searchParams }: PageProps) {
  const { q } = await searchParams;

  const session = await auth();
  const role = (session?.user?.role ?? "MANAGER") as UserRole;
  const email = session?.user?.email ?? "";
  const userBranchId = getMockBranchId(email, role);

  const where: Prisma.WikiArticleWhereInput = {
    ...(role === "ADMIN" || !userBranchId ? {} : { branchId: userBranchId }),
    ...(q ? { title: { contains: q, mode: "insensitive" } } : {}),
  };

  const articles = await db.wikiArticle.findMany({
    where,
    orderBy: { updatedAt: "desc" },
    select: { id: true, title: true, authorName: true, updatedAt: true, createdAt: true },
  });

  const fmt = (d: Date) =>
    new Intl.DateTimeFormat("ja-JP", { year: "numeric", month: "short", day: "numeric" }).format(
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
          className="flex items-center gap-1.5 px-3 py-1.5 bg-teal-600 text-white text-xs font-medium rounded-lg hover:bg-teal-700 transition-colors"
        >
          <Plus className="w-3.5 h-3.5" />
          新規記事
        </Link>
      </div>

      {/* 検索 */}
      <form method="GET" className="flex items-center gap-2">
        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-zinc-400" />
          <input
            name="q"
            type="text"
            defaultValue={q}
            placeholder="記事タイトルで検索"
            className="pl-8 pr-3 py-1.5 text-xs border border-zinc-200 rounded-lg w-56 focus:outline-none focus:ring-2 focus:ring-teal-500"
          />
        </div>
        <button
          type="submit"
          className="px-3 py-1.5 text-xs bg-zinc-100 hover:bg-zinc-200 text-zinc-700 rounded-lg transition-colors"
        >
          検索
        </button>
        {q && (
          <Link href="/dashboard/wiki" className="text-xs text-zinc-500 hover:text-zinc-700">
            クリア
          </Link>
        )}
      </form>

      {/* 記事一覧 */}
      <div className="bg-white rounded-xl border border-zinc-200 overflow-hidden">
        {articles.length === 0 ? (
          <div className="py-20 text-center">
            <p className="text-sm text-zinc-400">
              {q ? "条件に一致する記事がありません" : "記事がまだありません"}
            </p>
            {!q && (
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
                    <p className="text-[11px] text-zinc-400 mt-0.5">
                      {article.authorName} · 更新: {fmt(article.updatedAt)}
                    </p>
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
