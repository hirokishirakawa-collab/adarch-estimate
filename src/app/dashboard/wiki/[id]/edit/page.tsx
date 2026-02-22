import { notFound } from "next/navigation";
import Link from "next/link";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { getMockBranchId } from "@/lib/data/customers";
import { WikiArticleForm } from "@/components/wiki/wiki-article-form";
import { updateArticle } from "@/lib/actions/wiki";
import { BookOpen, ChevronLeft } from "lucide-react";
import type { UserRole } from "@/types/roles";

interface PageProps {
  params: Promise<{ id: string }>;
}

export default async function EditWikiPage({ params }: PageProps) {
  const { id } = await params;

  const session = await auth();
  const role = (session?.user?.role ?? "MANAGER") as UserRole;
  const email = session?.user?.email ?? "";
  const userBranchId = getMockBranchId(email, role);

  const where =
    role === "ADMIN" || !userBranchId ? { id } : { id, branchId: userBranchId };

  const article = await db.wikiArticle.findFirst({ where });
  if (!article) notFound();

  const boundAction = updateArticle.bind(null, article.id);

  return (
    <div className="px-6 py-6 max-w-3xl mx-auto w-full">
      <Link
        href={`/dashboard/wiki/${article.id}`}
        className="inline-flex items-center gap-1 text-xs text-zinc-500 hover:text-zinc-800 transition-colors mb-4"
      >
        <ChevronLeft className="w-3.5 h-3.5" />
        記事に戻る
      </Link>

      <div className="flex items-center gap-3 mb-6">
        <div className="w-9 h-9 bg-teal-50 rounded-xl flex items-center justify-center">
          <BookOpen className="text-teal-600" style={{ width: "1.125rem", height: "1.125rem" }} />
        </div>
        <div>
          <h2 className="text-lg font-bold text-zinc-900">記事を編集</h2>
          <p className="text-xs text-zinc-500 mt-0.5 truncate max-w-xs">{article.title}</p>
        </div>
      </div>

      <div className="bg-white rounded-xl border border-zinc-200 p-6">
        <WikiArticleForm
          action={boundAction}
          defaultTitle={article.title}
          defaultBody={article.body}
          submitLabel="更新する"
        />
      </div>
    </div>
  );
}
