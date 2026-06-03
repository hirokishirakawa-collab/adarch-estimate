"use client";

import { useState, useCallback } from "react";
import { Loader2, AlertCircle, Search, Filter, Film, Youtube, FileText, Layers, Newspaper, Globe } from "lucide-react";
import {
  TVCM_SEARCH_KEYWORDS,
  type TvcmLeadCandidate,
  type TvcmLeadResult,
} from "@/lib/constants/tvcm-leads";
import { TvcmResultsTable } from "./tvcm-results-table";
import { saveTvcmLeadsFromSearch } from "@/lib/actions/lead";

type Phase = "form" | "crawling" | "done" | "error";
type Source = "youtube" | "prtimes" | "atpress" | "both" | "all";

interface CrawlStats {
  fetched: number;
  extracted: number;
  kept: number;
  excluded: number;
  hidden?: number; // 直近に判断済みで除外した件数
  filteredIndividual?: number; // 個人・個人YouTubeとして非表示にした件数
  filteredAlreadyPicked?: number; // 既にピックアップ済として非表示にした件数
  youtubeRaw?: number;
  youtubeRateLimited?: boolean;
  prTimesRaw?: number;
  atPressRaw?: number;
  aiAttempts?: number;
  aiApiErrors?: number;
  aiNoToolBlock?: number;
  aiEmptyCompany?: number;
  aiSuccess?: number;
}

function clampInt(raw: string, min: number, max: number, fallback: number): number {
  const n = parseInt(raw, 10);
  if (Number.isNaN(n)) return fallback;
  return Math.min(max, Math.max(min, n));
}

const SOURCE_OPTIONS: { value: Source; label: string; icon: typeof Youtube; desc: string }[] = [
  { value: "youtube", label: "YouTube", icon: Youtube, desc: "中小企業特化（登録者5万以下フィルタ）" },
  { value: "prtimes", label: "PR TIMES", icon: FileText, desc: "プレスリリース系（大手寄り）" },
  { value: "atpress", label: "@Press", icon: Newspaper, desc: "中小・地方寄りのリリース" },
  { value: "all", label: "全部", icon: Globe, desc: "3ソース全体。APIコスト最大" },
];

