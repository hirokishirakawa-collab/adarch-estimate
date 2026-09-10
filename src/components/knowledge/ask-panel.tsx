"use client";

// 資料に聞く（出典つき）。sourceIds を渡すとその資料だけに絞る
import { useState } from "react";
import Link from "next/link";
import ReactMarkdown from "react-markdown";
import { Sparkles, Loader2, BookMarked } from "lucide-react";
import { OriginBadge } from "./origin-badge";
import type { AskResult, KnowledgeOrigin } from "./types";

interface Props {
  sourceIds?: string[];
  origin?: KnowledgeOrigin | "";
  placeholder?: string;
  compact?: boolean;
}

export function AskPanel({ sourceIds, origin, placeholder, compact }: Props) {
  const [q, setQ] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<AskResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const ask = async () => {
    const question = q.trim();
    if (question.length < 2 || loading) return;
    setLoading(true);
    setError(null);
    setResult(null);
    try {
      const res = await fetch("/api/knowledge/ask", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ question, sourceIds: sourceIds && sourceIds.length ? sourceIds : undefined, origin: origin || undefined }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "失敗しました");
      setResult(data as AskResult);
    } catch (e) {
      setError(e instanceof Error ? e.message : "失敗しました");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className={`rounded-xl border border-amber-200 bg-gradient-to-br from-amber-50/70 to-orange-50/40 ${compact ? "p-3" : "p-4"} space-y-3`}>
      <div className="flex items-center gap-2">
        <Sparkles className="w-4 h-4 text-amber-600" />
        <p className="text-sm font-bold text-zinc-800">資料に聞く</p>
        <p className="text-[11px] text-zinc-500">
          {sourceIds && sourceIds.length ? `選んだ${sourceIds.length}件の資料だけを読んで答えます` : "質問に合う資料をライブラリから選んで、出典つきで答えます"}
        </p>
      </div>
      <div className="flex gap-2">
        <textarea
          value={q}
          onChange={(e) => setQ(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) ask();
          }}
          rows={compact ? 2 : 3}
          placeholder={placeholder ?? "例: TVerの配信面は何がある？／この媒体の最小出稿額と入稿の締切は？／◯◯の資料で、うちの提案にそのまま使える仕組みはどれ？"}
          className="flex-1 rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-300"
        />
        <button
          onClick={ask}
          disabled={loading || q.trim().length < 2}
          className="self-end px-4 py-2 rounded-lg bg-amber-600 text-white text-sm font-bold hover:bg-amber-700 disabled:opacity-50 flex items-center gap-1.5"
        >
          {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
          聞く
        </button>
      </div>
      <p className="text-[10px] text-zinc-400">⌘/Ctrl + Enter でも送れます。他社・媒体の資料の価格は卸値として扱い、販売価格はOSの正本で確認します</p>

      {error && <p className="text-xs text-rose-600">{error}</p>}

      {result && (
        <div className="space-y-3">
          <div className="rounded-lg bg-white border border-zinc-200 p-4">
            <div className="prose prose-sm max-w-none prose-p:my-1.5 prose-li:my-0.5 text-zinc-800">
              <ReactMarkdown>{result.answer}</ReactMarkdown>
            </div>
          </div>
          {result.citations.length > 0 && (
            <div className="rounded-lg bg-white border border-zinc-200 p-3 space-y-1.5">
              <p className="text-[11px] font-bold text-zinc-600 flex items-center gap-1"><BookMarked className="w-3.5 h-3.5" /> 出典</p>
              {result.citations.map((c) => (
                <div key={c.n} className="text-[11px] text-zinc-600 flex gap-2">
                  <span className="font-mono font-bold text-amber-700 shrink-0">[{c.n}]</span>
                  <div className="min-w-0">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <OriginBadge origin={c.origin} size="xs" />
                      <Link href={`/dashboard/knowledge/${c.sourceId}`} className="font-medium text-zinc-800 hover:underline">{c.title}</Link>
                      {c.page != null && <span className="text-zinc-400">p.{c.page}</span>}
                    </div>
                    <p className="text-zinc-500 line-clamp-2">「{c.citedText}」</p>
                  </div>
                </div>
              ))}
            </div>
          )}
          {result.sources.length > 0 && (
            <p className="text-[10px] text-zinc-400">
              読んだ資料: {result.sources.map((s) => `${s.title}${s.truncated ? "（一部）" : ""}`).join(" / ")}
            </p>
          )}
        </div>
      )}
    </div>
  );
}
