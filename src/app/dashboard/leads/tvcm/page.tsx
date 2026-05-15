import { Film, ArrowRight } from "lucide-react";
import { TvcmSearchPanel } from "@/components/leads/tvcm-search-panel";
import Link from "next/link";
import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";

export default async function TvcmLeadsPage() {
  const session = await auth();
  if (!session?.user?.email) redirect("/");

  const user = await db.user.findUnique({
    where: { email: session.user.email },
    select: { role: true },
  });
  // 配布モデル: 代表（ADMIN）のみがクロール → 全パートナー向けプールに配信
  if (user?.role !== "ADMIN") redirect("/dashboard/leads/tvcm-pool");

  return (
    <div className="px-6 py-6 space-y-5 max-w-screen-2xl mx-auto w-full">
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 bg-rose-50 rounded-xl flex items-center justify-center">
            <Film className="w-4 h-4 text-rose-600" />
          </div>
          <div>
            <h2 className="text-lg font-bold text-zinc-900">
              TVer広告 案件クロール（本部）
            </h2>
            <p className="text-xs text-zinc-500">
              YouTube / PR TIMES から動画コンテンツ発表企業を抽出し、TVer広告案件プールへ投入
            </p>
          </div>
        </div>
        <Link
          href="/dashboard/leads/list"
          className="text-xs text-blue-600 hover:underline flex items-center gap-1"
        >
          リード管理へ <ArrowRight className="w-3 h-3" />
        </Link>
      </div>

      {/* 使い方 */}
      <div className="bg-white rounded-xl border border-zinc-200 px-5 py-4">
        <p className="text-xs font-semibold text-zinc-700 mb-3">使い方</p>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 text-[11px]">
          <div>
            <p className="text-xs font-medium text-zinc-800">1. キーワード選択</p>
            <p className="text-zinc-500 mt-0.5">
              採用動画・ブランドムービー等のキーワードを選択
            </p>
          </div>
          <div>
            <p className="text-xs font-medium text-zinc-800">2. 自動クロール+AI抽出</p>
            <p className="text-zinc-500 mt-0.5">
              PR TIMES を巡回し、企業情報・動画URLを構造化抽出
            </p>
          </div>
          <div>
            <p className="text-xs font-medium text-zinc-800">3. 自動フィルタ</p>
            <p className="text-zinc-500 mt-0.5">
              大手代理店・上場企業・東京本社を自動除外
            </p>
          </div>
          <div>
            <p className="text-xs font-medium text-zinc-800">4. プール投入</p>
            <p className="text-zinc-500 mt-0.5">
              本部の判断で「プールへ」「却下」を選別、全パートナーへ配信
            </p>
          </div>
        </div>
      </div>

      <TvcmSearchPanel />
    </div>
  );
}
