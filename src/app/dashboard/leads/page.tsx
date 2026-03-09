import { Target, Search, Sparkles, ListChecks, ArrowRight, Save } from "lucide-react";
import { LeadSearchPanel } from "@/components/leads/lead-search-panel";
import Link from "next/link";

export default function LeadsPage() {
  return (
    <div className="px-6 py-6 space-y-5 max-w-screen-2xl mx-auto w-full">
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 bg-blue-50 rounded-xl flex items-center justify-center">
            <Target className="w-4 h-4 text-blue-600" />
          </div>
          <div>
            <h2 className="text-lg font-bold text-zinc-900">リード獲得AI</h2>
            <p className="text-xs text-zinc-500">
              エリア・業種を指定して営業候補リストを自動生成
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

      {/* 利用方法 */}
      <div className="bg-white rounded-xl border border-zinc-200 px-5 py-4">
        <p className="text-xs font-semibold text-zinc-700 mb-3">使い方</p>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="flex gap-3">
            <div className="w-7 h-7 rounded-lg bg-blue-50 flex items-center justify-center flex-shrink-0">
              <Search className="w-3.5 h-3.5 text-blue-600" />
            </div>
            <div>
              <p className="text-xs font-medium text-zinc-800">1. 検索</p>
              <p className="text-[11px] text-zinc-500 mt-0.5">
                都道府県・市区町村・業種を選んで検索。Google Maps上の企業情報を自動取得します。
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
                取得した企業をAIが自動で分析。業種適合度・活発度・規模感など5項目でスコアリングします。
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
                結果一覧の<span className="font-bold text-zinc-700">「+」ボタン</span>で保存したい企業を選択し、下の<span className="font-bold text-zinc-700">「選択した◯件を保存」</span>で登録。
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

      <LeadSearchPanel />
    </div>
  );
}
