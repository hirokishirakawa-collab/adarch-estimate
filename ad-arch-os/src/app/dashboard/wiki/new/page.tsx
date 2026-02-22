import Link from "next/link";
import { WikiArticleForm } from "@/components/wiki/wiki-article-form";
import { createArticle } from "@/lib/actions/wiki";
import { BookOpen, ChevronLeft } from "lucide-react";

export default function NewWikiPage() {
  return (
    <div className="px-6 py-6 max-w-3xl mx-auto w-full">
      <Link
        href="/dashboard/wiki"
        className="inline-flex items-center gap-1 text-xs text-zinc-500 hover:text-zinc-800 transition-colors mb-4"
      >
        <ChevronLeft className="w-3.5 h-3.5" />
        Wiki一覧に戻る
      </Link>

      <div className="flex items-center gap-3 mb-6">
        <div className="w-9 h-9 bg-teal-50 rounded-xl flex items-center justify-center">
          <BookOpen className="text-teal-600" style={{ width: "1.125rem", height: "1.125rem" }} />
        </div>
        <div>
          <h2 className="text-lg font-bold text-zinc-900">新規記事</h2>
          <p className="text-xs text-zinc-500 mt-0.5">Markdownで記事を作成できます</p>
        </div>
      </div>

      <div className="bg-white rounded-xl border border-zinc-200 p-6">
        <WikiArticleForm action={createArticle} submitLabel="記事を作成" />
      </div>
    </div>
  );
}
