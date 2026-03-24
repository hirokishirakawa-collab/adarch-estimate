"use client";

import { useState, useMemo } from "react";
import { getPriorityLabel, PRIORITY_LABELS, BTOB_SCORE_ITEMS } from "@/lib/constants/leads";
import type { ScoredBtoBLead, BtoBLeadScore, WebsiteAnalysis, YouTubeChannelInfo } from "@/lib/constants/leads";
import { ChevronDown, ChevronUp, ArrowUpDown, Filter, EyeOff, Eye, Plus, Check, Loader2, ExternalLink, Youtube } from "lucide-react";
import { Button } from "@/components/ui/button";
import { getLeadStatusOption } from "@/lib/constants/leads";

type SortKey = "score" | "name" | "capital" | "employee";

interface BtoBResultsTableProps {
  leads: ScoredBtoBLead[];
  savedNames: Set<string>;
  savingName: string | null;
  onSaveLead: (name: string) => void;
  existingMap?: Record<string, string>;
}

function formatCapital(capital?: number): string {
  if (capital == null) return "不明";
  return `${(capital / 10000).toLocaleString()}万円`;
}

function formatEmployee(count?: number): string {
  if (count == null) return "不明";
  return `${count}名`;
}

export function BtoBResultsTable({
  leads,
  savedNames,
  savingName,
  onSaveLead,
  existingMap = {},
}: BtoBResultsTableProps) {
  const [sortKey, setSortKey] = useState<SortKey>("score");
  const [filterPriority, setFilterPriority] = useState<string | null>(null);
  const [expandedIdx, setExpandedIdx] = useState<number | null>(null);
  const [hideExisting, setHideExisting] = useState(true);

  const getExistingStatus = (lead: ScoredBtoBLead) =>
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
    list.sort((a, b) => {
      switch (sortKey) {
        case "score":
          return b.score.total - a.score.total;
        case "name":
          return a.name.localeCompare(b.name, "ja");
        case "capital":
          return (b.capital ?? 0) - (a.capital ?? 0);
        case "employee":
          return (b.employeeCount ?? 0) - (a.employeeCount ?? 0);
        default:
          return 0;
      }
    });
    return list;
  }, [leads, sortKey, filterPriority, hideExisting, existingMap]);

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
        <div className="flex gap-1.5 ml-auto flex-wrap">
          {existingCount > 0 && (
            <Button
              size="xs"
              variant={hideExisting ? "default" : "outline"}
              onClick={() => setHideExisting(!hideExisting)}
              className="gap-1"
            >
              {hideExisting ? (
                <EyeOff className="w-3 h-3" />
              ) : (
                <Eye className="w-3 h-3" />
              )}
              登録済み{existingCount}件{hideExisting ? "を除外中" : "を表示中"}
            </Button>
          )}
          <span className="w-px bg-zinc-200" />
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
                企業名
              </th>
              <th className="text-left px-4 py-2.5 text-xs font-medium text-zinc-500 hidden lg:table-cell">
                住所
              </th>
              <th className="text-right px-4 py-2.5 text-xs font-medium text-zinc-500 hidden sm:table-cell w-28">
                資本金
              </th>
              <th className="text-right px-4 py-2.5 text-xs font-medium text-zinc-500 hidden sm:table-cell w-24">
                従業員数
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
              const existingStatus = getExistingStatus(lead);
              const statusOption = existingStatus
                ? getLeadStatusOption(existingStatus)
                : null;
              return (
                <tr key={`${lead.name}-${i}`} className="group">
                  <td colSpan={7} className="p-0">
                    <div
                      className={`grid grid-cols-[2rem_1fr_5rem_5rem] sm:grid-cols-[2rem_1fr_1fr_7rem_6rem_5rem_5rem] items-center cursor-pointer hover:bg-zinc-50 transition-colors ${existingStatus ? "opacity-60" : ""}`}
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
                        <p className="font-medium text-zinc-900 truncate flex items-center gap-1.5">
                          {lead.name}
                          {statusOption && (
                            <span className={`inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium border ${statusOption.className}`}>
                              {statusOption.icon} {statusOption.label}
                            </span>
                          )}
                        </p>
                      </div>
                      <div className="px-4 py-3 hidden lg:block">
                        <p className="text-zinc-500 truncate text-xs">
                          {lead.address}
                        </p>
                      </div>
                      <div className="px-4 py-3 text-right hidden sm:block">
                        <span className="text-xs text-zinc-600">
                          {formatCapital(lead.capital)}
                        </span>
                      </div>
                      <div className="px-4 py-3 text-right hidden sm:block">
                        <span className="text-xs text-zinc-600">
                          {formatEmployee(lead.employeeCount)}
                        </span>
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
                      <BtoBDetailPanel
                        lead={lead}
                        isSaved={savedNames.has(lead.name)}
                        isSaving={savingName === lead.name}
                        onSave={() => onSaveLead(lead.name)}
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

// ---------------------------------------------------------------
// BtoB Detail Panel (inline)
// ---------------------------------------------------------------
function BtoBDetailPanel({
  lead,
  isSaved,
  isSaving,
  onSave,
}: {
  lead: ScoredBtoBLead;
  isSaved: boolean;
  isSaving: boolean;
  onSave: () => void;
}) {
  const priority = getPriorityLabel(lead.score.total);

  return (
    <div className="bg-zinc-50 border-t border-zinc-200 px-5 py-4 space-y-4">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {/* 基本情報 */}
        <div className="space-y-2">
          <p className="text-xs font-medium text-zinc-500 uppercase tracking-wide">
            企業情報
          </p>
          <div className="space-y-1.5 text-sm text-zinc-700">
            <p>
              <span className="text-xs text-zinc-400 mr-2">住所</span>
              {lead.address || "不明"}
            </p>
            <p>
              <span className="text-xs text-zinc-400 mr-2">法人番号</span>
              {lead.corporateNumber || "不明"}
            </p>
            <p>
              <span className="text-xs text-zinc-400 mr-2">代表者</span>
              {lead.representativeName || "不明"}
            </p>
            <p>
              <span className="text-xs text-zinc-400 mr-2">資本金</span>
              {formatCapital(lead.capital)}
            </p>
            <p>
              <span className="text-xs text-zinc-400 mr-2">従業員数</span>
              {formatEmployee(lead.employeeCount)}
            </p>
          </div>
          {lead.websiteUrl && (
            <a
              href={lead.websiteUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 text-sm text-blue-600 hover:underline"
            >
              <ExternalLink className="w-3.5 h-3.5" />
              Webサイトを開く
            </a>
          )}
        </div>

        {/* スコア内訳 */}
        <div className="space-y-2">
          <p className="text-xs font-medium text-zinc-500 uppercase tracking-wide">
            スコア内訳
          </p>
          {BTOB_SCORE_ITEMS.map((item) => {
            const val = lead.score.breakdown[item.key] ?? 0;
            const pct = (val / item.max) * 100;
            return (
              <div key={item.key} className="flex items-center gap-2">
                <span className="text-xs text-zinc-600 w-32 flex-shrink-0">
                  {item.label}
                </span>
                <div className="flex-1 h-2 bg-zinc-200 rounded-full overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all ${
                      item.key === "youtubeOpportunity"
                        ? "bg-red-500"
                        : item.key === "digitalPresence"
                          ? "bg-amber-500"
                          : "bg-blue-500"
                    }`}
                    style={{ width: `${pct}%` }}
                  />
                </div>
                <span className="text-xs text-zinc-500 w-12 text-right">
                  {val}/{item.max}
                </span>
              </div>
            );
          })}
        </div>
      </div>

      {/* YouTube チャンネル情報 */}
      {lead.youtubeChannel && (
        <div className="bg-red-50 rounded-lg border border-red-200 px-4 py-3">
          <p className="text-xs font-medium text-red-700 mb-2 flex items-center gap-1.5">
            <Youtube className="w-3.5 h-3.5" />
            YouTubeチャンネル
          </p>
          <div className="flex flex-wrap gap-4 text-sm text-red-800">
            <span>登録者: {lead.youtubeChannel.subscribers.toLocaleString()}人</span>
            <span>動画数: {lead.youtubeChannel.videoCount}本</span>
            {lead.youtubeChannel.lastUpload && (
              <span>最終投稿: {lead.youtubeChannel.lastUpload}</span>
            )}
          </div>
          <a
            href={lead.youtubeChannel.url}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 text-xs text-red-600 hover:underline mt-1.5"
          >
            <ExternalLink className="w-3 h-3" />
            チャンネルを開く
          </a>
        </div>
      )}

      {/* Webサイト分析 */}
      {lead.digitalAnalysis && (
        <div className="bg-white rounded-lg border border-zinc-200 px-4 py-3">
          <p className="text-xs font-medium text-zinc-500 mb-1">Webサイト分析</p>
          <p className="text-sm text-zinc-700">{lead.digitalAnalysis.summary}</p>
        </div>
      )}

      {/* 補助金リスト */}
      {lead.subsidies && lead.subsidies.length > 0 && (
        <div className="bg-emerald-50 rounded-lg border border-emerald-200 px-4 py-3">
          <p className="text-xs font-medium text-emerald-700 mb-2">
            補助金・助成金の採択歴
          </p>
          <ul className="space-y-1">
            {lead.subsidies.map((s, i) => (
              <li key={i} className="text-xs text-emerald-800 flex items-start gap-1.5">
                <Check className="w-3 h-3 mt-0.5 flex-shrink-0" />
                {s}
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* AIコメント */}
      <div className="bg-white rounded-lg border border-zinc-200 px-4 py-3">
        <p className="text-xs font-medium text-zinc-500 mb-1">AIコメント</p>
        <p className="text-sm text-zinc-700">{lead.score.comment}</p>
      </div>

      {/* アクション */}
      <div className="flex items-center gap-3">
        <span
          className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium border ${priority.className}`}
        >
          {priority.emoji} {priority.label}（{lead.score.total}点）
        </span>
        <Button
          size="sm"
          variant={isSaved ? "outline" : "default"}
          onClick={onSave}
          disabled={isSaved || isSaving}
        >
          {isSaving ? (
            <Loader2 className="w-3.5 h-3.5 animate-spin" />
          ) : isSaved ? (
            <Check className="w-3.5 h-3.5" />
          ) : (
            <Plus className="w-3.5 h-3.5" />
          )}
          {isSaving ? "保存中..." : isSaved ? "保存済み" : "営業リストへ保存"}
        </Button>
      </div>
    </div>
  );
}
