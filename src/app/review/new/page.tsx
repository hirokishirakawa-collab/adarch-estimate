import Link from "next/link";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { getSessionInfo, getBranchFilter } from "@/lib/session";
import { ArrowLeft } from "lucide-react";
import { UploadForm } from "@/components/review/upload-form";

export default async function NewReviewPage() {
  const info = await getSessionInfo();
  if (!info) redirect("/login");

  const branchFilter = getBranchFilter(info);

  // ユーザーが所属する拠点のプロジェクト一覧を取得
  const projects = await db.project.findMany({
    where: {
      ...branchFilter,
      status: { in: ["IN_PROGRESS", "ORDERED", "COMPLETED"] },
    },
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      title: true,
      customer: { select: { name: true } },
    },
    take: 100,
  });

  if (projects.length === 0) {
    return (
      <div className="max-w-2xl mx-auto px-6 py-8">
        <Link
          href="/review"
          className="inline-flex items-center gap-1.5 text-sm text-zinc-500 hover:text-zinc-300 transition-colors mb-6"
        >
          <ArrowLeft className="w-4 h-4" />
          一覧に戻る
        </Link>

        <div className="flex flex-col items-center justify-center py-20 text-center">
          <p className="text-zinc-400 text-lg font-medium mb-2">
            進行中のプロジェクトがありません
          </p>
          <p className="text-zinc-600 text-sm mb-6">
            映像チェッカーを使うには、まず顧客登録とプロジェクト作成が必要です
          </p>
          <Link
            href="/dashboard/projects"
            className="px-5 py-2.5 rounded-xl bg-white text-black font-semibold text-sm hover:bg-zinc-200 transition-colors"
          >
            プロジェクトを作成
          </Link>
        </div>
      </div>
    );
  }

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
        プロジェクトを選択し、修正前後の動画をアップロードしてください
      </p>

      <div className="rounded-2xl bg-zinc-900/60 border border-zinc-800/60 p-6">
        <UploadForm
          projects={projects.map((p) => ({
            id: p.id,
            title: p.title,
            customerName: p.customer?.name ?? null,
          }))}
        />
      </div>
    </div>
  );
}
