"use client";

import { useState } from "react";
import { Sparkles, Loader2, TrendingUp } from "lucide-react";

type MatchResult = {
  companyName: string;
  matchScore: number;
  reason: string;
  collabIdea: string;
};

function ScoreBadge({ score }: { score: number }) {
  const color =
    score >= 80
      ? "bg-emerald-50 text-emerald-700 border-emerald-200"
      : score >= 60
        ? "bg-blue-50 text-blue-700 border-blue-200"
        : "bg-zinc-50 text-zinc-600 border-zinc-200";

  return (
    <span
      className={`inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-bold border ${color}`}
    >
      {score}%
    </span>
  );
}

export function MatchingPanel({ companyName }: { companyName: string }) {
  const [matches, setMatches] = useState<MatchResult[] | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function loadMatches() {
    setIsLoading(true);
    setError(null);

    try {
      const res = await fetch(
        `/api/business-cards/matching?company=${encodeURIComponent(companyName)}`
      );
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "マッチング取得に失敗しました");
      }
      const data = await res.json();
      setMatches(data);
    } catch (e) {
      setError(e instanceof Error ? e.message : "エラーが発生しました");
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <div className="bg-white rounded-xl border border-zinc-200 overflow-hidden">
      <div className="px-4 py-3 border-b border-zinc-100 bg-zinc-50/50">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <TrendingUp className="w-3.5 h-3.5 text-zinc-500" />
            <h3 className="text-xs font-semibold text-zinc-700">
              AI マッチング
            </h3>
          </div>
          {!matches && !isLoading && (
            <button
              onClick={loadMatches}
              className="inline-flex items-center gap-1 px-2.5 py-1 text-[10px] font-medium text-violet-700 bg-violet-50 border border-violet-200 rounded-lg hover:bg-violet-100 transition-colors"
            >
              <Sparkles className="w-3 h-3" />
              分析する
            </button>
          )}
        </div>
      </div>

      <div className="p-4">
        {isLoading && (
          <div className="flex items-center justify-center gap-2 py-6 text-zinc-400">
            <Loader2 className="w-4 h-4 animate-spin" />
            <span className="text-xs">AI がマッチング候補を分析中...</span>
          </div>
        )}

        {error && (
          <div className="text-center py-4">
            <p className="text-xs text-red-500">{error}</p>
            <button
              onClick={loadMatches}
              className="mt-2 text-[10px] text-blue-600 hover:underline"
            >
              再試行
            </button>
          </div>
        )}

        {matches && matches.length === 0 && (
          <p className="text-xs text-zinc-400 text-center py-4">
            マッチング候補が見つかりませんでした
          </p>
        )}

        {matches && matches.length > 0 && (
          <div className="space-y-3">
            {matches.map((match, i) => (
              <div
                key={i}
                className="p-3 rounded-lg border border-zinc-100 hover:border-zinc-200 transition-colors"
              >
                <div className="flex items-start justify-between gap-2 mb-1.5">
                  <p className="text-xs font-medium text-zinc-800">
                    {match.companyName}
                  </p>
                  <ScoreBadge score={match.matchScore} />
                </div>
                <p className="text-[11px] text-zinc-500">{match.reason}</p>
                <div className="mt-2 px-2.5 py-1.5 rounded bg-violet-50 border border-violet-100">
                  <p className="text-[10px] font-medium text-violet-500 uppercase tracking-wide mb-0.5">
                    コラボ案
                  </p>
                  <p className="text-[11px] text-violet-700">
                    {match.collabIdea}
                  </p>
                </div>
              </div>
            ))}
          </div>
        )}

        {!matches && !isLoading && !error && (
          <p className="text-xs text-zinc-400 text-center py-4">
            「分析する」ボタンでAIマッチングを実行します
          </p>
        )}
      </div>
    </div>
  );
}
