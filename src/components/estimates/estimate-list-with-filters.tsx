"use client";

import { useState, useMemo } from "react";
import { EstimateTable, type EstimationRow } from "./estimate-table";
import { ESTIMATION_STATUS_OPTIONS } from "@/lib/constants/estimates";
import { Search, Filter, ChevronLeft, ChevronRight } from "lucide-react";

interface Props {
  estimations: EstimationRow[];
  projects: { id: string; title: string }[];
}

const PAGE_SIZE = 30;

export function EstimateListWithFilters({ estimations, projects }: Props) {
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [projectFilter, setProjectFilter] = useState("");
  const [page, setPage] = useState(1);

  const filtered = useMemo(() => {
    let result = estimations;

    if (search) {
      const q = search.toLowerCase();
      result = result.filter(
        (e) =>
          e.title.toLowerCase().includes(q) ||
          e.customer?.name.toLowerCase().includes(q) ||
          e.staffName?.toLowerCase().includes(q)
      );
    }

    if (statusFilter) {
      result = result.filter((e) => e.status === statusFilter);
    }

    if (projectFilter) {
      result = result.filter((e) => (e as any).projectId === projectFilter);
    }

    return result;
  }, [estimations, search, statusFilter, projectFilter]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const safePage = Math.min(page, totalPages);
  const paged = filtered.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);

  // Reset page when filters change
  const handleSearch = (v: string) => { setSearch(v); setPage(1); };
  const handleStatus = (v: string) => { setStatusFilter(v); setPage(1); };
  const handleProject = (v: string) => { setProjectFilter(v); setPage(1); };

  return (
    <div className="space-y-3">
      {/* フィルターバー */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative flex-1 min-w-[200px] max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-zinc-400" />
          <input
            type="text"
            placeholder="タイトル・顧客名・担当者で検索..."
            value={search}
            onChange={(e) => handleSearch(e.target.value)}
            className="w-full pl-9 pr-3 py-2 text-sm border border-zinc-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400"
          />
        </div>

        <select
          value={statusFilter}
          onChange={(e) => handleStatus(e.target.value)}
          className="px-3 py-2 text-sm border border-zinc-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/20"
        >
          <option value="">全ステータス</option>
          {ESTIMATION_STATUS_OPTIONS.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.icon} {opt.label}
            </option>
          ))}
        </select>

        <select
          value={projectFilter}
          onChange={(e) => handleProject(e.target.value)}
          className="px-3 py-2 text-sm border border-zinc-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/20 max-w-xs truncate"
        >
          <option value="">全プロジェクト</option>
          {projects.map((p) => (
            <option key={p.id} value={p.id}>
              {p.title}
            </option>
          ))}
        </select>

        {(search || statusFilter || projectFilter) && (
          <button
            onClick={() => { setSearch(""); setStatusFilter(""); setProjectFilter(""); setPage(1); }}
            className="px-3 py-2 text-xs font-medium text-zinc-500 hover:text-zinc-800 border border-zinc-200 rounded-lg hover:bg-zinc-50 transition-colors"
          >
            クリア
          </button>
        )}

        <span className="text-xs text-zinc-400 ml-auto">
          {filtered.length}件
        </span>
      </div>

      {/* テーブル */}
      <div className="bg-white rounded-xl border border-zinc-200 overflow-hidden">
        <EstimateTable estimations={paged} />
      </div>

      {/* ページネーション */}
      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-2">
          <button
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            disabled={safePage <= 1}
            className="flex items-center gap-1 px-3 py-1.5 text-xs font-medium border border-zinc-200 rounded-lg hover:bg-zinc-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          >
            <ChevronLeft className="w-3.5 h-3.5" />
            前へ
          </button>
          <span className="text-xs text-zinc-500">
            {safePage} / {totalPages}
          </span>
          <button
            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            disabled={safePage >= totalPages}
            className="flex items-center gap-1 px-3 py-1.5 text-xs font-medium border border-zinc-200 rounded-lg hover:bg-zinc-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          >
            次へ
            <ChevronRight className="w-3.5 h-3.5" />
          </button>
        </div>
      )}
    </div>
  );
}
