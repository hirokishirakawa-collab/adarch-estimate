import { Target, Search, Sparkles, ListChecks, ArrowRight, Save, Film, HandMetal, Flame } from "lucide-react";
import { LeadTabs } from "@/components/leads/lead-tabs";
import Link from "next/link";
import { WikiHelpLink } from "@/components/wiki/wiki-help-link";
import { getSearchSuggestions } from "@/lib/actions/lead";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";

export default async function LeadsPage() {
  const suggestions = await getSearchSuggestions();
  // 本部抽出のTVer広告案件プール未claim件数（バナー表示用）
  const tverPoolCount = await db.lead.count({
    where: {
      source: "PR_TIMES_TVCM",
      assigneeId: null,
      status: "UNTOUCHED",
    },
  });

  return (
    <div className="px-6 py-6 space-y-5 max-w-screen-2xl mx-auto w-full">
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 bg-blue-50 rounded-xl flex items-center justify-center">
            <Target className="w-4 h-4 text-blue-600" />
          </div>
          <div>
            <h2 className="text-lg font-bold text-zinc-900">リード獲得AI</h2>
            <div className="flex items-center gap-2">
              <p className="text-xs text-zinc-500">
                エリア・業種を指定して営業候補リストを自動生成
              </p>
              <WikiHelpLink query="リード獲得AI" />
            </div>
          </div>
        </div>
        <Link
          href="/dashboard/leads/list"
          className="text-xs text-blue-600 hover:underline flex items-center gap-1"
        >
          リード管理へ <ArrowRight className="w-3 h-3" />
        </Link>
      </div>

      {/* TVer広告 案件プール バナー（本部配信、先着順claim） */}
      <Link
        href="/dashboard/leads/tvcm-pool"
        className="group relative block overflow-hidden rounded-xl border-2 border-rose-300 bg-gradient-to-r from-rose-50 via-pink-50 to-orange-50 px-6 py-5 hover:shadow-md transition-all"
      >
        <div className="absolute -right-4 -top-4 w-24 h-24 rounded-full bg-gradient-to-br from-rose-200/50 to-orange-200/50 blur-2xl" />
        <div className="relative flex items-center gap-5">
          <div className="w-14 h-14 bg-gradient-to-br from-rose-500 to-pink-600 rounded-xl flex items-center justify-center flex-shrink-0 shadow-md group-hover:scale-105 transition-transform">
            <Film className="w-7 h-7 text-white" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <p className="text-sm font-bold text-zinc-900">
                TVer広告 案件プール
              </p>
              <span className="inline-flex items-center gap-1 text-[10px] font-bold text-white bg-gradient-to-r from-rose-600 to-pink-600 px-2 py-0.5 rounded-full">
                <Flame className="w-2.5 h-2.5" />
                先着順
              </span>
              <span className="text-[10px] font-semibold text-rose-700 bg-white border border-rose-200 px-2 py-0.5 rounded-full">
                本部から配信
              </span>
            </div>
            <p className="text-xs text-zinc-600">
              本部が抽出した「採用動画・会社紹介ムービー・ブランディング動画」公開企業に、TVerでの動画放映を提案できる案件
            </p>
          </div>
          <div className="flex-shrink-0 flex items-center gap-3">
            {tverPoolCount > 0 ? (
              <div className="text-right">
                <div className="text-3xl font-black text-rose-600 leading-none">
                  {tverPoolCount}
                </div>
                <div className="text-[10px] text-rose-700 font-medium mt-0.5">
                  件 claim可能
                </div>
              </div>
            ) : (
              <div className="text-right">
                <div className="text-xs text-zinc-500">現在</div>
                <div className="text-sm font-bold text-zinc-700">0件</div>
              </div>
            )}
            <div className="inline-flex items-center gap-1 text-xs font-bold text-white bg-rose-600 hover:bg-rose-700 px-4 py-2 rounded-lg group-hover:translate-x-0.5 transition-transform">
              <HandMetal className="w-3.5 h-3.5" />
              プールへ
              <ArrowRight className="w-3.5 h-3.5" />
            </div>
          </div>
        </div>
      </Link>

      {/* 利用方法 */}
      <div data-tour="lead-guide" className="bg-white rounded-xl border border-zinc-200 px-5 py-4">
        <p className="text-xs font-semibold text-zinc-700 mb-3">使い方</p>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="flex gap-3">
            <div className="w-7 h-7 rounded-lg bg-blue-50 flex items-center justify-center flex-shrink-0">
              <Search className="w-3.5 h-3.5 text-blue-600" />
            </div>
            <div>
              <p className="text-xs font-medium text-zinc-800">1. 検索</p>
              <p className="text-[11px] text-zinc-500 mt-0.5">
                リード手法を選び、都道府県・業種を指定して検索。企業情報を自動取得します。
              </p>
            </div>
          </div>
          <div className="flex gap-3">
            <div className="w-7 h-7 rounded-lg bg-purple-50 flex items-center justify-center flex-shrink-0">
              <Sparkles className="w-3.5 h-3.5 text-purple-600" />
            </div>
            <div>
              <p className="text-xs font-medium text-zinc-800">2. AIスコアリング</p>
              <p className="text-[11px] text-zinc-500 mt-0.5">
                取得した企業をAIが自動で分析。各手法に特化した基準でスコアリングします。
              </p>
            </div>
          </div>
          <div className="flex gap-3">
            <div className="w-7 h-7 rounded-lg bg-amber-50 flex items-center justify-center flex-shrink-0">
              <Save className="w-3.5 h-3.5 text-amber-600" />
            </div>
            <div>
              <p className="text-xs font-medium text-zinc-800">3. 選択して保存</p>
              <p className="text-[11px] text-zinc-500 mt-0.5">
                結果一覧の<span className="font-bold text-zinc-700">「+」ボタン</span>で保存したい企業を選択し、リード管理に登録。
              </p>
            </div>
          </div>
          <div className="flex gap-3">
            <div className="w-7 h-7 rounded-lg bg-emerald-50 flex items-center justify-center flex-shrink-0">
              <ListChecks className="w-3.5 h-3.5 text-emerald-600" />
            </div>
            <div>
              <p className="text-xs font-medium text-zinc-800">4. リード管理で営業</p>
              <p className="text-[11px] text-zinc-500 mt-0.5">
                保存したリードはリード管理で確認。ステータス管理・AI営業提案・顧客への転換ができます。
              </p>
            </div>
          </div>
        </div>
      </div>

      <LeadTabs suggestions={suggestions} />
    </div>
  );
}
