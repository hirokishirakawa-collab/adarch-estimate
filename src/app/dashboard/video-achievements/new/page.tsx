import Link from "next/link";
import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { Target, ChevronLeft } from "lucide-react";
import { AchievementForm } from "@/components/video-achievements/achievement-form";

export default async function NewVideoAchievementPage() {
  const session = await auth();
  if (!session?.user) redirect("/login");

  return (
    <div className="px-6 py-6 max-w-screen-xl mx-auto w-full">
      <div className="mb-6">
        <Link
          href="/dashboard/video-achievements"
          className="inline-flex items-center gap-1 text-xs text-zinc-500 hover:text-zinc-700 transition-colors mb-4"
        >
          <ChevronLeft className="w-3.5 h-3.5" />
          動画実績DBに戻る
        </Link>

        <div className="flex items-center gap-3">
          <div className="w-9 h-9 bg-blue-50 rounded-xl flex items-center justify-center">
            <Target className="text-blue-600" style={{ width: "1.125rem", height: "1.125rem" }} />
          </div>
          <div>
            <h2 className="text-lg font-bold text-zinc-900">動画実績を手動登録</h2>
            <p className="text-xs text-zinc-500 mt-0.5">競合制作会社のクライアント実績を記録する</p>
          </div>
        </div>
      </div>

      <div className="max-w-lg bg-white rounded-xl border border-zinc-200 p-6 shadow-sm">
        <AchievementForm />
      </div>
    </div>
  );
}
