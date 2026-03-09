"use client";

import { useState, useMemo } from "react";
import { getPriorityLabel, PRIORITY_LABELS } from "@/lib/constants/leads";
import type { ScoredLead } from "@/lib/constants/leads";
import { LeadDetailPanel } from "./lead-detail-panel";
import { ChevronDown, ChevronUp, ArrowUpDown, Filter } from "lucide-react";
import { Button } from "@/components/ui/button";

type SortKey = "score" | "name";

interface LeadResultsTableProps {
  leads: ScoredLead[];
  addedNames: Set<string>;
  onToggleAdd: (name: string) => void;
}

export function LeadResultsTable({
  leads,
  addedNames,
  onToggleAdd,
}: LeadResultsTableProps) {
  const [sortKey, setSortKey] = useState<SortKey>("score");
  const [filterPriority, setFilterPriority] = useState<string | null>(null);
  const [expandedIdx, setExpandedIdx] = useState<number | null>(null);

  const filtered = useMemo(() => {
    let list = [...leads];
    if (filterPriority) {
      const pDef = PRIORITY_LABELS.find((p) => p.key === filterPriority);
      if (pDef) {
        const nextMin =
          PRIORITY_LABELS[PRIORITY_LABELS.indexOf(pDef) - 1]?.min ?? 101;
        list = list.filter(
          (l) => l.score.total >= pDef.min && l.score.total < nextMin
        );
      }
    }
    list.sort((a, b) =>
      sortKey === "score"
        ? b.score.total - a.score.total
        : a.name.localeCompare(b.name, "ja")
    );
    return list;
  }, [leads, sortKey, filterPriority]);

  const counts = useMemo(() => {
    const c = { high: 0, normal: 0, low: 0 };
    leads.forEach((l) => {
      const p = getPriorityLabel(l.score.total);
      c[p.key as keyof typeof c]++;
    });
    return c;
  }, [leads]);

  return (
    <div className="space-y-3">
      {/* サマリー + コントロール */}
      <div className="flex flex-wrap items-center gap-3">
        <p className="text-sm text-zinc-600">
          {leads.length}件取得 —{" "}
          <span className="text-red-600">🔴 {counts.high}</span> /{" "}
          <span className="text-yellow-600">🟡 {counts.normal}</span> /{" "}
          <span className="text-zinc-500">⚪ {counts.low}</span>
        </p>
        <div className="flex gap-1.5 ml-auto">
          <Button
            size="xs"
            variant={sortKey === "score" ? "default" : "outline"}
            onClick={() => setSortKey("score")}
          >
            <ArrowUpDown className="w-3 h-3" />
            スコア順
          </Button>
          <Button
            size="xs"
            variant={sortKey === "name" ? "default" : "outline"}
            onClick={() => setSortKey("name")}
          >
            <ArrowUpDown className="w-3 h-3" />
            名前順
          </Button>
          <span className="w-px bg-zinc-200" />
          <Button
            size="xs"
            variant={filterPriority === null ? "default" : "outline"}
            onClick={() => setFilterPriority(null)}
          >
            <Filter className="w-3 h-3" />
            すべて
          </Button>
          {PRIORITY_LABELS.map((p) => (
            <Button
              key={p.key}
              size="xs"
              variant={filterPriority === p.key ? "default" : "outline"}
              onClick={() =>
                setFilterPriority(filterPriority === p.key ? null : p.key)
              }
            >
              {p.emoji}
            </Button>
          ))}
        </div>
      </div>

      {/* テーブル */}
      <div className="bg-white rounded-xl border border-zinc-200 overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-zinc-100 bg-zinc-50">
              <th className="text-left px-4 py-2.5 text-xs font-medium text-zinc-500 w-8" />
              <th className="text-left px-4 py-2.5 text-xs font-medium text-zinc-500">
                会社名
              </th>
              <th className="text-left px-4 py-2.5 text-xs font-medium text-zinc-500 hidden sm:table-cell">
                住所
              </th>
              <th className="text-center px-4 py-2.5 text-xs font-medium text-zinc-500 w-20">
                スコア
              </th>
              <th className="text-center px-4 py-2.5 text-xs font-medium text-zinc-500 w-20">
                優先度
              </th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((lead, i) => {
              const priority = getPriorityLabel(lead.score.total);
              const isExpanded = expandedIdx === i;
              return (
                <tr key={`${lead.name}-${i}`} className="group">
                  <td colSpan={5} className="p-0">
                    <div
                      className="grid grid-cols-[2rem_1fr_1fr_5rem_5rem] sm:grid-cols-[2rem_1fr_1fr_5rem_5rem] items-center cursor-pointer hover:bg-zinc-50 transition-colors"
                      onClick={() => setExpandedIdx(isExpanded ? null : i)}
                    >
                      <div className="px-4 py-3 flex items-center">
                        {isExpanded ? (
                          <ChevronUp className="w-4 h-4 text-zinc-400" />
                        ) : (
                          <ChevronDown className="w-4 h-4 text-zinc-400" />
                        )}
                      </div>
                      <div className="px-4 py-3">
                        <p className="font-medium text-zinc-900 truncate">
                          {lead.name}
                        </p>
                      </div>
                      <div className="px-4 py-3 hidden sm:block">
                        <p className="text-zinc-500 truncate text-xs">
                          {lead.address}
                        </p>
                      </div>
                      <div className="px-4 py-3 text-center">
                        <span className="font-bold text-zinc-900">
                          {lead.score.total}
                        </span>
                      </div>
                      <div className="px-4 py-3 text-center">
                        <span
                          className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[11px] font-medium border ${priority.className}`}
                        >
                          {priority.emoji} {priority.label}
                        </span>
                      </div>
                    </div>
                    {isExpanded && (
                      <LeadDetailPanel
                        lead={lead}
                        isAdded={addedNames.has(lead.name)}
                        onToggleAdd={() => onToggleAdd(lead.name)}
                      />
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        {filtered.length === 0 && (
          <p className="text-center text-sm text-zinc-400 py-8">
            該当する企業がありません
          </p>
        )}
      </div>
    </div>
  );
}
