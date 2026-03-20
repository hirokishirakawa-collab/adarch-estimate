import { Clapperboard, ArrowRight } from "lucide-react";
import { CinemaSearchPanel } from "@/components/leads/cinema-search-panel";
import Link from "next/link";

export default function CinemaLeadsPage() {
  return (
    <div className="px-6 py-6 space-y-5 max-w-screen-2xl mx-auto w-full">
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 bg-purple-50 rounded-xl flex items-center justify-center">
            <Clapperboard className="w-4 h-4 text-purple-600" />
          </div>
          <div>
            <h2 className="text-lg font-bold text-zinc-900">
              イオンシネマ広告 リード獲得AI
            </h2>
            <p className="text-xs text-zinc-500">
              劇場周辺の対象企業をマップ付きで自動リスト化
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
      <div data-tour="cinema-guide" className="bg-white rounded-xl border border-zinc-200 px-5 py-4">
        <p className="text-xs font-semibold text-zinc-700 mb-3">使い方</p>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 text-[11px]">
          <div>
            <p className="text-xs font-medium text-zinc-800">1. 劇場選択</p>
            <p className="text-zinc-500 mt-0.5">
              イオンシネマの劇場をエリアから選択
            </p>
          </div>
          <div>
            <p className="text-xs font-medium text-zinc-800">2. 半径・業種設定</p>
            <p className="text-zinc-500 mt-0.5">
              3〜20km の検索半径と対象業種を選択
            </p>
          </div>
          <div>
            <p className="text-xs font-medium text-zinc-800">3. マップ＋スコア確認</p>
            <p className="text-zinc-500 mt-0.5">
              同心円マップとAIスコアで優先度を判断
            </p>
          </div>
          <div>
            <p className="text-xs font-medium text-zinc-800">4. 選択して保存</p>
            <p className="text-zinc-500 mt-0.5">
              有望企業を選択してリード管理に登録
            </p>
          </div>
        </div>
      </div>

      <div data-tour="cinema-search">
        <CinemaSearchPanel />
      </div>
    </div>
  );
}
