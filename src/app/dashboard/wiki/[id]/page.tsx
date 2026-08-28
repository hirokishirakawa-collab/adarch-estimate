import { notFound } from "next/navigation";
import Link from "next/link";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { getMockBranchId } from "@/lib/data/customers";
import { WikiArticleContent } from "@/components/wiki/wiki-article-content";
import { deleteArticle } from "@/lib/actions/wiki";
import { BookOpen, ChevronLeft, Pencil } from "lucide-react";
import { WikiDeleteButton } from "@/components/wiki/wiki-delete-button";
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

  // 本部（branch_hq）の記事＝ヘルプガイドは全拠点が読める（編集・削除は本部＝ADMINのみ）
  const where =
    role === "ADMIN" || !userBranchId ? { id } : { id, branchId: { in: [userBranchId, "branch_hq"] } };

  const article = await db.wikiArticle.findFirst({ where, include: { tags: true } });
  if (!article) notFound();
  const canEdit = role === "ADMIN" || !userBranchId || article.branchId === userBranchId;

  const fmt = (d: Date) =>
    new Intl.DateTimeFormat("ja-JP", {
      year: "numeric",
      month: "long",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      timeZone: "Asia/Tokyo",
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
              <div className="flex items-center gap-2 mt-1 flex-wrap">
                <p className="text-xs text-zinc-400">
                  {article.authorName} · 更新: {fmt(article.updatedAt)}
                </p>
                {article.tags.length > 0 && (
                  <div className="flex gap-1">
                    {article.tags.map((t) => (
                      <span
                        key={t.id}
                        className="px-2 py-0.5 text-[10px] rounded-full text-white font-medium"
                        style={{ backgroundColor: t.color }}
                      >
                        {t.name}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>

          {canEdit && <div className="flex items-center gap-2 flex-shrink-0">
            <Link
              href={`/dashboard/wiki/${article.id}/edit`}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-zinc-600 bg-zinc-100 hover:bg-zinc-200 rounded-lg transition-colors"
            >
              <Pencil className="w-3.5 h-3.5" />
              編集
            </Link>
            <WikiDeleteButton action={deleteAction} />
          </div>}
        </div>
      </div>

      {/* 記事本文 */}
      <div className="bg-white rounded-xl border border-zinc-200 px-6 py-6">
        <WikiArticleContent body={article.body} />
      </div>
    </div>
  );
}
