import { notFound } from "next/navigation";
import Link from "next/link";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { getMockBranchId } from "@/lib/data/customers";
import { WikiArticleContent } from "@/components/wiki/wiki-article-content";
import { deleteArticle } from "@/lib/actions/wiki";
import { BookOpen, ChevronLeft, Pencil, Trash2 } from "lucide-react";
import type { UserRole } from "@/types/roles";

interface PageProps {
  params: Promise<{ id: string }>;
}

export default async function WikiArticlePage({ params }: PageProps) {
  const { id } = await params;

  const session = await auth();
  const role = (session?.user?.role ?? "MANAGER") as UserRole;
  const email = session?.user?.email ?? "";
  const userBranchId = getMockBranchId(email, role);

  const where =
    role === "ADMIN" || !userBranchId ? { id } : { id, branchId: userBranchId };

  const article = await db.wikiArticle.findFirst({ where });
  if (!article) notFound();

  const fmt = (d: Date) =>
    new Intl.DateTimeFormat("ja-JP", {
      year: "numeric",
      month: "long",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    }).format(new Date(d));

  const deleteAction = deleteArticle.bind(null, article.id);

  return (
    <div className="px-6 py-6 max-w-3xl mx-auto w-full space-y-5">
      {/* パンくず */}
      <Link
        href="/dashboard/wiki"
        className="inline-flex items-center gap-1 text-xs text-zinc-500 hover:text-zinc-800 transition-colors"
      >
        <ChevronLeft className="w-3.5 h-3.5" />
        Wiki一覧に戻る
      </Link>

      {/* 記事ヘッダー */}
      <div className="bg-white rounded-xl border border-zinc-200 px-6 py-5">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div className="flex items-start gap-3">
            <div className="w-8 h-8 bg-teal-50 rounded-lg flex items-center justify-center flex-shrink-0 mt-0.5">
              <BookOpen className="text-teal-600 w-4 h-4" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-zinc-900">{article.title}</h1>
              <p className="text-xs text-zinc-400 mt-1">
                {article.authorName} · 更新: {fmt(article.updatedAt)}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 flex-shrink-0">
            <Link
              href={`/dashboard/wiki/${article.id}/edit`}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-zinc-600 bg-zinc-100 hover:bg-zinc-200 rounded-lg transition-colors"
            >
              <Pencil className="w-3.5 h-3.5" />
              編集
            </Link>
            <form action={deleteAction}>
              <button
                type="submit"
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-red-600 bg-red-50 hover:bg-red-100 rounded-lg transition-colors"
                onClick={(e) => {
                  if (!confirm("この記事を削除しますか？")) e.preventDefault();
                }}
              >
                <Trash2 className="w-3.5 h-3.5" />
                削除
              </button>
            </form>
          </div>
        </div>
      </div>

      {/* 記事本文 */}
      <div className="bg-white rounded-xl border border-zinc-200 px-6 py-6">
        <WikiArticleContent body={article.body} />
      </div>
    </div>
  );
}
