import { RecruitSearchPanel } from "@/components/leads/recruit-search-panel";
import { Briefcase, ArrowRight } from "lucide-react";

export const metadata = {
  title: "採用リード獲得AI | Ad-Arch Group OS",
};

export default function RecruitLeadSearchPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-lg font-bold text-zinc-900">採用リード獲得AI</h1>
        <p className="text-sm text-zinc-500 mt-0.5">
          採用活動中の企業を検索し、採用動画・採用SNS・採用ブランディングの提案機会をAIで分析します
        </p>
      </div>

      {/* 使い方ガイド */}
      <div className="bg-gradient-to-r from-amber-50 to-orange-50 rounded-xl border border-amber-100 px-5 py-4">
        <p className="text-xs font-semibold text-amber-700 mb-2">使い方</p>
        <div className="flex flex-wrap items-center gap-2 text-xs text-amber-600">
          <span className="inline-flex items-center gap-1 px-2 py-1 bg-white rounded-md border border-amber-100 font-medium">
            <Briefcase className="w-3 h-3" />
            1. エリア・業種を指定して検索
          </span>
          <ArrowRight className="w-3 h-3 text-amber-300" />
          <span className="inline-flex items-center gap-1 px-2 py-1 bg-white rounded-md border border-amber-100 font-medium">
            2. 採用ページを深堀り分析（中途/新卒判定）
          </span>
          <ArrowRight className="w-3 h-3 text-amber-300" />
          <span className="inline-flex items-center gap-1 px-2 py-1 bg-white rounded-md border border-amber-100 font-medium">
            3. AIが採用マーケティング観点でスコアリング
          </span>
          <ArrowRight className="w-3 h-3 text-amber-300" />
          <span className="inline-flex items-center gap-1 px-2 py-1 bg-white rounded-md border border-amber-100 font-medium">
            4. リード管理に保存
          </span>
        </div>
      </div>

      {/* スコアリング基準 */}
      <div className="bg-white rounded-xl border border-zinc-200 px-5 py-4">
        <p className="text-xs font-semibold text-zinc-700 mb-3">AIスコアリング基準（合計100点）</p>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          <div className="flex gap-2">
            <div className="w-1 rounded-full bg-amber-500 flex-shrink-0" />
            <div>
              <p className="text-xs font-medium text-zinc-800">採用活動度（20点）</p>
              <p className="text-[11px] text-zinc-500">求人数・急募シグナル・採用ページの充実度</p>
            </div>
          </div>
          <div className="flex gap-2">
            <div className="w-1 rounded-full bg-blue-500 flex-shrink-0" />
            <div>
              <p className="text-xs font-medium text-zinc-800">採用手法の旧さ（20点）</p>
              <p className="text-[11px] text-zinc-500">テキストのみ・動画なし = 提案余地大で高得点</p>
            </div>
          </div>
          <div className="flex gap-2">
            <div className="w-1 rounded-full bg-red-500 flex-shrink-0" />
            <div>
              <p className="text-xs font-medium text-zinc-800">採用動画チャンス（20点）</p>
              <p className="text-[11px] text-zinc-500">採用動画なし・YouTube未活用 = 最高得点</p>
            </div>
          </div>
          <div className="flex gap-2">
            <div className="w-1 rounded-full bg-pink-500 flex-shrink-0" />
            <div>
              <p className="text-xs font-medium text-zinc-800">採用SNSチャンス（15点）</p>
              <p className="text-[11px] text-zinc-500">採用SNS未活用 = TikTok/Instagram提案で高得点</p>
            </div>
          </div>
          <div className="flex gap-2">
            <div className="w-1 rounded-full bg-emerald-500 flex-shrink-0" />
            <div>
              <p className="text-xs font-medium text-zinc-800">企業規模・予算感（15点）</p>
              <p className="text-[11px] text-zinc-500">レビュー数・複数職種・大量募集から推定</p>
            </div>
          </div>
          <div className="flex gap-2">
            <div className="w-1 rounded-full bg-zinc-400 flex-shrink-0" />
            <div>
              <p className="text-xs font-medium text-zinc-800">接触しやすさ（10点）</p>
              <p className="text-[11px] text-zinc-500">電話番号・採用担当窓口の有無</p>
            </div>
          </div>
        </div>
      </div>

      <div>
        <RecruitSearchPanel />
      </div>
    </div>
  );
}
