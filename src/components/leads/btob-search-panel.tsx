"use client";

import { useState, useCallback, useTransition } from "react";
import Link from "next/link";
import type { BtoBCompanyLead, ScoredBtoBLead, BtoBLeadScore, WebsiteAnalysis, YouTubeChannelInfo } from "@/lib/constants/leads";
import { BtoBSearchForm } from "./btob-search-form";
import { BtoBResultsTable } from "./btob-results-table";
import { Loader2, AlertCircle, RotateCcw, Save, ListChecks } from "lucide-react";
import { Button } from "@/components/ui/button";
import { saveBtoBLeadsFromSearch, checkExistingLeads } from "@/lib/actions/lead";

type Phase = "form" | "searching" | "enriching" | "scoring" | "done" | "error";

export function BtoBSearchPanel() {
  const [phase, setPhase] = useState<Phase>("form");
  const [leads, setLeads] = useState<ScoredBtoBLead[]>([]);
  const [addedNames, setAddedNames] = useState<Set<string>>(new Set());
  const [errorMsg, setErrorMsg] = useState("");
  const [searchParams, setSearchParams] = useState({ industry: "", area: "" });
  const [existingMap, setExistingMap] = useState<Record<string, string>>({});
  const [savedCount, setSavedCount] = useState<number | null>(null);
  const [isSaving, startSaving] = useTransition();

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

        if (!searchRes.ok) {
          const err = await searchRes.json();
          throw new Error(err.error || "企業検索に失敗しました");
        }

        const { companies } = (await searchRes.json()) as {
          companies: BtoBCompanyLead[];
        };

        if (companies.length === 0) {
          throw new Error(
            "該当する企業が見つかりませんでした。条件を変更してお試しください。"
          );
        }

        // 2) YouTube・Web エンリッチメント
        setPhase("enriching");

        const enrichRes = await fetch("/api/leads/btob/enrich", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            companies: companies.map((c) => ({
              name: c.name,
              websiteUrl: c.websiteUrl,
            })),
          }),
        });

        if (!enrichRes.ok) {
          const err = await enrichRes.json();
          throw new Error(err.error || "エンリッチメントに失敗しました");
        }

        const { enrichments } = (await enrichRes.json()) as {
          enrichments: Record<
            string,
            { website?: WebsiteAnalysis; youtube?: YouTubeChannelInfo }
          >;
        };

        // 3) AIスコアリング
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

        const { scores } = (await scoreRes.json()) as {
          scores: Array<{
            name: string;
            total: number;
            breakdown: BtoBLeadScore["breakdown"];
            comment: string;
          }>;
        };

        // 4) マージ
        const merged: ScoredBtoBLead[] = companies.map((company) => {
          const s = scores.find((sc) => sc.name === company.name);
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
            digitalAnalysis: enrich?.website,
            youtubeChannel: enrich?.youtube,
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
        setSavedCount(null);
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
        <BtoBResultsTable
          leads={leads}
          addedNames={addedNames}
          onToggleAdd={handleToggleAdd}
          existingMap={existingMap}
        />
      )}

      {/* リード保存バー */}
      {phase === "done" && leads.length > 0 && (
        <div className="bg-blue-50 rounded-xl border border-blue-200 px-5 py-3 flex items-center justify-between">
          {savedCount !== null ? (
            <div className="flex items-center gap-3">
              <p className="text-sm text-emerald-700">
                <strong>{savedCount}件</strong> のリードを保存しました
              </p>
              <Link
                href="/dashboard/leads/list"
                className="inline-flex items-center gap-1 text-sm text-blue-600 hover:underline font-medium"
              >
                <ListChecks className="w-3.5 h-3.5" />
                リード管理を開く
              </Link>
            </div>
          ) : (
            <div className="flex items-center justify-between w-full">
              <p className="text-sm text-blue-700">
                {addedNames.size > 0 ? (
                  <>
                    <strong>{addedNames.size}件</strong> 選択中（結果一覧の「+」ボタンで企業を選択）
                  </>
                ) : (
                  <>結果一覧の「+」ボタンで保存したい企業を選択してください</>
                )}
              </p>
              <div className="flex items-center gap-2">
                {addedNames.size > 0 && (
                  <button
                    onClick={() => setAddedNames(new Set())}
                    className="text-xs text-zinc-500 hover:text-zinc-700 underline"
                  >
                    選択解除
                  </button>
                )}
                <Button
                  size="sm"
                  onClick={() => {
                    const selectedLeads = leads.filter((l) => addedNames.has(l.name));
                    if (selectedLeads.length === 0) return;
                    startSaving(async () => {
                      const result = await saveBtoBLeadsFromSearch(
                        selectedLeads,
                        searchParams.industry,
                        searchParams.area
                      );
                      setSavedCount(result.saved);
                    });
                  }}
                  disabled={isSaving || addedNames.size === 0}
                  className="gap-1.5"
                >
                  {isSaving ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <Save className="w-3.5 h-3.5" />
                  )}
                  選択した{addedNames.size}件を保存
                </Button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
