"use client";

import { useState } from "react";
import { Crosshair, Building2, Clapperboard, Briefcase } from "lucide-react";
import { LeadSearchPanel } from "./lead-search-panel";
import { BtoBSearchPanel } from "./btob-search-panel";
import { RecruitSearchPanel } from "./recruit-search-panel";
import type { SearchSuggestion } from "@/lib/actions/lead";

// Cinema は動的 import（シネアド用はページ固有のため遅延読み込み）
import dynamic from "next/dynamic";
const CinemaSearchPanel = dynamic(
  () => import("./cinema-search-panel").then((m) => m.CinemaSearchPanel),
  { ssr: false, loading: () => <div className="text-center py-12 text-sm text-zinc-400">シネアドパネルを読み込み中...</div> },
);

const TABS = [
  { key: "btoc", label: "BtoC リード", icon: Crosshair, color: "blue" },
  { key: "btob", label: "BtoB リード", icon: Building2, color: "indigo" },
  { key: "cinema", label: "シネアド", icon: Clapperboard, color: "purple" },
  { key: "recruit", label: "採用リード", icon: Briefcase, color: "amber" },
] as const;

type TabKey = (typeof TABS)[number]["key"];

const TAB_COLORS: Record<string, { active: string; inactive: string }> = {
  blue:   { active: "bg-blue-600 text-white border-blue-600", inactive: "text-blue-600 border-blue-200 hover:border-blue-400" },
  indigo: { active: "bg-indigo-600 text-white border-indigo-600", inactive: "text-indigo-600 border-indigo-200 hover:border-indigo-400" },
  purple: { active: "bg-purple-600 text-white border-purple-600", inactive: "text-purple-600 border-purple-200 hover:border-purple-400" },
  amber:  { active: "bg-amber-600 text-white border-amber-600", inactive: "text-amber-600 border-amber-200 hover:border-amber-400" },
};

interface LeadTabsProps {
  suggestions?: SearchSuggestion[];
}

export function LeadTabs({ suggestions = [] }: LeadTabsProps) {
  const [activeTab, setActiveTab] = useState<TabKey>("btoc");

  return (
    <div className="space-y-5">
      {/* タブ切り替え */}
      <div className="flex flex-wrap gap-2">
        {TABS.map((tab) => {
          const isActive = activeTab === tab.key;
          const colors = TAB_COLORS[tab.color];
          const Icon = tab.icon;
          return (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-xs font-medium border transition-all ${
                isActive ? colors.active : `bg-white ${colors.inactive}`
              }`}
            >
              <Icon className="w-3.5 h-3.5" />
              {tab.label}
            </button>
          );
        })}
      </div>

      {/* パネル */}
      <div data-tour="lead-search-panel">
        {activeTab === "btoc" && <LeadSearchPanel suggestions={suggestions} />}
        {activeTab === "btob" && <BtoBSearchPanel />}
        {activeTab === "cinema" && <CinemaSearchPanel />}
        {activeTab === "recruit" && <RecruitSearchPanel />}
      </div>
    </div>
  );
}
