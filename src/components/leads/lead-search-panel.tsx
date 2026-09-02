"use client";

import { useState, useCallback } from "react";
import Link from "next/link";
import type { PlaceLead, ScoredLead, LeadScore, WebsiteAnalysis, SuccessProfileInfo, GroupProfileInfo } from "@/lib/constants/leads";
import { LeadSearchForm } from "./lead-search-form";
import { LeadResultsTable } from "./lead-results-table";
import { Loader2, AlertCircle, RotateCcw, ListChecks, Brain } from "lucide-react";
import { Button } from "@/components/ui/button";
import { saveLeadsFromSearch, checkExistingLeads } from "@/lib/actions/lead";
import { findScoreByName } from "@/lib/leads/match-score";
import type { SearchSuggestion } from "@/lib/actions/lead";

type Phase = "form" | "searching" | "scoring" | "done" | "error";

const SCORE_LABEL_MAP: Record<string, string> = {
  industryMatch: "業種一致度",
  activity: "活発度",
  scale: "規模感",
  competitive: "競合優位性",
  accessibility: "接触しやすさ",
  digitalPresence: "デジタル活用度",
  proximity: "劇場距離",
  localFit: "地域密着度",
};

interface LeadSearchPanelProps {
  suggestions?: SearchSuggestion[];
}

