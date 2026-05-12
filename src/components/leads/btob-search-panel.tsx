"use client";

import { useState, useCallback } from "react";
import Link from "next/link";
import type { BtoBCompanyLead, ScoredBtoBLead, BtoBLeadScore, WebsiteAnalysis, YouTubeChannelInfo } from "@/lib/constants/leads";
import { BtoBSearchForm } from "./btob-search-form";
import { BtoBResultsTable } from "./btob-results-table";
import { Loader2, AlertCircle, RotateCcw, ListChecks } from "lucide-react";
import { Button } from "@/components/ui/button";
import { saveBtoBLeadsFromSearch, checkExistingLeads } from "@/lib/actions/lead";
import { findScoreByName } from "@/lib/leads/match-score";

type Phase = "form" | "searching" | "enriching" | "scoring" | "done" | "error";

export function BtoBSearchPanel() {
  const [phase, setPhase] = useState<Phase>("form");
  const [leads, setLeads] = useState<ScoredBtoBLead[]>([]);
  const [savedNames, setSavedNames] = useState<Set<string>>(new Set());
  const [savingName, setSavingName] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState("");
  const [searchParams, setSearchParams] = useState({ industry: "", area: "" });
  const [existingMap, setExistingMap] = useState<Record<string, string>>({});

  const handleSearch = useCallback(
    async (params: {
      prefecture: string;
      city: string;
      businessItem: string;
      companyName: string;
      capitalFrom?: number;
      capitalTo?: number;
      employeeFrom?: number;
      employeeTo?: number;
      limit: number;
    }) => {
      setPhase("searching");
      setErrorMsg("");

      try {
        // 1) gBizINFO 検索
        const searchRes = await fetch("/api/leads/btob/search", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(params),
        });

        const searchData = await searchRes.json();

        if (!searchRes.ok) {
          throw new Error(searchData.error || "企業検索に失敗しました");
        }

        const companies: BtoBCompanyLead[] = searchData.companies ?? [];

        if (companies.length === 0) {
          const debugInfo = searchData.debug ? ` (debug: ${JSON.stringify(searchData.debug)})` : "";
          throw new Error(
            `該当する企業が見つかりませんでした。条件を変更してお試しください。${debugInfo}`
          );
        }

        // WebサイトURLがある企業を自動でエンリッチ+スコアリング
        const companiesWithUrl = companies.filter((c) => c.websiteUrl);
        const companiesWithoutUrl = companies.filter((c) => !c.websiteUrl);

        let enrichments: Record<string, { websiteAnalysis?: WebsiteAnalysis; youtubeChannel?: YouTubeChannelInfo | null }> = {};
        let scores: Array<{ name: string; total: number; breakdown: BtoBLeadScore["breakdown"]; comment: string }> = [];

        if (companiesWithUrl.length > 0) {
          // 2) YouTube・Web エンリッチメント（URL有り企業のみ）
          setPhase("enriching");

          const enrichRes = await fetch("/api/leads/btob/enrich", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              companies: companiesWithUrl.map((c) => ({
                name: c.name,
                websiteUrl: c.websiteUrl,
              })),
            }),
          });

          if (enrichRes.ok) {
            const enrichData = await enrichRes.json();
            enrichments = enrichData.enrichments ?? {};
          } else {
            console.warn("[BtoB] エンリッチメント取得に失敗しました（スコアリングは続行）");
          }

          // 3) AIスコアリング（全企業対象、エンリッチデータ付き）
          setPhase("scoring");

          const scoreRes = await fetch("/api/leads/btob/score", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              companies,
              enrichments,
              industry: params.businessItem,
              area: [params.city, params.prefecture].filter(Boolean).join(" "),
            }),
          });

          if (!scoreRes.ok) {
            const err = await scoreRes.json();
            throw new Error(err.error || "スコアリングに失敗しました");
          }
          const scoreData = await scoreRes.json();
          scores = scoreData.scores ?? [];
        } else {
          // URL有り企業が0件 → エンリッチなしでスコアリングのみ
          setPhase("scoring");

          const scoreRes = await fetch("/api/leads/btob/score", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              companies,
              enrichments: {},
              industry: params.businessItem,
              area: [params.city, params.prefecture].filter(Boolean).join(" "),
            }),
          });

          if (!scoreRes.ok) {
            const err = await scoreRes.json();
            throw new Error(err.error || "スコアリングに失敗しました");
          }
          const scoreData = await scoreRes.json();
          scores = scoreData.scores ?? [];
        }

        // 4) マージ
        const merged: ScoredBtoBLead[] = companies.map((company) => {
          const s = findScoreByName(scores, company.name);
          const enrich = enrichments?.[company.name];
          return {
            ...company,
            score: s
              ? { total: s.total, breakdown: s.breakdown, comment: s.comment }
              : {
                  total: 0,
                  breakdown: {
                    industryMatch: 0,
                    scale: 0,
                    digitalPresence: 0,
                    youtubeOpportunity: 0,
                    growthSignal: 0,
                    accessibility: 0,
                  },
                  comment: "スコアリング対象外",
                },
            digitalAnalysis: enrich?.websiteAnalysis,
            youtubeChannel: enrich?.youtubeChannel ?? undefined,
          };
        });

        merged.sort((a, b) => b.score.total - a.score.total);

        // 5) 既存リードチェック
        const existMap = await checkExistingLeads(
          merged.map((m) => ({ name: m.name, address: m.address ?? "" }))
        );
        setExistingMap(existMap);

        setLeads(merged);
        setSearchParams({
          industry: params.businessItem,
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
        const result = await saveBtoBLeadsFromSearch(
          [lead],
          searchParams.industry,
          searchParams.area
        );
        if (!result.error) {
          setSavedNames((prev) => new Set(prev).add(name));
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
          const result = await saveBtoBLeadsFromSearch(
            [lead],
            searchParams.industry,
            searchParams.area
          );
          if (!result.error) {
            setSavedNames((prev) => new Set(prev).add(name));
          }
        } catch {
          // continue
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
          <BtoBSearchForm
            onSubmit={handleSearch}
            loading={false}
          />
        </div>
      )}

      {/* ローディング */}
      {(phase === "searching" || phase === "enriching" || phase === "scoring") && (
        <div className="bg-white rounded-xl border border-zinc-200 px-5 py-12 flex flex-col items-center gap-3">
          <Loader2 className="w-8 h-8 text-blue-500 animate-spin" />
          <p className="text-sm text-zinc-600">
            {phase === "searching"
              ? "gBizINFOから企業情報を取得中..."
              : phase === "enriching"
                ? "YouTube・Webサイトを分析中..."
                : "AIがスコアリング中..."}
          </p>
          <p className="text-xs text-zinc-400">
            {phase === "searching"
              ? "経産省の企業データベースを検索しています"
              : phase === "enriching"
                ? "各企業のデジタルプレゼンスを調査しています"
                : "BtoB営業優先度を算出しています"}
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

      {/* 結果テーブル */}
      {phase === "done" && leads.length > 0 && (
        <BtoBResultsTable
          leads={leads}
          savedNames={savedNames}
          savingName={savingName}
          onSaveLead={handleSaveLead}
          onSaveAll={handleSaveAll}
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
