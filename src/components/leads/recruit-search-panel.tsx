"use client";

import { useState, useCallback } from "react";
import Link from "next/link";
import type {
  PlaceLead,
  ScoredRecruitLead,
  RecruitLeadScore,
  WebsiteAnalysis,
  YouTubeChannelInfo,
  RecruitmentAnalysis,
} from "@/lib/constants/leads";
import { RecruitSearchForm } from "./recruit-search-form";
import { RecruitResultsTable } from "./recruit-results-table";
import { Loader2, AlertCircle, RotateCcw, ListChecks } from "lucide-react";
import { Button } from "@/components/ui/button";
import { saveRecruitLeadsFromSearch, checkExistingLeads } from "@/lib/actions/lead";

type Phase = "form" | "searching" | "enriching" | "scoring" | "done" | "error";

export function RecruitSearchPanel() {
  const [phase, setPhase] = useState<Phase>("form");
  const [leads, setLeads] = useState<ScoredRecruitLead[]>([]);
  const [savedNames, setSavedNames] = useState<Set<string>>(new Set());
  const [savingName, setSavingName] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState("");
  const [searchParams, setSearchParams] = useState({ industry: "", area: "" });
  const [existingMap, setExistingMap] = useState<Record<string, string>>({});

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
        // 1) Google Places 検索（既存の /api/leads/search を再利用）
        const searchRes = await fetch("/api/leads/search", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            prefecture: params.prefecture,
            city: params.city,
            industry: params.industry,
            industryKeywords: params.industryKeywords,
            count: params.count,
          }),
        });

        const searchData = await searchRes.json();
        if (!searchRes.ok) {
          throw new Error(searchData.error || "企業検索に失敗しました");
        }

        const places: PlaceLead[] = searchData.places ?? [];
        if (places.length === 0) {
          throw new Error("該当する企業が見つかりませんでした。条件を変更してお試しください。");
        }

        // 2) 採用ページ深堀り分析 + YouTube + Web分析
        setPhase("enriching");

        let enrichments: Record<
          string,
          {
            websiteAnalysis?: WebsiteAnalysis;
            youtubeChannel?: YouTubeChannelInfo | null;
            recruitAnalysis?: RecruitmentAnalysis;
          }
        > = {};

        const companiesWithUrl = places.filter((p) => p.websiteUrl);
        if (companiesWithUrl.length > 0) {
          const enrichRes = await fetch("/api/leads/recruit/enrich", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              companies: companiesWithUrl.map((p) => ({
                name: p.name,
                websiteUrl: p.websiteUrl,
              })),
            }),
          });

          if (enrichRes.ok) {
            const enrichData = await enrichRes.json();
            enrichments = enrichData.enrichments ?? {};
          }
        }

        // 3) AI採用特化スコアリング
        setPhase("scoring");

        let scores: Array<{
          name: string;
          total: number;
          breakdown: RecruitLeadScore["breakdown"];
          comment: string;
        }> = [];

        const scoreRes = await fetch("/api/leads/recruit/score", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            places,
            enrichments,
            industry: params.industry,
            area: [params.city, params.prefecture].filter(Boolean).join(" "),
          }),
        });

        if (scoreRes.ok) {
          const scoreData = await scoreRes.json();
          scores = scoreData.scores ?? [];
        }

        // 4) マージ
        const merged: ScoredRecruitLead[] = places.map((place) => {
          const s = scores.find((sc) => sc.name === place.name);
          const enrich = enrichments[place.name];
          return {
            ...place,
            score: s
              ? { total: s.total, breakdown: s.breakdown, comment: s.comment }
              : {
                  total: 0,
                  breakdown: {
                    recruitActivity: 0,
                    recruitMethodAge: 0,
                    videoOpportunity: 0,
                    snsOpportunity: 0,
                    companyScale: 0,
                    accessibility: 0,
                  },
                  comment: "スコアリング対象外",
                },
            digitalAnalysis: enrich?.websiteAnalysis,
            recruitAnalysis: enrich?.recruitAnalysis,
            youtubeChannel: enrich?.youtubeChannel ?? undefined,
          };
        });

        merged.sort((a, b) => b.score.total - a.score.total);

        // 5) 既存リードチェック
        const existMap = await checkExistingLeads(
          merged.map((m) => ({ name: m.name, address: m.address ?? "" })),
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
          err instanceof Error ? err.message : "予期しないエラーが発生しました",
        );
        setPhase("error");
      }
    },
    [],
  );

  const handleSaveLead = useCallback(
    async (name: string) => {
      const lead = leads.find((l) => l.name === name);
      if (!lead || savedNames.has(name) || savingName) return;

      setSavingName(name);
      try {
        const result = await saveRecruitLeadsFromSearch(
          [lead],
          searchParams.industry,
          searchParams.area,
        );
        if (!result.error) {
          setSavedNames((prev) => new Set(prev).add(name));
        }
      } finally {
        setSavingName(null);
      }
    },
    [leads, savedNames, savingName, searchParams],
  );

  const handleReset = useCallback(() => {
    setPhase("form");
    setLeads([]);
    setErrorMsg("");
  }, []);

  return (
    <div className="space-y-5">
      {/* 検索フォーム */}
      {(phase === "form" || phase === "done") && (
        <div className="bg-white rounded-xl border border-zinc-200 px-5 py-4">
          <RecruitSearchForm onSubmit={handleSearch} loading={false} />
        </div>
      )}

      {/* ローディング */}
      {(phase === "searching" || phase === "enriching" || phase === "scoring") && (
        <div className="bg-white rounded-xl border border-zinc-200 px-5 py-12 flex flex-col items-center gap-3">
          <Loader2 className="w-8 h-8 text-amber-500 animate-spin" />
          <p className="text-sm text-zinc-600">
            {phase === "searching"
              ? "Google Mapsから企業情報を取得中..."
              : phase === "enriching"
                ? "採用ページ・YouTube・Webサイトを分析中..."
                : "AIが採用マーケティング観点でスコアリング中..."}
          </p>
          <p className="text-xs text-zinc-400">
            {phase === "searching"
              ? "エリア内の採用活動中の企業を検索しています"
              : phase === "enriching"
                ? "採用ページの内容を深堀り分析しています（中途/新卒判定含む）"
                : "採用動画・SNS・ブランディングの提案余地を算出しています"}
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
        <RecruitResultsTable
          leads={leads}
          savedNames={savedNames}
          savingName={savingName}
          onSaveLead={handleSaveLead}
          existingMap={existingMap}
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
