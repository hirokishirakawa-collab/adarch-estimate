import { Film, ArrowRight } from "lucide-react";
import { TvcmSearchPanel } from "@/components/leads/tvcm-search-panel";
import Link from "next/link";

export default function TvcmLeadsPage() {
  return (
    <div className="px-6 py-6 space-y-5 max-w-screen-2xl mx-auto w-full">
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 bg-rose-50 rounded-xl flex items-center justify-center">
            <Film className="w-4 h-4 text-rose-600" />
          </div>
          <div>
            <h2 className="text-lg font-bold text-zinc-900">
              TVCM/動画PR 発表企業 リード獲得AI
            </h2>
            <p className="text-xs text-zinc-500">
              PR TIMES から直近の新CM・ブランドムービー発表企業を抽出し、TVer営業候補リストを自動生成
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
              新CM・ブランドムービー等のキーワードを選択
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
            <p className="text-xs font-medium text-zinc-800">4. リード化</p>
            <p className="text-zinc-500 mt-0.5">
              「TVerで流しませんか？」の営業候補として登録
            </p>
          </div>
        </div>
      </div>

      <TvcmSearchPanel />
    </div>
  );
}
