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

      <BtoBSearchPanel />
    </div>
  );
}
