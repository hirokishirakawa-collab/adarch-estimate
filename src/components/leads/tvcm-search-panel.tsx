"use client";

import { useState, useCallback } from "react";
import Link from "next/link";
import { Loader2, AlertCircle, Search, Filter, Film, Youtube, FileText, Layers } from "lucide-react";
import {
  TVCM_SEARCH_KEYWORDS,
  type TvcmLeadCandidate,
  type TvcmLeadResult,
} from "@/lib/constants/tvcm-leads";
import { TvcmResultsTable } from "./tvcm-results-table";
import { saveTvcmLeadsFromSearch, checkExistingLeads } from "@/lib/actions/lead";

type Phase = "form" | "crawling" | "done" | "error";
type Source = "youtube" | "prtimes" | "both";

interface CrawlStats {
  fetched: number;
  extracted: number;
  kept: number;
  excluded: number;
}

const SOURCE_OPTIONS: { value: Source; label: string; icon: typeof Youtube; desc: string }[] = [
  { value: "youtube", label: "YouTube", icon: Youtube, desc: "中小企業特化（登録者5万以下フィルタ）" },
  { value: "prtimes", label: "PR TIMES", icon: FileText, desc: "プレスリリース系（大手寄り）" },
  { value: "both", label: "両方", icon: Layers, desc: "包括的に。APIコスト高め" },
];

