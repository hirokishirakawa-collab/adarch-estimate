import Link from "next/link";
import { redirect } from "next/navigation";
import { getSessionInfo } from "@/lib/session";
import { ArrowLeft } from "lucide-react";
import { UploadForm } from "@/components/review/upload-form";

export default async function NewReviewPage() {
  const info = await getSessionInfo();
  if (!info) redirect("/login");

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div>
        <Link
          href="/dashboard/review"
          className="inline-flex items-center gap-1.5 text-sm text-white/40 hover:text-white/70 transition-colors mb-4"
        >
          <ArrowLeft className="w-4 h-4" />
          一覧に戻る
        </Link>
        <h1 className="text-xl font-bold text-white/90">新規チェック</h1>
        <p className="text-sm text-white/40 mt-0.5">
          修正前後の動画をアップロードしてください
        </p>
      </div>

      <div className="rounded-xl bg-white/[0.02] border border-white/5 p-6">
        <UploadForm />
      </div>
    </div>
  );
}
