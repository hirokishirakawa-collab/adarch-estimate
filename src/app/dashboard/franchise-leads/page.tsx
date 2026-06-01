import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { Users, Search, LayoutGrid } from "lucide-react";
import { FranchiseLeadTabs } from "@/components/franchise-leads/franchise-lead-tabs";
import type { UserRole } from "@/types/roles";
import { FRANCHISE_LEADS_FEATURE } from "@/lib/franchise-leads/access";

export default async function FranchiseLeadsPage() {
  const session = await auth();
  if (!session?.user) {
    redirect("/login");
  }

  // ADMIN（本部）または enabledFeatures に franchise-leads を持つ開拓パートナーのみ
  const role = (session.user.role ?? "USER") as UserRole;
  const features = session.user.enabledFeatures ?? [];
  if (role !== "ADMIN" && !features.includes(FRANCHISE_LEADS_FEATURE)) {
    redirect("/dashboard");
  }

  return (
    <div className="px-6 py-6 space-y-5 max-w-screen-2xl mx-auto w-full">
      {/* ヘッダー */}
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 bg-emerald-50 rounded-xl flex items-center justify-center">
            <Users className="w-4 h-4 text-emerald-600" />
          </div>
          <div>
            <h2 className="text-lg font-bold text-zinc-900">加盟リード獲得AI</h2>
            <p className="text-xs text-zinc-500">
              エリア・業種から加盟候補を自動検索し、AIがスコアリング
            </p>
          </div>
        </div>
      </div>

      {/* 利用方法 */}
      <div className="bg-white rounded-xl border border-zinc-200 px-5 py-4">
        <p className="text-xs font-semibold text-zinc-700 mb-3">使い方</p>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="flex gap-3">
            <div className="w-7 h-7 rounded-lg bg-emerald-50 flex items-center justify-center flex-shrink-0">
              <Search className="w-3.5 h-3.5 text-emerald-600" />
            </div>
            <div>
              <p className="text-xs font-medium text-zinc-800">1. 候補検索</p>
              <p className="text-[11px] text-zinc-500 mt-0.5">
                都道府県と業種を選んで検索。A優先地域（パートナー未進出）を先に攻めましょう。
              </p>
            </div>
          </div>
          <div className="flex gap-3">
            <div className="w-7 h-7 rounded-lg bg-purple-50 flex items-center justify-center flex-shrink-0">
              <Users className="w-3.5 h-3.5 text-purple-600" />
            </div>
            <div>
              <p className="text-xs font-medium text-zinc-800">2. AIスコアリング</p>
              <p className="text-[11px] text-zinc-500 mt-0.5">
                AIが加盟適性を自動分析。地域ポテンシャル・営業力・事業規模・デジタル力・相性をスコアリング。
              </p>
            </div>
          </div>
          <div className="flex gap-3">
            <div className="w-7 h-7 rounded-lg bg-amber-50 flex items-center justify-center flex-shrink-0">
              <LayoutGrid className="w-3.5 h-3.5 text-amber-600" />
            </div>
            <div>
              <p className="text-xs font-medium text-zinc-800">3. パイプライン管理</p>
              <p className="text-[11px] text-zinc-500 mt-0.5">
                保存した候補をパイプラインで進捗管理。ステータス・メモ・次回アクションを記録。
              </p>
            </div>
          </div>
          <div className="flex gap-3">
            <div className="w-7 h-7 rounded-lg bg-teal-50 flex items-center justify-center flex-shrink-0">
              <Users className="w-3.5 h-3.5 text-teal-600" />
            </div>
            <div>
              <p className="text-xs font-medium text-zinc-800">4. AIアドバイス</p>
              <p className="text-[11px] text-zinc-500 mt-0.5">
                各候補への営業アプローチをAIが提案。DMテンプレート・電話トーク例・訴求ポイントを自動生成。
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* タブ */}
      <FranchiseLeadTabs />
    </div>
  );
}
