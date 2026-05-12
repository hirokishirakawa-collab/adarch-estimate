"use client";

import { useState, useMemo } from "react";
import { getPriorityLabel, PRIORITY_LABELS } from "@/lib/constants/leads";
import {
  RADIUS_BAND_COLORS,
  CINEMA_SCORE_ITEMS,
} from "@/lib/constants/cinema-leads";
import type { ScoredCinemaLead, CinemaScoreKey } from "@/lib/constants/cinema-leads";
import { ChevronDown, ChevronUp, ArrowUpDown, Filter, MapPin, Plus, Check, Loader2, Sparkles, MessageSquareQuote, Building2, MapPinned, EyeOff, Eye } from "lucide-react";
import { Button } from "@/components/ui/button";
import { getLeadStatusOption } from "@/lib/constants/leads";

type SortKey = "score" | "distance" | "name";

interface CinemaResultsTableProps {
  leads: ScoredCinemaLead[];
  savedNames: Set<string>;
  savingName: string | null;
  onSaveLead: (name: string) => void;
  existingMap?: Record<string, string>;
}

export function CinemaResultsTable({
  leads,
  savedNames,
  savingName,
  onSaveLead,
  existingMap = {},
}: CinemaResultsTableProps) {
  const [sortKey, setSortKey] = useState<SortKey>("score");
  const [filterBand, setFilterBand] = useState<number | null>(null);
  const [filterPriority, setFilterPriority] = useState<string | null>(null);
  const [expandedIdx, setExpandedIdx] = useState<number | null>(null);
  const [hideExisting, setHideExisting] = useState(true);

  const getExistingStatus = (lead: ScoredCinemaLead) =>
    existingMap[`${lead.name}|${lead.address ?? ""}`] ?? null;

  const existingCount = useMemo(
    () => leads.filter((l) => getExistingStatus(l)).length,
    [leads, existingMap]
  );

  const filtered = useMemo(() => {
    let list = [...leads];
    if (hideExisting) {
      list = list.filter((l) => !getExistingStatus(l));
    }
    if (filterBand !== null) {
      list = list.filter((l) => l.radiusBand === filterBand);
    }
    if (filterPriority) {
      const pDef = PRIORITY_LABELS.find((p) => p.key === filterPriority);
      if (pDef) {
        const nextMin = PRIORITY_LABELS[PRIORITY_LABELS.indexOf(pDef) - 1]?.min ?? 101;
        list = list.filter((l) => l.score.total >= pDef.min && l.score.total < nextMin);
      }
    }
    list.sort((a, b) => {
      if (sortKey === "score") return b.score.total - a.score.total;
      if (sortKey === "distance") return a.distanceKm - b.distanceKm;
      return a.name.localeCompare(b.name, "ja");
    });
    return list;
  }, [leads, sortKey, filterBand, filterPriority, hideExisting, existingMap]);

  // 距離帯ごとの件数
  const bandCounts = useMemo(() => {
    const c: Record<number, number> = {};
    for (const l of leads) {
      c[l.radiusBand] = (c[l.radiusBand] ?? 0) + 1;
    }
    return c;
  }, [leads]);

  const priorityCounts = useMemo(() => {
    const c = { high: 0, normal: 0, low: 0 };
    leads.forEach((l) => {
      const p = getPriorityLabel(l.score.total);
      c[p.key as keyof typeof c]++;
    });
    return c;
  }, [leads]);

  return (
    <div className="space-y-3">
      {/* サマリー */}
      <div className="flex flex-wrap items-center gap-3">
        <p className="text-sm text-zinc-600">
          {leads.length}件取得 —{" "}
          <span className="text-red-600">🔴 {priorityCounts.high}</span> /{" "}
          <span className="text-yellow-600">🟡 {priorityCounts.normal}</span> /{" "}
          <span className="text-zinc-500">⚪ {priorityCounts.low}</span>
        </p>
      </div>

      {/* コントロール */}
      <div className="flex flex-wrap gap-1.5">
        {existingCount > 0 && (
          <>
            <Button
              size="xs"
              variant={hideExisting ? "default" : "outline"}
              onClick={() => setHideExisting(!hideExisting)}
              className="gap-1"
            >
              {hideExisting ? <EyeOff className="w-3 h-3" /> : <Eye className="w-3 h-3" />}
              登録済み{existingCount}件{hideExisting ? "を除外中" : "を表示中"}
            </Button>
            <span className="w-px bg-zinc-200" />
          </>
        )}
        {/* 距離帯フィルタ */}
        <Button
          size="xs"
          variant={filterBand === null ? "default" : "outline"}
          onClick={() => setFilterBand(null)}
        >
          <MapPin className="w-3 h-3" />
          全距離
        </Button>
        {Object.entries(bandCounts)
          .sort(([a], [b]) => Number(a) - Number(b))
          .map(([band, count]) => {
            const b = Number(band);
            const colors = RADIUS_BAND_COLORS[b];
            return (
              <Button
                key={band}
                size="xs"
                variant={filterBand === b ? "default" : "outline"}
                onClick={() => setFilterBand(filterBand === b ? null : b)}
              >
                <span className={filterBand === b ? "" : colors?.text}>{b}km圏</span>
                <span className="text-[10px] opacity-70">({count})</span>
              </Button>
            );
          })}

        <span className="w-px bg-zinc-200" />

        {/* ソート */}
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
          variant={sortKey === "distance" ? "default" : "outline"}
          onClick={() => setSortKey("distance")}
        >
          <ArrowUpDown className="w-3 h-3" />
          距離順
        </Button>

        <span className="w-px bg-zinc-200" />

        {/* 優先度フィルタ */}
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
            onClick={() => setFilterPriority(filterPriority === p.key ? null : p.key)}
          >
            {p.emoji}
          </Button>
        ))}
      </div>

      {/* テーブル */}
      <div className="bg-white rounded-xl border border-zinc-200 overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-zinc-100 bg-zinc-50">
              <th className="text-left px-3 py-2.5 text-xs font-medium text-zinc-500 w-8" />
              <th className="text-left px-3 py-2.5 text-xs font-medium text-zinc-500 w-16">距離</th>
              <th className="text-left px-3 py-2.5 text-xs font-medium text-zinc-500">会社名</th>
              <th className="text-left px-3 py-2.5 text-xs font-medium text-zinc-500 hidden md:table-cell">住所</th>
              <th className="text-center px-3 py-2.5 text-xs font-medium text-zinc-500 w-16">スコア</th>
              <th className="text-center px-3 py-2.5 text-xs font-medium text-zinc-500 w-16">優先度</th>
              <th className="text-center px-3 py-2.5 text-xs font-medium text-zinc-500 w-10" />
            </tr>
          </thead>
          <tbody>
            {filtered.map((lead, i) => {
              const priority = getPriorityLabel(lead.score.total);
              const bandColor = RADIUS_BAND_COLORS[lead.radiusBand];
              const isExpanded = expandedIdx === i;
              const existing = getExistingStatus(lead);
              const statusOption = existing ? getLeadStatusOption(existing) : null;
              const isSaved = savedNames.has(lead.name);
              const isSavingThis = savingName === lead.name;

              return (
                <tr key={`${lead.name}-${i}`} className="group">
                  <td colSpan={7} className="p-0">
                    <div
                      className={`grid grid-cols-[2rem_4rem_1fr_5rem_5rem_2.5rem] md:grid-cols-[2rem_4rem_1fr_1fr_5rem_5rem_2.5rem] items-center cursor-pointer transition-colors ${existing ? "bg-amber-50/60 opacity-60 hover:bg-amber-50" : "hover:bg-zinc-50"}`}
                      onClick={() => setExpandedIdx(isExpanded ? null : i)}
                    >
                      <div className="px-3 py-2.5">
                        {isExpanded ? (
                          <ChevronUp className="w-3.5 h-3.5 text-zinc-400" />
                        ) : (
                          <ChevronDown className="w-3.5 h-3.5 text-zinc-400" />
                        )}
                      </div>
                      <div className="px-2 py-2.5">
                        <span className={`inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium border ${bandColor?.bg} ${bandColor?.border} ${bandColor?.text}`}>
                          {lead.distanceKm}km
                        </span>
                      </div>
                      <div className="px-3 py-2.5">
                        <p className="font-medium text-zinc-900 truncate text-xs flex items-center gap-1">
                          {lead.name}
                          {lead.isFutureOpening && (
                            <span className="inline-flex items-center px-1 py-0.5 rounded text-[9px] font-medium bg-green-50 text-green-700 border border-green-200">
                              🆕 開業予定
                            </span>
                          )}
                          {statusOption && (
                            <span className={`inline-flex items-center px-1.5 py-0.5 rounded text-[9px] font-medium border ${statusOption.className}`}>
                              {statusOption.icon} {statusOption.label}
                            </span>
                          )}
                        </p>
                        {lead.googleMapsTypeLabel && (
                          <p className="text-[10px] text-zinc-400 truncate mt-0.5">{lead.googleMapsTypeLabel}</p>
                        )}
                      </div>
                      <div className="px-3 py-2.5 hidden md:block">
                        <p className="text-zinc-500 truncate text-[11px]">{lead.address}</p>
                      </div>
                      <div className="px-3 py-2.5 text-center">
                        <span className="font-bold text-zinc-900 text-xs">{lead.score.total}</span>
                      </div>
                      <div className="px-3 py-2.5 text-center">
                        <span className={`inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[10px] font-medium border ${priority.className}`}>
                          {priority.emoji} {priority.label}
                        </span>
                      </div>
                      <div className="px-2 py-2.5 text-center">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            if (!existing && !isSaved && !isSavingThis) onSaveLead(lead.name);
                          }}
                          disabled={!!existing || isSaved || isSavingThis}
                          className={`w-6 h-6 rounded-md flex items-center justify-center transition-colors ${
                            existing
                              ? "bg-zinc-100 text-zinc-400 cursor-not-allowed"
                              : isSaved
                              ? "bg-emerald-600 text-white"
                              : isSavingThis
                              ? "bg-blue-100 text-blue-500"
                              : "bg-zinc-100 text-zinc-500 hover:bg-blue-100 hover:text-blue-600"
                          }`}
                        >
                          {isSavingThis ? <Loader2 className="w-3 h-3 animate-spin" /> : isSaved ? <Check className="w-3 h-3" /> : <Plus className="w-3 h-3" />}
                        </button>
                      </div>
                    </div>
                    {/* 展開時の詳細 */}
                    {isExpanded && (
                      <div className="px-4 py-3 bg-zinc-50 border-t border-zinc-100">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          {/* スコア内訳 */}
                          <div>
                            <p className="text-xs font-semibold text-zinc-700 mb-2">スコア内訳</p>
                            <div className="space-y-1.5">
                              {CINEMA_SCORE_ITEMS.map((item) => {
                                const val = (lead.score.breakdown as Record<string, number>)?.[item.key] ?? 0;
                                const pct = (val / item.max) * 100;
                                return (
                                  <div key={item.key} className="flex items-center gap-2">
                                    <span className="text-[11px] text-zinc-500 w-20 flex-shrink-0">{item.label}</span>
                                    <div className="flex-1 h-1.5 bg-zinc-200 rounded-full overflow-hidden">
                                      <div
                                        className="h-full bg-blue-500 rounded-full"
                                        style={{ width: `${pct}%` }}
                                      />
                                    </div>
                                    <span className="text-[11px] text-zinc-600 w-12 text-right">{val}/{item.max}</span>
                                  </div>
                                );
                              })}
                            </div>
                          </div>
                          {/* コメント + 基本情報 */}
                          <div className="space-y-3">
                            <div>
                              <p className="text-xs font-semibold text-zinc-700 mb-1">AIコメント</p>
                              <p className="text-xs text-zinc-600 leading-relaxed">{lead.score.comment}</p>
                            </div>

                            {/* Google AIインサイト */}
                            {(lead.reviewSummary || lead.placeSummary || lead.neighborhoodSummary || lead.isFutureOpening) && (
                              <div className="bg-gradient-to-br from-blue-50 to-indigo-50 rounded-lg border border-blue-200 px-3 py-2.5">
                                <p className="text-[11px] font-medium text-blue-700 mb-2 flex items-center gap-1">
                                  <Sparkles className="w-3 h-3" />
                                  Google AIインサイト
                                </p>
                                <div className="space-y-1.5">
                                  {lead.isFutureOpening && (
                                    <p className="text-[11px] text-green-700 font-medium">🆕 近日開業予定 — 開業告知としてのシネアド提案が有効</p>
                                  )}
                                  {lead.reviewSummary && (
                                    <div className="flex items-start gap-1.5">
                                      <MessageSquareQuote className="w-3 h-3 text-blue-500 mt-0.5 flex-shrink-0" />
                                      <p className="text-[11px] text-zinc-700 leading-relaxed">{lead.reviewSummary}</p>
                                    </div>
                                  )}
                                  {lead.placeSummary && (
                                    <div className="flex items-start gap-1.5">
                                      <Building2 className="w-3 h-3 text-blue-500 mt-0.5 flex-shrink-0" />
                                      <p className="text-[11px] text-zinc-700 leading-relaxed">{lead.placeSummary}</p>
                                    </div>
                                  )}
                                  {lead.neighborhoodSummary && (
                                    <div className="flex items-start gap-1.5">
                                      <MapPinned className="w-3 h-3 text-blue-500 mt-0.5 flex-shrink-0" />
                                      <p className="text-[11px] text-zinc-700 leading-relaxed">{lead.neighborhoodSummary}</p>
                                    </div>
                                  )}
                                </div>
                              </div>
                            )}

                            <div className="grid grid-cols-2 gap-2 text-[11px]">
                              <div>
                                <span className="text-zinc-400">評価:</span>{" "}
                                <span className="text-zinc-700">{lead.rating} ({lead.ratingCount}件)</span>
                              </div>
                              <div>
                                <span className="text-zinc-400">電話:</span>{" "}
                                <span className="text-zinc-700">{lead.phone || "なし"}</span>
                              </div>
                              {lead.websiteUrl && (
                                <div className="col-span-2">
                                  <span className="text-zinc-400">Web:</span>{" "}
                                  <a href={lead.websiteUrl} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline truncate">
                                    {lead.websiteUrl}
                                  </a>
                                </div>
                              )}
                              {lead.digitalAnalysis && (
                                <div className="col-span-2">
                                  <span className="text-zinc-400">分析:</span>{" "}
                                  <span className="text-zinc-700">{lead.digitalAnalysis.summary}</span>
                                </div>
                              )}
                              {lead.mapsUrl && (
                                <div className="col-span-2">
                                  <a href={lead.mapsUrl} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline text-[11px]">
                                    Google Maps で開く →
                                  </a>
                                </div>
                              )}
                            </div>
                          </div>
                        </div>
                      </div>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        {filtered.length === 0 && (
          <p className="text-center text-sm text-zinc-400 py-8">該当する企業がありません</p>
        )}
      </div>
    </div>
  );
}
