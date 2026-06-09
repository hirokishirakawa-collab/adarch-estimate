"use client";

import { useState, useMemo, useTransition } from "react";
import { toast } from "sonner";
import { EstimateTable, type EstimationRow, type SortKey, type SortDir } from "./estimate-table";
import { deleteEstimations } from "@/lib/actions/estimate";
import { ESTIMATION_STATUS_OPTIONS } from "@/lib/constants/estimates";
import { Search, ChevronLeft, ChevronRight, Trash2, X } from "lucide-react";

interface Props {
  estimations: EstimationRow[];
  projects: { id: string; title: string }[];
  isAdmin: boolean;
}

const PAGE_SIZE = 30;

function rowAmount(e: EstimationRow): number {
  return e.items.reduce((s, it) => s + it.amount, 0);
}

export function EstimateListWithFilters({ estimations, projects, isAdmin }: Props) {
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [projectFilter, setProjectFilter] = useState("");
  const [page, setPage] = useState(1);
  const [sortKey, setSortKey] = useState<SortKey>("estimateDate");
  const [sortDir, setSortDir] = useState<SortDir>("desc");
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [isPending, startTransition] = useTransition();

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
      result = result.filter((e) => (e as { projectId?: string }).projectId === projectFilter);
    }

    return result;
  }, [estimations, search, statusFilter, projectFilter]);

  const sorted = useMemo(() => {
    const arr = [...filtered];
    const dir = sortDir === "asc" ? 1 : -1;
    arr.sort((a, b) => {
      let cmp = 0;
      switch (sortKey) {
        case "title":
          cmp = a.title.localeCompare(b.title, "ja");
          break;
        case "status":
          cmp = a.status.localeCompare(b.status);
          break;
        case "amount":
          cmp = rowAmount(a) - rowAmount(b);
          break;
        case "estimateDate":
          cmp = new Date(a.estimateDate).getTime() - new Date(b.estimateDate).getTime();
          break;
      }
      return cmp * dir;
    });
    return arr;
  }, [filtered, sortKey, sortDir]);

  const totalPages = Math.max(1, Math.ceil(sorted.length / PAGE_SIZE));
  const safePage = Math.min(page, totalPages);
  const paged = sorted.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);

  const allSelected = paged.length > 0 && paged.every((e) => selectedIds.has(e.id));
  const someSelected = paged.some((e) => selectedIds.has(e.id)) && !allSelected;

  // Reset page when filters change
  const handleSearch = (v: string) => { setSearch(v); setPage(1); };
  const handleStatus = (v: string) => { setStatusFilter(v); setPage(1); };
  const handleProject = (v: string) => { setProjectFilter(v); setPage(1); };

  const handleSort = (key: SortKey) => {
    if (key === sortKey) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(key);
      setSortDir(key === "title" || key === "status" ? "asc" : "desc");
    }
    setPage(1);
  };

  const toggle = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleAll = () => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (allSelected) paged.forEach((e) => next.delete(e.id));
      else paged.forEach((e) => next.add(e.id));
      return next;
    });
  };

  const clearSelection = () => {
    setSelectedIds(new Set());
    setConfirmDelete(false);
  };

  const handleDelete = () => {
    const ids = Array.from(selectedIds);
    if (!ids.length) return;
    startTransition(async () => {
      const result = await deleteEstimations(ids);
      if (result.error) {
        toast.error(result.error);
      } else {
        toast.success(`${result.deleted}件の見積書を削除しました`);
        clearSelection();
      }
    });
  };

  return (
    <div className="space-y-3">
      {/* 一括操作ツールバー（ADMINのみ） */}
      {isAdmin && selectedIds.size > 0 && (
        <div className="flex items-center justify-between gap-3 px-4 py-2.5 bg-blue-50 border border-blue-200 rounded-lg">
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium text-blue-900">{selectedIds.size}件選択中</span>
            <button
              onClick={clearSelection}
              className="inline-flex items-center gap-1 text-xs text-blue-600 hover:text-blue-800"
            >
              <X className="w-3 h-3" /> 選択解除
            </button>
          </div>
          {confirmDelete ? (
            <div className="flex items-center gap-2">
              <span className="text-xs text-red-700">本当に削除しますか？</span>
              <button
                onClick={handleDelete}
                disabled={isPending}
                className="px-3 py-1.5 text-xs font-semibold text-white bg-red-600 rounded-lg hover:bg-red-700 disabled:opacity-50"
              >
                {isPending ? "削除中..." : `${selectedIds.size}件を削除`}
              </button>
              <button
                onClick={() => setConfirmDelete(false)}
                disabled={isPending}
                className="px-3 py-1.5 text-xs font-medium text-zinc-600 border border-zinc-200 rounded-lg hover:bg-white"
              >
                キャンセル
              </button>
            </div>
          ) : (
            <button
              onClick={() => setConfirmDelete(true)}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-red-600 border border-red-200 rounded-lg hover:bg-red-50"
            >
              <Trash2 className="w-3.5 h-3.5" /> 削除
            </button>
          )}
        </div>
      )}

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
          {sorted.length}件
        </span>
      </div>

      {/* テーブル */}
      <div className="bg-white rounded-xl border border-zinc-200 overflow-hidden">
        <EstimateTable
          estimations={paged}
          isAdmin={isAdmin}
          selectedIds={selectedIds}
          onToggle={toggle}
          onToggleAll={toggleAll}
          allSelected={allSelected}
          someSelected={someSelected}
          sortKey={sortKey}
          sortDir={sortDir}
          onSort={handleSort}
        />
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
