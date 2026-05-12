"use client";

import { useState, useMemo } from "react";
import { getPriorityLabel, PRIORITY_LABELS, RECRUIT_SCORE_ITEMS } from "@/lib/constants/leads";
import type { ScoredRecruitLead, RecruitmentAnalysis } from "@/lib/constants/leads";
import { getLeadStatusOption } from "@/lib/constants/leads";
import {
  ChevronDown, ChevronUp, ArrowUpDown, Filter, EyeOff, Eye,
  Plus, Check, Loader2, ExternalLink, Youtube, Briefcase, Users,
} from "lucide-react";
import { Button } from "@/components/ui/button";

type SortKey = "score" | "name";

interface RecruitResultsTableProps {
  leads: ScoredRecruitLead[];
  savedNames: Set<string>;
  savingName: string | null;
  onSaveLead: (name: string) => void;
  onSaveAll?: (names: string[]) => void;
  existingMap?: Record<string, string>;
}

const RECRUIT_TYPE_LABELS: Record<string, { label: string; className: string }> = {
  midcareer: { label: "中途採用", className: "bg-blue-100 text-blue-700 border-blue-200" },
  newgrad: { label: "新卒採用", className: "bg-purple-100 text-purple-700 border-purple-200" },
  both: { label: "中途+新卒", className: "bg-amber-100 text-amber-700 border-amber-200" },
  unknown: { label: "不明", className: "bg-zinc-100 text-zinc-500 border-zinc-200" },
};

