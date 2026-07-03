"use client";

import { useState } from "react";
import { Search, LayoutGrid } from "lucide-react";
import { FranchiseSearchPanel } from "./franchise-search-panel";
import { FranchisePipeline } from "./franchise-pipeline";

type TabKey = "search" | "pipeline";

export function FranchiseLeadTabs({ isAdmin = false }: { isAdmin?: boolean }) {
  const [activeTab, setActiveTab] = useState<TabKey>("search");

  return (
    <div className="space-y-4">
      {/* タブヘッダー */}
      <div className="flex gap-1 bg-zinc-100 rounded-lg p-1 w-fit">
        <button
          onClick={() => setActiveTab("search")}
          className={`flex items-center gap-1.5 px-4 py-2 rounded-md text-sm font-medium transition-colors ${
            activeTab === "search"
              ? "bg-white text-zinc-900 shadow-sm"
              : "text-zinc-500 hover:text-zinc-700"
          }`}
        >
          <Search className="w-3.5 h-3.5" />
          Search
        </button>
        <button
          onClick={() => setActiveTab("pipeline")}
          className={`flex items-center gap-1.5 px-4 py-2 rounded-md text-sm font-medium transition-colors ${
            activeTab === "pipeline"
              ? "bg-white text-zinc-900 shadow-sm"
              : "text-zinc-500 hover:text-zinc-700"
          }`}
        >
          <LayoutGrid className="w-3.5 h-3.5" />
          Pipeline
        </button>
      </div>

      {/* タブコンテンツ */}
      {activeTab === "search" && <FranchiseSearchPanel />}
      {activeTab === "pipeline" && <FranchisePipeline isAdmin={isAdmin} />}
    </div>
  );
}