export function TvcmSearchPanel() {
  const [phase, setPhase] = useState<Phase>("form");
  const [source, setSource] = useState<Source>("youtube");
  const [selectedKeywords, setSelectedKeywords] = useState<string[]>(
    Array.from(TVCM_SEARCH_KEYWORDS).slice(0, 4),
  );
  const [maxPerKeyword, setMaxPerKeyword] = useState(8);
  const [totalLimit, setTotalLimit] = useState(30);
  const [maxSubscribers, setMaxSubscribers] = useState(50000);
  const [publishedWithinDays, setPublishedWithinDays] = useState(60);

  const [candidates, setCandidates] = useState<TvcmLeadCandidate[]>([]);
  const [excludedResults, setExcludedResults] = useState<TvcmLeadResult[]>([]);
  const [stats, setStats] = useState<CrawlStats | null>(null);
  const [errorMsg, setErrorMsg] = useState("");
  const [showExcluded, setShowExcluded] = useState(false);

  const [savedNames, setSavedNames] = useState<Set<string>>(new Set());
  const [savingName, setSavingName] = useState<string | null>(null);
  const [existingMap, setExistingMap] = useState<Record<string, string>>({});

  const toggleKeyword = (kw: string) => {
    setSelectedKeywords((cur) =>
      cur.includes(kw) ? cur.filter((k) => k !== kw) : [...cur, kw],
    );
  };

  const handleCrawl = useCallback(async () => {
    if (selectedKeywords.length === 0) {
      setErrorMsg("検索キーワードを1つ以上選択してください");
      return;
    }

    setPhase("crawling");
    setErrorMsg("");
    setCandidates([]);
    setExcludedResults([]);
    setStats(null);

    try {
      const res = await fetch("/api/leads/tvcm/crawl", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          source,
          keywords: selectedKeywords,
          maxPerKeyword,
          totalLimit,
          maxSubscribers,
          publishedWithinDays,
        }),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "クロール中にエラーが発生しました");
      }

      const data = (await res.json()) as {
        candidates: TvcmLeadCandidate[];
        results: TvcmLeadResult[];
        stats: CrawlStats;
        message?: string;
      };

      setCandidates(data.candidates);
      setExcludedResults(data.results.filter((r) => r.excluded));
      setStats(data.stats);
      setPhase("done");

      // 既存リード照合
      if (data.candidates.length > 0) {
        const existing = await checkExistingLeads(
          data.candidates.map((c) => ({
            name: c.companyName,
            address: c.address ?? "",
          })),
        );
        setExistingMap(existing);
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : "クロール中にエラーが発生しました";
      setErrorMsg(msg);
      setPhase("error");
    }
  }, [selectedKeywords, maxPerKeyword, totalLimit]);

  const handleSave = useCallback(async (c: TvcmLeadCandidate) => {
    setSavingName(c.companyName);
    try {
      const result = await saveTvcmLeadsFromSearch([c]);
      if (result.error) {
        alert(result.error);
      } else {
        setSavedNames((prev) => new Set(prev).add(c.companyName));
      }
    } finally {
      setSavingName(null);
    }
  }, []);

  const handleSaveAll = useCallback(async () => {
    const unsaved = candidates.filter((c) => !savedNames.has(c.companyName));
    if (unsaved.length === 0) return;
    if (!confirm(`${unsaved.length}件をリードとして保存します。よろしいですか？`)) return;

    setSavingName("__bulk__");
    try {
      const result = await saveTvcmLeadsFromSearch(unsaved);
      if (result.error) {
        alert(result.error);
      } else {
        setSavedNames((prev) => {
          const next = new Set(prev);
          for (const c of unsaved) next.add(c.companyName);
          return next;
        });
      }
    } finally {
      setSavingName(null);
    }
  }, [candidates, savedNames]);

  return (
    <div className="space-y-5">
      {/* 検索フォーム */}
      <div className="bg-white rounded-xl border border-zinc-200 p-5">
        <div className="flex items-center gap-2 mb-4">
          <Filter className="w-4 h-4 text-zinc-500" />
          <h3 className="text-sm font-semibold text-zinc-900">検索条件</h3>
        </div>

        {/* ソース選択 */}
        <div className="mb-4">
          <label className="text-xs font-medium text-zinc-700 mb-2 block">
            検索ソース
          </label>
          <div className="grid grid-cols-3 gap-2">
            {SOURCE_OPTIONS.map((opt) => {
              const active = source === opt.value;
              const Icon = opt.icon;
              return (
                <button
                  key={opt.value}
                  onClick={() => setSource(opt.value)}
                  className={`text-left px-3 py-2.5 rounded-lg border transition-all ${
                    active
                      ? "border-rose-500 bg-rose-50 ring-1 ring-rose-200"
                      : "border-zinc-200 bg-white hover:border-zinc-300"
                  }`}
                >
                  <div className="flex items-center gap-1.5 mb-0.5">
                    <Icon className={`w-3.5 h-3.5 ${active ? "text-rose-600" : "text-zinc-500"}`} />
                    <span className={`text-xs font-semibold ${active ? "text-rose-700" : "text-zinc-700"}`}>
                      {opt.label}
                    </span>
                  </div>
                  <p className="text-[10px] text-zinc-500 leading-snug">{opt.desc}</p>
                </button>
              );
            })}
          </div>
        </div>

        {/* キーワード */}
        <div className="mb-4">
          <label className="text-xs font-medium text-zinc-700 mb-2 block">
            検索キーワード
          </label>
          <div className="flex flex-wrap gap-1.5">
            {TVCM_SEARCH_KEYWORDS.map((kw) => {
              const active = selectedKeywords.includes(kw);
              return (
                <button
                  key={kw}
                  onClick={() => toggleKeyword(kw)}
                  className={`text-[11px] font-medium px-2.5 py-1 rounded-full border transition-all ${
                    active
                      ? "bg-rose-600 text-white border-rose-600"
                      : "bg-white text-zinc-600 border-zinc-200 hover:border-rose-300"
                  }`}
                >
                  {kw}
                </button>
              );
            })}
          </div>
        </div>

        {/* オプション */}
        <div className="grid grid-cols-2 gap-3 mb-4">
          <div>
            <label className="text-xs font-medium text-zinc-700 mb-1 block">
              キーワードあたり取得数
            </label>
            <input
              type="number"
              min={1}
              max={20}
              value={maxPerKeyword}
              onChange={(e) => setMaxPerKeyword(Number(e.target.value))}
              className="w-full text-xs border border-zinc-200 rounded-lg px-3 py-1.5"
            />
          </div>
          <div>
            <label className="text-xs font-medium text-zinc-700 mb-1 block">
              総取得上限
            </label>
            <input
              type="number"
              min={1}
              max={60}
              value={totalLimit}
              onChange={(e) => setTotalLimit(Number(e.target.value))}
              className="w-full text-xs border border-zinc-200 rounded-lg px-3 py-1.5"
            />
          </div>
        </div>

        {/* YouTube 固有オプション */}
        {(source === "youtube" || source === "both") && (
          <div className="grid grid-cols-2 gap-3 mb-4 bg-rose-50/40 border border-rose-100 rounded-lg p-3">
            <div>
              <label className="text-[11px] font-medium text-rose-800 mb-1 block">
                YouTube: チャンネル登録者数の上限
              </label>
              <input
                type="number"
                min={0}
                max={10000000}
                step={1000}
                value={maxSubscribers}
                onChange={(e) => setMaxSubscribers(Number(e.target.value))}
                className="w-full text-xs border border-rose-200 rounded-lg px-3 py-1.5 bg-white"
              />
              <p className="text-[10px] text-rose-700 mt-0.5">
                これより多いチャンネルは除外（中小判定）。0で無制限
              </p>
            </div>
            <div>
              <label className="text-[11px] font-medium text-rose-800 mb-1 block">
                YouTube: 直近何日以内の動画を対象に
              </label>
              <input
                type="number"
                min={1}
                max={365}
                value={publishedWithinDays}
                onChange={(e) => setPublishedWithinDays(Number(e.target.value))}
                className="w-full text-xs border border-rose-200 rounded-lg px-3 py-1.5 bg-white"
              />
              <p className="text-[10px] text-rose-700 mt-0.5">
                例: 60 → 直近60日にアップロードされた動画のみ
              </p>
            </div>
          </div>
        )}

        {/* フィルタ説明 */}
        <div className="bg-rose-50 border border-rose-200 rounded-lg p-3 mb-4">
          <p className="text-[11px] font-semibold text-rose-800 mb-1">
            自動除外フィルタ（営業対象から外す条件）
          </p>
          <ul className="text-[11px] text-rose-700 space-y-0.5 ml-4 list-disc">
            <li>大手代理店（電通・博報堂・ADK等）が言及されている案件</li>
            <li>上場企業（既にエージェンシー関係を持つ可能性）</li>
          </ul>
          <p className="text-[10px] text-rose-600 mt-1">
            ※ 全国対象（東京含む）。代表が結果を選別してプールに投入してください。
          </p>
        </div>

        <button
          onClick={handleCrawl}
          disabled={phase === "crawling" || selectedKeywords.length === 0}
          className="w-full bg-rose-600 hover:bg-rose-700 text-white font-medium text-sm py-2.5 rounded-lg flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {phase === "crawling" ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" />
              PR TIMES をクロール中...（最大3分）
            </>
          ) : (
            <>
              <Search className="w-4 h-4" />
              TVCM/動画PR 発表企業をクロール
            </>
          )}
        </button>
      </div>

      {/* エラー */}
      {phase === "error" && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-4 flex items-start gap-2">
          <AlertCircle className="w-4 h-4 text-red-600 mt-0.5 shrink-0" />
          <p className="text-xs text-red-700">{errorMsg}</p>
        </div>
      )}

      {/* 統計 */}
      {stats && (
        <div className="bg-white rounded-xl border border-zinc-200 p-4">
          <div className="grid grid-cols-4 gap-3 text-center">
            <div>
              <div className="text-[10px] text-zinc-500 mb-0.5">取得記事</div>
              <div className="text-lg font-bold text-zinc-900">{stats.fetched}</div>
            </div>
            <div>
              <div className="text-[10px] text-zinc-500 mb-0.5">AI抽出成功</div>
              <div className="text-lg font-bold text-zinc-900">{stats.extracted}</div>
            </div>
            <div>
              <div className="text-[10px] text-emerald-600 mb-0.5">営業候補</div>
              <div className="text-lg font-bold text-emerald-600">{stats.kept}</div>
            </div>
            <div>
              <div className="text-[10px] text-zinc-500 mb-0.5">フィルタ除外</div>
              <div className="text-lg font-bold text-zinc-400">{stats.excluded}</div>
            </div>
          </div>
        </div>
      )}

      {/* 結果テーブル */}
      {phase === "done" && (
        <>
          <TvcmResultsTable
            candidates={candidates}
            savedNames={savedNames}
            savingName={savingName}
            existingMap={existingMap}
            onSave={handleSave}
            onSaveAll={handleSaveAll}
          />

          {/* 除外候補（折りたたみ） */}
          {excludedResults.length > 0 && (
            <div className="bg-white rounded-xl border border-zinc-200 overflow-hidden">
              <button
                onClick={() => setShowExcluded((s) => !s)}
                className="w-full px-5 py-3 text-xs font-medium text-zinc-600 hover:bg-zinc-50 flex items-center justify-between"
              >
                <span>除外された {excludedResults.length} 件を表示</span>
                <span>{showExcluded ? "▲" : "▼"}</span>
              </button>
              {showExcluded && (
                <div className="divide-y divide-zinc-100 border-t border-zinc-100">
                  {excludedResults.map((r) => (
                    <div key={r.pressReleaseUrl} className="px-5 py-3">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-xs font-medium text-zinc-700">
                          {r.companyName || "（社名抽出失敗）"}
                        </span>
                        <span className="text-[10px] text-zinc-500">
                          {r.prefecture}
                        </span>
                        <span className="text-[10px] font-medium text-red-600 bg-red-50 px-1.5 py-0.5 rounded">
                          {r.exclusionReason}
                        </span>
                        <Link
                          href={r.pressReleaseUrl}
                          target="_blank"
                          className="text-[10px] text-blue-600 hover:underline ml-auto"
                        >
                          PR記事
                        </Link>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </>
      )}

      {phase === "done" && candidates.length === 0 && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 flex items-start gap-2">
          <Film className="w-4 h-4 text-amber-600 mt-0.5 shrink-0" />
          <p className="text-xs text-amber-800">
            条件に合致する企業が見つかりませんでした。キーワードを変更するか、上限値を増やしてお試しください。
          </p>
        </div>
      )}
    </div>
  );
}
