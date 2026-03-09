"use client";

import { useState, useCallback } from "react";
import type { PlaceLead, ScoredLead, LeadScore } from "@/lib/constants/leads";
import { LeadSearchForm } from "./lead-search-form";
import { LeadResultsTable } from "./lead-results-table";
import { Loader2, AlertCircle, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";

type Phase = "form" | "searching" | "scoring" | "done" | "error";

export function LeadSearchPanel() {
  const [phase, setPhase] = useState<Phase>("form");
  const [leads, setLeads] = useState<ScoredLead[]>([]);
  const [addedNames, setAddedNames] = useState<Set<string>>(new Set());
  const [errorMsg, setErrorMsg] = useState("");

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
          throw new Error(err.error || "企業検索に失敗しました");
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
          throw new Error(err.error || "スコアリングに失敗しました");
        }

        const { scores } = (await scoreRes.json()) as {
          scores: Array<{
            name: string;
            total: number;
            breakdown: LeadScore["breakdown"];
            comment: string;
          }>;
        };

        // 3) マージ
        const merged: ScoredLead[] = places.map((place) => {
          const s = scores.find((sc) => sc.name === place.name);
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
                  },
                  comment: "スコアリング対象外",
                },
          };
        });

        merged.sort((a, b) => b.score.total - a.score.total);
        setLeads(merged);
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

  const handleToggleAdd = useCallback((name: string) => {
    setAddedNames((prev) => {
      const next = new Set(prev);
      if (next.has(name)) next.delete(name);
      else next.add(name);
      return next;
    });
  }, []);

  const handleReset = useCallback(() => {
    setPhase("form");
    setLeads([]);
    setErrorMsg("");
  }, []);

  return (
    <div className="space-y-5">
      {/* 検索フォーム（formまたはdone時に表示） */}
      {(phase === "form" || phase === "done") && (
        <div className="bg-white rounded-xl border border-zinc-200 px-5 py-4">
          <LeadSearchForm
            onSubmit={handleSearch}
            loading={false}
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
              : "営業優先度を分析しています"}
          </p>
        </div>
      )}

      {/* エラー */}
      {phase === "error" && (
        <div className="bg-white rounded-xl border border-red-200 px-5 py-6 flex flex-col items-center gap-3">
          <AlertCircle className="w-8 h-8 text-red-400" />
          <p className="text-sm text-red-600">{errorMsg}</p>
          <Button size="sm" variant="outline" onClick={handleReset}>
            <RotateCcw className="w-3.5 h-3.5" />
            やり直す
          </Button>
        </div>
      )}

      {/* 結果テーブル */}
      {phase === "done" && leads.length > 0 && (
        <LeadResultsTable
          leads={leads}
          addedNames={addedNames}
          onToggleAdd={handleToggleAdd}
        />
      )}

      {/* 営業リスト追加サマリー */}
      {phase === "done" && addedNames.size > 0 && (
        <div className="bg-blue-50 rounded-xl border border-blue-200 px-5 py-3 flex items-center justify-between">
          <p className="text-sm text-blue-700">
            営業リストに <strong>{addedNames.size}件</strong> 追加済み
          </p>
          <Button
            size="xs"
            variant="outline"
            onClick={() => setAddedNames(new Set())}
          >
            クリア
          </Button>
        </div>
      )}
    </div>
  );
}
