import { Target } from "lucide-react";
import { LeadSearchPanel } from "@/components/leads/lead-search-panel";

export default function LeadsPage() {
  return (
    <div className="px-6 py-6 space-y-5 max-w-screen-2xl mx-auto w-full">
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

      <LeadSearchPanel />
    </div>
  );
}