export function LeadSearchPanel({ suggestions = [] }: LeadSearchPanelProps) {
  const [phase, setPhase] = useState<Phase>("form");
  const [leads, setLeads] = useState<ScoredLead[]>([]);
  const [savedNames, setSavedNames] = useState<Set<string>>(new Set());
  const [savingName, setSavingName] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState("");
  const [searchParams, setSearchParams] = useState({ industry: "", area: "" });
  const [existingMap, setExistingMap] = useState<Record<string, string>>({});
  const [successProfileInfo, setSuccessProfileInfo] = useState<SuccessProfileInfo | null>(null);
  const [groupProfileInfo, setGroupProfileInfo] = useState<GroupProfileInfo | null>(null);

  const handleSearch = useCallback(
    async (params: {
      prefecture: string;
      city: string;
      industry: string;
      industryKeywords: string;
      count: number;
    }) => {
      setPhase("searching");
      setErrorMsg("");

      try {
        // 1) Google Places 検索
        const searchRes = await fetch("/api/leads/search", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(params),
        });

        if (!searchRes.ok) {
          const err = await searchRes.json();
          const detail = err.details ? ` (${JSON.stringify(err.details)})` : "";
          throw new Error((err.error || "企業検索に失敗しました") + detail);
        }

        const { places } = (await searchRes.json()) as {
          places: PlaceLead[];
        };

        if (places.length === 0) {
          throw new Error(
            "該当する企業が見つかりませんでした。エリアや業種を変更してお試しください。"
          );
        }

        // 2) AIスコアリング
        setPhase("scoring");

        const scoreRes = await fetch("/api/leads/score", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            places,
            industry: params.industry,
            area: [params.city, params.prefecture].filter(Boolean).join(" "),
          }),
        });

        if (!scoreRes.ok) {
          const err = await scoreRes.json();
          const detail = err.details ? ` (${JSON.stringify(err.details)})` : "";
          throw new Error((err.error || "スコアリングに失敗しました") + detail);
        }

        const { scores, analyses, successProfile, groupProfile } = (await scoreRes.json()) as {
          scores: Array<{
            name: string;
            total: number;
            breakdown: LeadScore["breakdown"];
            comment: string;
          }>;
          analyses: Record<string, WebsiteAnalysis>;
          successProfile: SuccessProfileInfo | null;
          groupProfile: GroupProfileInfo | null;
        };
        setSuccessProfileInfo(successProfile ?? null);
        setGroupProfileInfo(groupProfile ?? null);

        // 3) マージ
        const merged: ScoredLead[] = places.map((place) => {
          const s = findScoreByName(scores, place.name);
          return {
            ...place,
            score: s
              ? { total: s.total, breakdown: s.breakdown, comment: s.comment }
              : {
                  total: 0,
                  breakdown: {
                    industryMatch: 0,
                    activity: 0,
                    scale: 0,
                    competitive: 0,
                    accessibility: 0,
                    digitalPresence: 0,
                  },
                  comment: "スコアリング対象外",
                },
            digitalAnalysis: analyses?.[place.name],
          };
        });

        merged.sort((a, b) => b.score.total - a.score.total);

        // 4) 既存リードチェック
        const existMap = await checkExistingLeads(
          merged.map((m) => ({ name: m.name, address: m.address ?? "" }))
        );
        setExistingMap(existMap);

        setLeads(merged);
        setSearchParams({
          industry: params.industry,
          area: [params.city, params.prefecture].filter(Boolean).join(" "),
        });
        setSavedNames(new Set());
        setPhase("done");
      } catch (err) {
        setErrorMsg(
          err instanceof Error ? err.message : "予期しないエラーが発生しました"
        );
        setPhase("error");
      }
    },
    []
  );

  const handleSaveLead = useCallback(
    async (name: string) => {
      const lead = leads.find((l) => l.name === name);
      if (!lead || savedNames.has(name) || savingName) return;

      setSavingName(name);
      try {
        const result = await saveLeadsFromSearch(
          [lead],
          searchParams.industry,
          searchParams.area
        );
        if (!result.error) {
          setSavedNames((prev) => new Set(prev).add(name));
        } else {
          // 取得の蓋などで保存を止められた場合は理由を見せる（黙って落とさない）
          alert(result.error);
        }
      } finally {
        setSavingName(null);
      }
    },
    [leads, savedNames, savingName, searchParams]
  );

  const handleSaveAll = useCallback(
    async (names: string[]) => {
      const unsaved = names.filter((n) => !savedNames.has(n));
      if (unsaved.length === 0 || savingName) return;

      for (const name of unsaved) {
        const lead = leads.find((l) => l.name === name);
        if (!lead) continue;
        setSavingName(name);
        try {
          const result = await saveLeadsFromSearch(
            [lead],
            searchParams.industry,
            searchParams.area
          );
          if (!result.error) {
            setSavedNames((prev) => new Set(prev).add(name));
          } else {
            // 取得の蓋などで止められたら残りも保存できないので理由を見せて中断
            alert(result.error);
            setSavingName(null);
            return;
          }
        } catch {
          // continue with remaining
        }
      }
      setSavingName(null);
    },
    [leads, savedNames, savingName, searchParams]
  );

  const handleReset = useCallback(() => {
    setPhase("form");
    setLeads([]);
    setErrorMsg("");
  }, []);

  return (
    <div className="space-y-5">
      {/* 検索フォーム（formまたはdone時に表示） */}
      {(phase === "form" || phase === "done" || phase === "error") && (
        <div className="bg-white rounded-xl border border-zinc-200 px-5 py-4">
          <LeadSearchForm
            onSubmit={handleSearch}
            loading={false}
            suggestions={suggestions}
          />
        </div>
      )}

      {/* ローディング */}
      {(phase === "searching" || phase === "scoring") && (
        <div className="bg-white rounded-xl border border-zinc-200 px-5 py-12 flex flex-col items-center gap-3">
          <Loader2 className="w-8 h-8 text-blue-500 animate-spin" />
          <p className="text-sm text-zinc-600">
            {phase === "searching"
              ? "企業情報を取得中..."
              : "AIがスコアリング中..."}
          </p>
          <p className="text-xs text-zinc-400">
            {phase === "searching"
              ? "Google Places API で検索しています"
              : "Webサイト分析 + 営業優先度をスコアリング中"}
          </p>
        </div>
      )}

      {/* エラー */}
      {phase === "error" && (
        <div className="bg-red-50 rounded-xl border border-red-200 px-5 py-4 flex items-center gap-3">
          <AlertCircle className="w-5 h-5 text-red-400 flex-shrink-0" />
          <p className="text-sm text-red-600">{errorMsg}</p>
        </div>
      )}

      {/* 学習データ反映バッジ */}
      {phase === "done" && successProfileInfo && (
        <div className="bg-gradient-to-r from-purple-50 to-indigo-50 rounded-xl border border-purple-200 px-5 py-3">
          <div className="flex items-center gap-3 mb-2">
            <Brain className="w-5 h-5 text-purple-600 flex-shrink-0" />
            <div>
              <p className="text-sm font-medium text-purple-800 flex items-center gap-2">
                営業実績データを反映してスコアリング
                <span className={`inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium ${
                  successProfileInfo.dataSource === "branch"
                    ? "bg-emerald-100 text-emerald-700"
                    : "bg-zinc-100 text-zinc-600"
                }`}>
                  {successProfileInfo.dataSource === "branch" ? "自拠点データ" : "グループ全体"}
                </span>
              </p>
              <p className="text-xs text-purple-600">
                商談化・アポ獲得 {successProfileInfo.successCount}件
                {successProfileInfo.skippedCount > 0 && ` / スキップ ${successProfileInfo.skippedCount}件`}
                の実績データで学習済み
              </p>
            </div>
          </div>
          {Object.keys(successProfileInfo.avgBreakdown).length > 0 && (
            <div className="flex flex-wrap gap-1.5 ml-8">
              {Object.entries(successProfileInfo.avgBreakdown)
                .sort(([, a], [, b]) => b - a)
                .slice(0, 3)
                .map(([key, val]) => (
                  <span key={key} className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium bg-purple-100 text-purple-700">
                    {SCORE_LABEL_MAP[key] ?? key}: 平均{val}点
                  </span>
                ))}
              <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium bg-purple-100/50 text-purple-500">
                成功平均: {successProfileInfo.avgTotal}点
              </span>
            </div>
          )}
          {/* グループ全体の実績（自拠点データ使用時のみ表示） */}
          {groupProfileInfo && (
            <div className="mt-3 pt-3 border-t border-purple-200/50">
              <p className="text-[11px] text-purple-500 mb-1.5 flex items-center gap-1.5">
                <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium bg-zinc-100 text-zinc-600">グループ全体</span>
                商談化・アポ {groupProfileInfo.successCount}件 / 成功平均 {groupProfileInfo.avgTotal}点
              </p>
              <div className="flex flex-wrap gap-1.5 ml-0">
                {Object.entries(groupProfileInfo.avgBreakdown)
                  .sort(([, a], [, b]) => b - a)
                  .slice(0, 3)
                  .map(([key, val]) => (
                    <span key={key} className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium bg-zinc-100 text-zinc-500">
                      {SCORE_LABEL_MAP[key] ?? key}: {val}点
                    </span>
                  ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* 結果テーブル */}
      {phase === "done" && leads.length > 0 && (
        <LeadResultsTable
          leads={leads}
          savedNames={savedNames}
          savingName={savingName}
          onSaveLead={handleSaveLead}
          onSaveAll={handleSaveAll}
          existingMap={existingMap}
          successProfile={successProfileInfo}
        />
      )}

      {/* 保存済みリンク */}
      {phase === "done" && savedNames.size > 0 && (
        <div className="bg-emerald-50 rounded-xl border border-emerald-200 px-5 py-3 flex items-center gap-3">
          <p className="text-sm text-emerald-700">
            <strong>{savedNames.size}件</strong> をリード管理に保存しました
          </p>
          <Link
            href="/dashboard/leads/list"
            className="inline-flex items-center gap-1 text-sm text-blue-600 hover:underline font-medium"
          >
            <ListChecks className="w-3.5 h-3.5" />
            リード管理を開く
          </Link>
        </div>
      )}
    </div>
  );
}
