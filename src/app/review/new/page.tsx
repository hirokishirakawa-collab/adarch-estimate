import Link from "next/link";
import { redirect } from "next/navigation";
import { getSessionInfo } from "@/lib/session";
import { ArrowLeft } from "lucide-react";
import { UploadForm } from "@/components/review/upload-form";

export default async function NewReviewPage() {
  const info = await getSessionInfo();
  if (!info) redirect("/login");

  return (
    <div className="max-w-2xl mx-auto px-6 py-8">
      <Link
        href="/review"
        className="inline-flex items-center gap-1.5 text-sm text-zinc-500 hover:text-zinc-300 transition-colors mb-6"
      >
        <ArrowLeft className="w-4 h-4" />
        一覧に戻る
      </Link>

      <h1 className="text-2xl font-bold text-white tracking-tight mb-1">新規チェック</h1>
      <p className="text-sm text-zinc-500 mb-8">
        修正前後の動画をアップロードしてください
      </p>

      <div className="rounded-2xl bg-zinc-900/60 border border-zinc-800/60 p-6">
        <UploadForm />
      </div>
    </div>
  );
}
