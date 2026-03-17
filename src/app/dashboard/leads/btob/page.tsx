import { BtoBSearchPanel } from "@/components/leads/btob-search-panel";
import { Building2, ArrowRight } from "lucide-react";

export const metadata = {
  title: "BtoBリード獲得AI | Ad-Arch Group OS",
};

export default function BtoBLeadSearchPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-lg font-bold text-zinc-900">BtoBリード獲得AI</h1>
        <p className="text-sm text-zinc-500 mt-0.5">
          経産省の企業データベース（gBizINFO）から、広告予算がありそうなBtoB企業を検索・スコアリングします
        </p>
      </div>

      {/* 使い方ガイド */}
      <div className="bg-gradient-to-r from-indigo-50 to-blue-50 rounded-xl border border-indigo-100 px-5 py-4">
        <p className="text-xs font-semibold text-indigo-700 mb-2">使い方</p>
        <div className="flex flex-wrap items-center gap-2 text-xs text-indigo-600">
          <span className="inline-flex items-center gap-1 px-2 py-1 bg-white rounded-md border border-indigo-100 font-medium">
            <Building2 className="w-3 h-3" />
            1. 条件を指定して検索
          </span>
          <ArrowRight className="w-3 h-3 text-indigo-300" />
          <span className="inline-flex items-center gap-1 px-2 py-1 bg-white rounded-md border border-indigo-100 font-medium">
            2. YouTube・Webを自動分析
          </span>
          <ArrowRight className="w-3 h-3 text-indigo-300" />
          <span className="inline-flex items-center gap-1 px-2 py-1 bg-white rounded-md border border-indigo-100 font-medium">
            3. AIがBtoB営業スコアリング
          </span>
          <ArrowRight className="w-3 h-3 text-indigo-300" />
          <span className="inline-flex items-center gap-1 px-2 py-1 bg-white rounded-md border border-indigo-100 font-medium">
            4. リード管理に保存
          </span>
        </div>
      </div>

      {/* スコアリング基準 */}
      <div className="bg-white rounded-xl border border-zinc-200 px-5 py-4">
        <p className="text-xs font-semibold text-zinc-700 mb-3">AIスコアリング基準（合計100点）</p>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          <div className="flex gap-2">
            <div className="w-1 rounded-full bg-blue-500 flex-shrink-0" />
            <div>
              <p className="text-xs font-medium text-zinc-800">業種適合度（20点）</p>
              <p className="text-[11px] text-zinc-500">動画制作・広告が活きる業種か</p>
            </div>
          </div>
          <div className="flex gap-2">
            <div className="w-1 rounded-full bg-emerald-500 flex-shrink-0" />
            <div>
              <p className="text-xs font-medium text-zinc-800">企業規模（20点）</p>
              <p className="text-[11px] text-zinc-500">資本金・従業員数から広告予算を推定</p>
            </div>
          </div>
          <div className="flex gap-2">
            <div className="w-1 rounded-full bg-violet-500 flex-shrink-0" />
            <div>
              <p className="text-xs font-medium text-zinc-800">デジタル活用度（20点）</p>
              <p className="text-[11px] text-zinc-500">動画・SNS未活用 = 提案チャンス大で高得点</p>
            </div>
          </div>
          <div className="flex gap-2">
            <div className="w-1 rounded-full bg-red-500 flex-shrink-0" />
            <div>
              <p className="text-xs font-medium text-zinc-800">YouTube活用余地（20点）</p>
              <p className="text-[11px] text-zinc-500">チャンネル未開設・更新停止 = 最高得点</p>
            </div>
          </div>
          <div className="flex gap-2">
            <div className="w-1 rounded-full bg-amber-500 flex-shrink-0" />
            <div>
              <p className="text-xs font-medium text-zinc-800">成長性（10点）</p>
              <p className="text-[11px] text-zinc-500">補助金受給・採用ページあり = 成長投資中</p>
            </div>
          </div>
          <div className="flex gap-2">
            <div className="w-1 rounded-full bg-zinc-400 flex-shrink-0" />
            <div>
              <p className="text-xs font-medium text-zinc-800">接触しやすさ（10点）</p>
              <p className="text-[11px] text-zinc-500">代表者名・Webサイトの有無</p>
            </div>
          </div>
        </div>
      </div>

      <BtoBSearchPanel />
    </div>
  );
}