export function RecruitResultsTable({
  leads,
  savedNames,
  savingName,
  onSaveLead,
  onSaveAll,
  existingMap = {},
}: RecruitResultsTableProps) {
  const [sortKey, setSortKey] = useState<SortKey>("score");
  const [filterPriority, setFilterPriority] = useState<string | null>(null);
  const [expandedIdx, setExpandedIdx] = useState<number | null>(null);
  const [hideExisting, setHideExisting] = useState(true);

  const getExistingStatus = (lead: ScoredRecruitLead) =>
    existingMap[`${lead.name}|${lead.address ?? ""}`] ?? null;

  const existingCount = useMemo(
    () => leads.filter((l) => getExistingStatus(l)).length,
    [leads, existingMap],
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
          (l) => l.score.total >= pDef.min && l.score.total < nextMin,
        );
      }
    }
    list.sort((a, b) =>
      sortKey === "score"
        ? b.score.total - a.score.total
        : a.name.localeCompare(b.name, "ja"),
    );
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

  const unsavedFiltered = useMemo(
    () => filtered.filter((l) => !savedNames.has(l.name) && !getExistingStatus(l)),
    [filtered, savedNames, existingMap]
  );

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
          {onSaveAll && unsavedFiltered.length > 0 && (
            <>
              <Button
                size="xs"
                variant="default"
                className="gap-1 bg-emerald-600 hover:bg-emerald-700"
                onClick={() => onSaveAll(unsavedFiltered.map((l) => l.name))}
                disabled={!!savingName}
              >
                <Plus className="w-3 h-3" />
                表示中{unsavedFiltered.length}件を一括保存
              </Button>
              <span className="w-px bg-zinc-200" />
            </>
          )}
          {existingCount > 0 && (
            <Button
              size="xs"
              variant={hideExisting ? "default" : "outline"}
              onClick={() => setHideExisting(!hideExisting)}
              className="gap-1"
            >
              {hideExisting ? <EyeOff className="w-3 h-3" /> : <Eye className="w-3 h-3" />}
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
      <div className="bg-white rounded-xl border border-zinc-200 overflow-x-auto">
        <table className="w-full text-sm min-w-[700px]">
          <thead>
            <tr className="border-b border-zinc-100 bg-zinc-50">
              <th className="text-left px-3 py-2.5 text-xs font-medium text-zinc-500 w-8" />
              <th className="text-left px-3 py-2.5 text-xs font-medium text-zinc-500">
                企業名
              </th>
              <th className="text-left px-3 py-2.5 text-xs font-medium text-zinc-500 w-48">
                リンク
              </th>
              <th className="text-center px-3 py-2.5 text-xs font-medium text-zinc-500 w-24">
                採用タイプ
              </th>
              <th className="text-center px-3 py-2.5 text-xs font-medium text-zinc-500 w-16">
                スコア
              </th>
              <th className="text-center px-3 py-2.5 text-xs font-medium text-zinc-500 w-20">
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
              const rtInfo = lead.recruitAnalysis?.recruitType
                ? RECRUIT_TYPE_LABELS[lead.recruitAnalysis.recruitType]
                : null;
              return (
                <tr key={`${lead.name}-${i}`} className="group">
                  <td colSpan={6} className="p-0">
                    <div
                      className={`grid grid-cols-[2rem_1fr_12rem_6rem_4rem_5rem] items-center cursor-pointer transition-colors ${existingStatus ? "bg-amber-50/60 opacity-60 hover:bg-amber-50" : "hover:bg-zinc-50"}`}
                      onClick={() => setExpandedIdx(isExpanded ? null : i)}
                    >
                      <div className="px-3 py-3 flex items-center">
                        {isExpanded ? (
                          <ChevronUp className="w-4 h-4 text-zinc-400" />
                        ) : (
                          <ChevronDown className="w-4 h-4 text-zinc-400" />
                        )}
                      </div>
                      <div className="px-3 py-3 min-w-0">
                        <p className="font-medium text-zinc-900 truncate flex items-center gap-1.5">
                          {lead.name}
                          {statusOption && (
                            <span className={`inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium border ${statusOption.className}`}>
                              {statusOption.icon} {statusOption.label}
                            </span>
                          )}
                        </p>
                        <p className="text-[11px] text-zinc-400 truncate mt-0.5">{lead.address}</p>
                      </div>
                      <div className="px-3 py-3 flex items-center gap-2 flex-wrap" onClick={(e) => e.stopPropagation()}>
                        {lead.websiteUrl && (
                          <a href={lead.websiteUrl} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-[11px] text-blue-600 hover:underline">
                            <ExternalLink className="w-3 h-3" />Web
                          </a>
                        )}
                        {lead.mapsUrl && (
                          <a href={lead.mapsUrl} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-[11px] text-blue-600 hover:underline">
                            <ExternalLink className="w-3 h-3" />Maps
                          </a>
                        )}
                        {lead.recruitAnalysis?.recruitPageUrl && (
                          <a href={lead.recruitAnalysis.recruitPageUrl} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-[11px] text-amber-600 hover:underline font-medium">
                            <Briefcase className="w-3 h-3" />採用
                          </a>
                        )}
                      </div>
                      <div className="px-3 py-3 text-center">
                        {rtInfo && rtInfo.label !== "不明" && (
                          <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-medium border ${rtInfo.className}`}>
                            {rtInfo.label}
                          </span>
                        )}
                      </div>
                      <div className="px-3 py-3 text-center">
                        <span className="font-bold text-zinc-900">
                          {lead.score.total}
                        </span>
                      </div>
                      <div className="px-3 py-3 text-center">
                        <span
                          className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[11px] font-medium border ${priority.className}`}
                        >
                          {priority.emoji} {priority.label}
                        </span>
                      </div>
                    </div>
                    {isExpanded && (
                      <RecruitDetailPanel
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
// 採用リード 詳細パネル
// ---------------------------------------------------------------
function RecruitDetailPanel({
  lead,
  isSaved,
  isSaving,
  onSave,
}: {
  lead: ScoredRecruitLead;
  isSaved: boolean;
  isSaving: boolean;
  onSave: () => void;
}) {
  const priority = getPriorityLabel(lead.score.total);
  const ra = lead.recruitAnalysis;

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
              <span className="text-xs text-zinc-400 mr-2">電話</span>
              {lead.phone || "不明"}
            </p>
            <p>
              <span className="text-xs text-zinc-400 mr-2">評価</span>
              {lead.rating > 0
                ? `${lead.rating} (${lead.ratingCount}件)`
                : "なし"}
            </p>
          </div>
          <div className="flex gap-2 flex-wrap">
            {lead.websiteUrl && (
              <a
                href={lead.websiteUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 text-sm text-blue-600 hover:underline"
              >
                <ExternalLink className="w-3.5 h-3.5" />
                Webサイト
              </a>
            )}
            {lead.mapsUrl && (
              <a
                href={lead.mapsUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 text-sm text-blue-600 hover:underline"
              >
                <ExternalLink className="w-3.5 h-3.5" />
                Google Maps
              </a>
            )}
            {ra?.recruitPageUrl && (
              <a
                href={ra.recruitPageUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 text-sm text-amber-600 hover:underline"
              >
                <Briefcase className="w-3.5 h-3.5" />
                採用ページ
              </a>
            )}
          </div>
        </div>

        {/* スコア内訳 */}
        <div className="space-y-2">
          <p className="text-xs font-medium text-zinc-500 uppercase tracking-wide">
            スコア内訳
          </p>
          {RECRUIT_SCORE_ITEMS.map((item) => {
            const val = lead.score.breakdown[item.key] ?? 0;
            const pct = (val / item.max) * 100;
            return (
              <div key={item.key} className="flex items-center gap-2">
                <span className="text-xs text-zinc-600 w-36 flex-shrink-0">
                  {item.label}
                </span>
                <div className="flex-1 h-2 bg-zinc-200 rounded-full overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all ${
                      item.key === "videoOpportunity"
                        ? "bg-red-500"
                        : item.key === "snsOpportunity"
                          ? "bg-pink-500"
                          : item.key === "recruitActivity"
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

      {/* 採用ページ分析 */}
      {ra && ra.summary !== "採用ページなし" && (
        <div className="bg-amber-50 rounded-lg border border-amber-200 px-4 py-3">
          <p className="text-xs font-medium text-amber-700 mb-2 flex items-center gap-1.5">
            <Briefcase className="w-3.5 h-3.5" />
            採用ページ分析
          </p>
          <p className="text-sm text-amber-800 mb-2">{ra.summary}</p>

          {/* 採用タイプバッジ */}
          <div className="flex flex-wrap gap-2 mb-2">
            {ra.recruitType !== "unknown" && (
              <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium border ${RECRUIT_TYPE_LABELS[ra.recruitType].className}`}>
                <Users className="w-3 h-3" />
                {RECRUIT_TYPE_LABELS[ra.recruitType].label}
              </span>
            )}
            {ra.hasRecruitVideo ? (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium border bg-green-100 text-green-700 border-green-200">
                採用動画あり
              </span>
            ) : (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium border bg-red-50 text-red-600 border-red-200">
                採用動画なし → 提案チャンス
              </span>
            )}
          </div>

          {ra.jobTypes.length > 0 && (
            <p className="text-xs text-amber-700">
              <span className="font-medium">募集職種:</span> {ra.jobTypes.join(", ")}
            </p>
          )}
          {ra.usesRecruitPlatform.length > 0 && (
            <p className="text-xs text-amber-700 mt-1">
              <span className="font-medium">使用求人サイト:</span> {ra.usesRecruitPlatform.join(", ")}
            </p>
          )}
          {ra.urgencySignals.length > 0 && (
            <p className="text-xs text-red-600 mt-1 font-medium">
              急募シグナル: {ra.urgencySignals.join(", ")}
            </p>
          )}
          {ra.recruitTypeSignals.length > 0 && (
            <p className="text-xs text-amber-600 mt-1">
              <span className="font-medium">判定根拠:</span> {ra.recruitTypeSignals.join(" / ")}
            </p>
          )}
        </div>
      )}

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
          className={!isSaved ? "bg-amber-600 hover:bg-amber-700" : ""}
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
