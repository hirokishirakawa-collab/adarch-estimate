"use client";

import { useState, useCallback, useMemo } from "react";
import Link from "next/link";
import dynamic from "next/dynamic";
import type {
  CinemaPlaceLead,
  ScoredCinemaLead,
  CinemaLeadScore,
} from "@/lib/constants/cinema-leads";
import type { WebsiteAnalysis } from "@/lib/constants/leads";
import { CinemaSearchForm } from "./cinema-search-form";
import { CinemaResultsTable } from "./cinema-results-table";
import { Loader2, AlertCircle, RotateCcw, ListChecks } from "lucide-react";
import { Button } from "@/components/ui/button";
import { saveCinemaLeadsFromSearch, checkExistingLeads } from "@/lib/actions/lead";

// Leaflet は SSR 非対応なので dynamic import
const CinemaMap = dynamic(
  () => import("./cinema-map").then((m) => m.CinemaMap),
  { ssr: false, loading: () => <div className="w-full h-[400px] bg-zinc-100 rounded-xl animate-pulse" /> }
);

type Phase = "form" | "searching" | "scoring" | "done" | "error";

interface TheaterLocation {
  name: string;
  lat: number;
  lng: number;
}

export function CinemaSearchPanel() {
  const [phase, setPhase] = useState<Phase>("form");
  const [leads, setLeads] = useState<ScoredCinemaLead[]>([]);
  const [savedNames, setSavedNames] = useState<Set<string>>(new Set());
  const [savingName, setSavingName] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState("");
  const [theater, setTheater] = useState<TheaterLocation | null>(null);
  const [maxRadius, setMaxRadius] = useState(10);
  const [searchMeta, setSearchMeta] = useState({ theaterName: "", industry: "" });
  const [existingMap, setExistingMap] = useState<Record<string, string>>({});

  // 距離帯サマリー
  const bandSummary = useMemo(() => {
    const bands: Record<number, number> = {};
    for (const l of leads) {
      bands[l.radiusBand] = (bands[l.radiusBand] ?? 0) + 1;
    }
    return bands;
  }, [leads]);

  const handleSearch = useCallback(
    async (params: {
      theaterId: number;
      theaterName: string;
      theaterAddress: string;
      radius: number;
      industries: string[];
      count: number;
    }) => {
      setPhase("searching");
      setErrorMsg("");

      try {
        // 1) 周辺企業を検索
        const searchRes = await fetch("/api/leads/cinema/search", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(params),
        });

        if (!searchRes.ok) {
          const err = await searchRes.json();
          throw new Error(err.error || "企業検索に失敗しました");
        }

        const { places, theater: theaterData } = (await searchRes.json()) as {
          places: CinemaPlaceLead[];
          theater: TheaterLocation;
        };

        if (places.length === 0) {
          throw new Error("指定範囲に該当する企業が見つかりませんでした。半径を広げるか業種を変更してお試しください。");
        }

        setTheater(theaterData);
        setMaxRadius(params.radius / 1000);

        // 2) AIスコアリング
        setPhase("scoring");

        const industryLabel = params.industries.join(", ");
        const scoreRes = await fetch("/api/leads/cinema/score", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            places,
            theaterName: params.theaterName,
            industry: industryLabel,
          }),
        });

        if (!scoreRes.ok) {
          const err = await scoreRes.json();
          throw new Error(err.error || "スコアリングに失敗しました");
        }

        const { scores, analyses } = (await scoreRes.json()) as {
          scores: Array<{
            name: string;
            total: number;
            breakdown: CinemaLeadScore["breakdown"];
            comment: string;
          }>;
          analyses: Record<string, WebsiteAnalysis>;
        };

        // 3) マージ
        const merged: ScoredCinemaLead[] = places.map((place) => {
          const s = scores.find((sc) => sc.name === place.name);
          return {
            ...place,
            score: s
              ? { total: s.total, breakdown: s.breakdown, comment: s.comment }
              : {
                  total: 0,
                  breakdown: {
                    industryMatch: 0,
                    proximity: 0,
                    scale: 0,
                    digitalPresence: 0,
                    localFit: 0,
                    accessibility: 0,
                  },
                  comment: "スコアリング対象外",
                },
            digitalAnalysis: analyses?.[place.name],
          };
        });

        merged.sort((a, b) => b.score.total - a.score.total);

        // 4) 既存チェック
        const existMap = await checkExistingLeads(
          merged.map((m) => ({ name: m.name, address: m.address ?? "" }))
        );
        setExistingMap(existMap);

        setLeads(merged);
        setSearchMeta({ theaterName: params.theaterName, industry: industryLabel });
        setSavedNames(new Set());
        setPhase("done");
      } catch (err) {
        setErrorMsg(err instanceof Error ? err.message : "予期しないエラーが発生しました");
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
        const result = await saveCinemaLeadsFromSearch(
          [lead],
          searchMeta.industry,
          `イオンシネマ${searchMeta.theaterName}周辺`
        );
        if (!result.error) {
          setSavedNames((prev) => new Set(prev).add(name));
        }
      } finally {
        setSavingName(null);
      }
    },
    [leads, savedNames, savingName, searchMeta]
  );

  const handleReset = useCallback(() => {
    setPhase("form");
    setLeads([]);
    setTheater(null);
    setErrorMsg("");
  }, []);

  return (
    <div className="space-y-5">
      {/* 検索フォーム */}
      {(phase === "form" || phase === "done") && (
        <div className="bg-white rounded-xl border border-zinc-200 px-5 py-4">
          <CinemaSearchForm onSubmit={handleSearch} loading={false} />
        </div>
      )}

      {/* ローディング */}
      {(phase === "searching" || phase === "scoring") && (
        <div className="bg-white rounded-xl border border-zinc-200 px-5 py-12 flex flex-col items-center gap-3">
          <Loader2 className="w-8 h-8 text-blue-500 animate-spin" />
          <p className="text-sm text-zinc-600">
            {phase === "searching" ? "周辺企業を検索中..." : "AIがスコアリング中..."}
          </p>
          <p className="text-xs text-zinc-400">
            {phase === "searching"
              ? "Google Places API で劇場周辺を検索しています"
              : "Webサイト分析 + シネアド適合度をスコアリング中"}
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

      {/* 地図 */}
      {phase === "done" && theater && (
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <p className="text-xs font-semibold text-zinc-700">
              イオンシネマ{theater.name} 周辺マップ
            </p>
            <div className="flex gap-1.5 text-[10px] text-zinc-500">
              {Object.entries(bandSummary)
                .sort(([a], [b]) => Number(a) - Number(b))
                .map(([band, count]) => (
                  <span key={band}>
                    {band}km圏: {count}件
                  </span>
                ))}
            </div>
          </div>
          <CinemaMap
            theaterLat={theater.lat}
            theaterLng={theater.lng}
            theaterName={theater.name}
            leads={leads}
            maxRadius={maxRadius}
          />
        </div>
      )}

      {/* 結果テーブル */}
      {phase === "done" && leads.length > 0 && (
        <CinemaResultsTable
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
