"use client";

import { useMemo, useState, useTransition } from "react";
import { CheckSquare, Square, Loader2, Plus, X, CheckCircle2 } from "lucide-react";
import { TvcmHistoryCard, type TvcmHistoryLead } from "./tvcm-history-card";
import { bulkTransitionTvcmLeads } from "@/lib/actions/lead";

interface Props {
  leads: TvcmHistoryLead[];
}

export function TvcmHistoryList({ leads }: Props) {
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [isPending, startTransition] = useTransition();
  const [resultMsg, setResultMsg] = useState<string | null>(null);

  // 一括選択対象は CRAWLED のみ（既にプール中/却下済みは一括対象外）
  const selectableIds = useMemo(
    () => leads.filter((l) => l.status === "CRAWLED").map((l) => l.id),
    [leads],
  );

  const allSelected =
    selectableIds.length > 0 && selectableIds.every((id) => selectedIds.has(id));

  const toggleOne = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleAll = () => {
    if (allSelected) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(selectableIds));
    }
  };

  const handleBulk = (decision: "pool" | "reject") => {
    const ids = Array.from(selectedIds);
    if (ids.length === 0) return;
    const verb = decision === "pool" ? "プール投入" : "却下";
    if (
      !confirm(
        decision === "pool"
          ? `選択した ${ids.length}件 を一括でプールに投入します。Google Chatに都道府県内訳付きで通知されます。よろしいですか？`
          : `選択した ${ids.length}件 を一括で却下します。よろしいですか？`,
      )
    )
      return;

    startTransition(async () => {
      const res = await bulkTransitionTvcmLeads(ids, decision);
      if (res.success) {
        setResultMsg(`${verb}しました（${res.updated}件）`);
        setSelectedIds(new Set());
      } else {
        setResultMsg(res.error ?? `${verb}に失敗しました`);
      }
    });
  };

  const selectedCount = selectedIds.size;

  return (
    <>
      {/* 一括操作バー（CRAWLED が1件でもあれば常時表示） */}
      {selectableIds.length > 0 && (
        <div className="sticky top-2 z-20 bg-white rounded-xl border-2 border-blue-200 p-3 flex items-center gap-2 flex-wrap shadow-sm">
          <button
            type="button"
            onClick={toggleAll}
            className="inline-flex items-center gap-1.5 text-xs font-medium text-zinc-700 hover:text-blue-700"
          >
            {allSelected ? (
              <CheckSquare className="w-4 h-4 text-blue-600" />
            ) : (
              <Square className="w-4 h-4 text-zinc-400" />
            )}
            未判定 {selectableIds.length}件 を全選択
          </button>
          <span className="text-xs text-zinc-400">|</span>
          <span className="text-xs text-zinc-600">
            選択中: <strong className="text-blue-700">{selectedCount}件</strong>
          </span>

          <div className="ml-auto flex items-center gap-2">
            <button
              type="button"
              onClick={() => handleBulk("pool")}
              disabled={isPending || selectedCount === 0}
              className="inline-flex items-center gap-1 text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed px-3 py-1.5 rounded-lg"
            >
              {isPending ? (
                <Loader2 className="w-3 h-3 animate-spin" />
              ) : (
                <Plus className="w-3 h-3" />
              )}
              一括プール投入（チャット通知）
            </button>
            <button
              type="button"
              onClick={() => handleBulk("reject")}
              disabled={isPending || selectedCount === 0}
              className="inline-flex items-center gap-1 text-xs font-medium text-zinc-600 bg-white border border-zinc-300 hover:bg-zinc-50 disabled:opacity-50 disabled:cursor-not-allowed px-3 py-1.5 rounded-lg"
            >
              <X className="w-3 h-3" />
              一括却下
            </button>
            {selectedCount > 0 && (
              <button
                type="button"
                onClick={() => setSelectedIds(new Set())}
                className="text-[11px] text-zinc-500 hover:text-zinc-700"
              >
                選択解除
              </button>
            )}
          </div>

          {resultMsg && (
            <div className="basis-full text-[11px] flex items-center gap-1 text-emerald-700 mt-1">
              <CheckCircle2 className="w-3 h-3" />
              {resultMsg}
            </div>
          )}
        </div>
      )}

      <div className="space-y-2">
        {leads.map((lead) => (
          <TvcmHistoryCard
            key={lead.id}
            lead={lead}
            selectable={lead.status === "CRAWLED"}
            selected={selectedIds.has(lead.id)}
            onToggleSelect={() => toggleOne(lead.id)}
          />
        ))}
      </div>
    </>
  );
}
