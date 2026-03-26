import Link from "next/link";
import { redirect } from "next/navigation";
import { getSessionInfo } from "@/lib/session";
import { ArrowLeft } from "lucide-react";
import { UploadForm } from "@/components/review/upload-form";

export default async function NewReviewPage() {
  const info = await getSessionInfo();
  if (!info) redirect("/login");

  return (
    <div className="min-h-screen -m-4 md:-m-6 p-4 md:p-6 bg-black">
      <div className="max-w-2xl mx-auto space-y-6">
        <div>
          <Link
            href="/dashboard/review"
            className="inline-flex items-center gap-1.5 text-sm text-zinc-500 hover:text-zinc-300 transition-colors mb-4"
          >
            <ArrowLeft className="w-4 h-4" />
            一覧に戻る
          </Link>
          <h1 className="text-xl font-bold text-white">新規チェック</h1>
          <p className="text-sm text-zinc-500 mt-0.5">
            修正前後の動画をアップロードしてください
          </p>
        </div>

        <div className="rounded-2xl bg-zinc-900 border border-zinc-800 p-6">
          <UploadForm />
        </div>
      </div>
    </div>
  );
}