export function TvcmSearchPanel() {
  const [phase, setPhase] = useState<Phase>("form");
  const [source, setSource] = useState<Source>("all");
  const [selectedKeywords, setSelectedKeywords] = useState<string[]>(
    Array.from(TVCM_SEARCH_KEYWORDS).slice(0, 4),
  );
  const [maxPerKeyword, setMaxPerKeyword] = useState(15);
  const [totalLimit, setTotalLimit] = useState(30);
  const [maxSubscribers, setMaxSubscribers] = useState(50000);
  const [publishedWithinDays, setPublishedWithinDays] = useState(60);
  const [hideRecentlyDecidedDays, setHideRecentlyDecidedDays] = useState(30);

  // 配布モデル: 全候補（除外含む）をフラットに表示。代表が個別に「プール投入」「却下」を判定する
  const [allResults, setAllResults] = useState<TvcmLeadResult[]>([]);
  const [stats, setStats] = useState<CrawlStats | null>(null);
  const [errorMsg, setErrorMsg] = useState("");

  // companyName → 決定（"pool" or "reject"）。サーバー側成功時のみ記録
  const [decidedMap, setDecidedMap] = useState<Map<string, "pool" | "reject">>(new Map());
  const [decidingName, setDecidingName] = useState<string | null>(null);

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
    setAllResults([]);
    setDecidedMap(new Map());
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
          hideRecentlyDecidedDays,
        }),
      });

      if (!res.ok) {
        const err = await res.json();
        const base = err.error || "クロール中にエラーが発生しました";
        const detail =
          Array.isArray(err.details) && err.details.length > 0
            ? `\n${err.details.join("\n")}`
            : "";
        throw new Error(`${base}${detail}`);
      }

      const data = (await res.json()) as {
        candidates: TvcmLeadResult[]; // フィルタ通過分（実質的に全件）
        results: TvcmLeadResult[]; // 全件
        stats: CrawlStats;
        message?: string;
      };

      // 配布モデル: 全候補をフラットに表示（DB状態はcrawl APIで付与済み）
      setAllResults(data.results);
      setStats(data.stats);
      setPhase("done");
    } catch (err) {
      const msg = err instanceof Error ? err.message : "クロール中にエラーが発生しました";
      setErrorMsg(msg);
      setPhase("error");
    }
  }, [source, selectedKeywords, maxPerKeyword, totalLimit, maxSubscribers, publishedWithinDays, hideRecentlyDecidedDays]);

  const handlePool = useCallback(async (c: TvcmLeadCandidate) => {
    setDecidingName(c.companyName);
    try {
      const result = await saveTvcmLeadsFromSearch([c], "pool");
      if (result.error) {
        alert(result.error);
      } else {
        setDecidedMap((prev) => new Map(prev).set(c.companyName, "pool"));
      }
    } finally {
      setDecidingName(null);
    }
  }, []);

  const handleReject = useCallback(async (c: TvcmLeadCandidate) => {
    setDecidingName(c.companyName);
    try {
      const result = await saveTvcmLeadsFromSearch([c], "reject");
      if (result.error) {
        alert(result.error);
      } else {
        setDecidedMap((prev) => new Map(prev).set(c.companyName, "reject"));
      }
    } finally {
      setDecidingName(null);
    }
  }, []);

  const handlePoolAll = useCallback(async () => {
    const undecided = allResults.filter((c) => !decidedMap.has(c.companyName));
    if (undecided.length === 0) return;
    if (!confirm(`未判定の${undecided.length}件を全てプールに投入します。よろしいですか？\n（却下したい案件があれば先に個別に却下してください）`)) return;

    setDecidingName("__bulk__");
    try {
      const result = await saveTvcmLeadsFromSearch(undecided, "pool");
      if (result.error) {
        alert(result.error);
      } else {
        setDecidedMap((prev) => {
          const next = new Map(prev);
          for (const c of undecided) next.set(c.companyName, "pool");
          return next;
        });
      }
    } finally {
      setDecidingName(null);
    }
  }, [allResults, decidedMap]);

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
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
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
              onChange={(e) => setMaxPerKeyword(clampInt(e.target.value, 1, 20, 8))}
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
              onChange={(e) => setTotalLimit(clampInt(e.target.value, 1, 60, 30))}
              className="w-full text-xs border border-zinc-200 rounded-lg px-3 py-1.5"
            />
          </div>
        </div>

        {/* YouTube 固有オプション */}
        {(source === "youtube" || source === "both" || source === "all") && (
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
                onChange={(e) => setMaxSubscribers(clampInt(e.target.value, 0, 10000000, 50000))}
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
                onChange={(e) => setPublishedWithinDays(clampInt(e.target.value, 1, 365, 60))}
                className="w-full text-xs border border-rose-200 rounded-lg px-3 py-1.5 bg-white"
              />
              <p className="text-[10px] text-rose-700 mt-0.5">
                例: 60 → 直近60日にアップロードされた動画のみ
              </p>
            </div>
          </div>
        )}

        {/* 判断済みリードの除外日数（全ソース共通） */}
        <div className="grid grid-cols-2 gap-3 mb-4">
          <div>
            <label className="text-[11px] font-medium text-zinc-700 mb-1 block">
              判断済みリードを除外（過去何日）
            </label>
            <input
              type="number"
              min={0}
              max={365}
              value={hideRecentlyDecidedDays}
              onChange={(e) => setHideRecentlyDecidedDays(clampInt(e.target.value, 0, 365, 30))}
              className="w-full text-xs border border-zinc-300 rounded-lg px-3 py-1.5 bg-white"
            />
            <p className="text-[10px] text-zinc-500 mt-0.5">
              プール投入／却下／claim／受注を行った企業を除外。0で無効化。既定30日
            </p>
          </div>
        </div>


        {/* 警告フラグ説明 */}
        <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 mb-4">
          <p className="text-[11px] font-semibold text-amber-800 mb-1">
            警告バッジが付く条件（自動除外はせず、代表の判断材料として表示）
          </p>
          <ul className="text-[11px] text-amber-700 space-y-0.5 ml-4 list-disc">
            <li>大手代理店（電通・博報堂・ADK等）が言及されている案件</li>
            <li>上場企業（既にエージェンシー関係を持つ可能性）</li>
          </ul>
          <p className="text-[10px] text-amber-600 mt-1">
            ※ 全国対象（東京含む）。全候補をリスト表示し、代表が「プール投入」または「却下」を選択してください。
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
              クロール中...（最大3分）
            </>
          ) : (
            <>
              <Search className="w-4 h-4" />
              動画コンテンツ発表企業をクロール（TVer広告案件抽出）
            </>
          )}
        </button>
      </div>

      {/* エラー */}
      {phase === "error" && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-4 flex items-start gap-2">
          <AlertCircle className="w-4 h-4 text-red-600 mt-0.5 shrink-0" />
          <p className="text-xs text-red-700 whitespace-pre-line">{errorMsg}</p>
        </div>
      )}

      {/* 統計 */}
      {stats && (
        <div className="bg-white rounded-xl border border-zinc-200 p-4 space-y-3">
          {/* YouTube がレート/クォータ上限で落ちた日は明示警告（プールが痩せる主因） */}
          {stats.youtubeRateLimited && (
            <div className="rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 text-xs text-amber-800">
              ⚠️ YouTubeソースがレート/クォータ上限（429）で取得0件です。今回の候補はPR
              TIMES/@Pressのみ。恒久対策はGoogle Cloud ConsoleでYouTube Data APIのクォータ増枠。
            </div>
          )}
          {/* ソース別の生フェッチ数（切り分け診断用） */}
          {(stats.youtubeRaw !== undefined || stats.prTimesRaw !== undefined || stats.atPressRaw !== undefined) && (
            <div className="grid grid-cols-3 gap-3 text-center pb-3 border-b border-zinc-100">
              <div>
                <div className="text-[10px] text-zinc-500 mb-0.5">YouTube 生取得</div>
                <div className="text-base font-semibold text-zinc-700">{stats.youtubeRaw ?? "-"}</div>
              </div>
              <div>
                <div className="text-[10px] text-zinc-500 mb-0.5">PR TIMES 生取得</div>
                <div className="text-base font-semibold text-zinc-700">{stats.prTimesRaw ?? "-"}</div>
              </div>
              <div>
                <div className="text-[10px] text-zinc-500 mb-0.5">@Press 生取得</div>
                <div className="text-base font-semibold text-zinc-700">{stats.atPressRaw ?? "-"}</div>
              </div>
            </div>
          )}

          {/* AI呼び出し診断（切り分け用） */}
          {stats.aiAttempts !== undefined && (
            <div className="grid grid-cols-5 gap-2 text-center pb-3 border-b border-zinc-100">
              <div>
                <div className="text-[10px] text-zinc-500 mb-0.5">AI試行</div>
                <div className="text-sm font-semibold text-zinc-700">{stats.aiAttempts}</div>
              </div>
              <div>
                <div className="text-[10px] text-emerald-600 mb-0.5">成功</div>
                <div className="text-sm font-semibold text-emerald-700">{stats.aiSuccess ?? 0}</div>
              </div>
              <div>
                <div className="text-[10px] text-red-500 mb-0.5">APIエラー</div>
                <div className="text-sm font-semibold text-red-600">{stats.aiApiErrors ?? 0}</div>
              </div>
              <div>
                <div className="text-[10px] text-amber-500 mb-0.5">tool未返答</div>
                <div className="text-sm font-semibold text-amber-600">{stats.aiNoToolBlock ?? 0}</div>
              </div>
              <div>
                <div className="text-[10px] text-zinc-400 mb-0.5">企業名空</div>
                <div className="text-sm font-semibold text-zinc-500">{stats.aiEmptyCompany ?? 0}</div>
              </div>
            </div>
          )}

          {/* AI判定後のサマリー */}
          <div className="grid grid-cols-4 gap-3 text-center">
            <div>
              <div className="text-[10px] text-zinc-500 mb-0.5">最終候補</div>
              <div className="text-lg font-bold text-zinc-900">{stats.fetched}</div>
            </div>
            <div>
              <div className="text-[10px] text-zinc-500 mb-0.5">重複排除後</div>
              <div className="text-lg font-bold text-zinc-900">{stats.extracted}</div>
            </div>
            <div>
              <div className="text-[10px] text-amber-600 mb-0.5">警告付き候補</div>
              <div className="text-lg font-bold text-amber-600">{stats.excluded}</div>
            </div>
            <div title="プール／却下／claim 等で判断済みのリードを直近N日分除外">
              <div className="text-[10px] text-blue-500 mb-0.5">判断済み除外</div>
              <div className="text-lg font-bold text-blue-600">{stats.hidden ?? 0}</div>
            </div>
          </div>

          {/* 本部調整での非表示件数（個人 / 既にピックアップ済） */}
          {((stats.filteredIndividual ?? 0) > 0 || (stats.filteredAlreadyPicked ?? 0) > 0) && (
            <div className="grid grid-cols-2 gap-3 text-center pt-3 border-t border-zinc-100">
              <div title="個人クリエイター・個人YouTubeとして自動非表示にした件数">
                <div className="text-[10px] text-zinc-500 mb-0.5">個人 / 個人YouTube 非表示</div>
                <div className="text-base font-semibold text-zinc-700">{stats.filteredIndividual ?? 0}</div>
              </div>
              <div title="既存リードでステータスが CRAWLED 以外（本部か加盟者が既に触れた会社）を非表示">
                <div className="text-[10px] text-zinc-500 mb-0.5">既にピックアップ済 非表示</div>
                <div className="text-base font-semibold text-zinc-700">{stats.filteredAlreadyPicked ?? 0}</div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* 結果テーブル（全候補をフラットに表示） */}
      {phase === "done" && (
        <TvcmResultsTable
          candidates={allResults}
          decidedMap={decidedMap}
          decidingName={decidingName}
          onPool={handlePool}
          onReject={handleReject}
          onPoolAll={handlePoolAll}
        />
      )}

      {phase === "done" && allResults.length === 0 && (
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
