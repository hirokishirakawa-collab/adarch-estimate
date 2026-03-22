"use client";

import { useState } from "react";
import { Sparkles, Link2, Loader2, Check, ChevronDown, ChevronUp } from "lucide-react";

type AnalysisResult = {
  id: string;
  nm: string;
  ind: string;
  taste: string;
  pf: string[];
  dur: string;
  desc: string;
  st: { l: string; d: string; c: string }[];
  telops: string[];
  rtlp: string;
  telop_analysis: {
    main_style: string;
    position: string;
    font_style: string;
    color: string;
    background: string;
    animation: string;
  };
  shooting_tips: string;
  hook_technique: string;
  source_url: string;
  source_duration: number;
  source_resolution: string;
  cut_points: number[];
};

export function VideoAnalyzer() {
  const [url, setUrl] = useState("");
  const [analyzing, setAnalyzing] = useState(false);
  const [result, setResult] = useState<AnalysisResult | null>(null);
  const [error, setError] = useState("");
  const [saved, setSaved] = useState(false);
  const [expanded, setExpanded] = useState(true);

  async function handleAnalyze() {
    if (!url.trim()) return;
    setAnalyzing(true);
    setError("");
    setResult(null);
    setSaved(false);

    try {
      const res = await fetch("/api/studio/sns-formats/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: url.trim() }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "解析に失敗しました");
      } else {
        setResult(data);
      }
    } catch {
      setError("通信エラーが発生しました");
    } finally {
      setAnalyzing(false);
    }
  }

  async function handleSaveFormat() {
    if (!result) return;
    try {
      const res = await fetch("/api/studio/sns-formats/order", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          formatId: result.id,
          formatName: `[参考] ${result.nm}`,
          telopId: result.rtlp,
          industry: result.ind,
          taste: result.taste,
          duration: result.dur,
          platforms: result.pf.join(","),
          structure: result.st,
        }),
      });
      if (res.ok) {
        setSaved(true);
      }
    } catch {
      // silently fail
    }
  }

  return (
    <div data-tour="sns-format-analyzer" className="bg-gradient-to-r from-indigo-50 to-fuchsia-50 rounded-xl border border-indigo-200 mb-6 overflow-hidden">
      {/* Header - always visible */}
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full px-5 py-4 flex items-center justify-between hover:bg-white/30 transition"
      >
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 bg-gradient-to-br from-indigo-500 to-fuchsia-500 rounded-lg flex items-center justify-center">
            <Sparkles className="w-4 h-4 text-white" />
          </div>
          <div className="text-left">
            <div className="text-sm font-bold text-zinc-900">参考動画からフォーマットを作成</div>
            <div className="text-xs text-zinc-500">Instagram / TikTokのURLを貼るだけで、構成・テロップ・撮影依頼書を自動生成</div>
          </div>
        </div>
        {expanded ? <ChevronUp className="w-4 h-4 text-zinc-400" /> : <ChevronDown className="w-4 h-4 text-zinc-400" />}
      </button>

      {/* Expandable body */}
      {expanded && (
        <div className="px-5 pb-5 space-y-4">
          {/* URL Input */}
          <div className="flex gap-2">
            <div className="flex-1 relative">
              <Link2 className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-400" />
              <input
                type="url"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                placeholder="https://www.instagram.com/reel/... or TikTok URL"
                className="w-full pl-10 pr-4 py-3 rounded-lg border border-zinc-300 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400 focus:border-transparent"
                onKeyDown={(e) => e.key === "Enter" && handleAnalyze()}
              />
            </div>
            <button
              onClick={handleAnalyze}
              disabled={analyzing || !url.trim()}
              className="px-6 py-3 bg-gradient-to-r from-indigo-600 to-fuchsia-600 text-white text-sm font-semibold rounded-lg hover:from-indigo-700 hover:to-fuchsia-700 disabled:opacity-50 transition flex items-center gap-2 whitespace-nowrap"
            >
              {analyzing ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  解析中...
                </>
              ) : (
                <>
                  <Sparkles className="w-4 h-4" />
                  解析する
                </>
              )}
            </button>
          </div>

          {/* Progress indicator */}
          {analyzing && (
            <div className="bg-white rounded-lg border p-4 space-y-2">
              <div className="flex items-center gap-2 text-xs text-zinc-500">
                <Loader2 className="w-3 h-3 animate-spin" />
                動画をダウンロード → シーン検出 → フレーム抽出 → AI解析中...
              </div>
              <div className="w-full h-1.5 bg-zinc-100 rounded-full overflow-hidden">
                <div className="h-full bg-gradient-to-r from-indigo-500 to-fuchsia-500 rounded-full animate-pulse" style={{ width: "60%" }} />
              </div>
              <div className="text-xs text-zinc-400">通常30〜60秒かかります</div>
            </div>
          )}

          {/* Error */}
          {error && (
            <div className="bg-red-50 border border-red-200 rounded-lg px-4 py-3 text-sm text-red-700">
              {error}
            </div>
          )}

          {/* Result */}
          {result && (
            <div className="bg-white rounded-xl border shadow-sm overflow-hidden">
              {/* Result header */}
              <div className="bg-gradient-to-r from-indigo-500 to-fuchsia-500 px-5 py-4 text-white">
                <div className="text-lg font-bold">{result.nm}</div>
                <div className="text-sm text-white/70 mt-1">{result.desc}</div>
                <div className="flex gap-2 mt-2">
                  <span className="text-xs bg-white/20 px-2 py-0.5 rounded">{result.dur}</span>
                  <span className="text-xs bg-white/20 px-2 py-0.5 rounded">{result.ind}</span>
                  <span className="text-xs bg-white/20 px-2 py-0.5 rounded">{result.taste}</span>
                  {result.pf.map((p) => (
                    <span key={p} className="text-xs bg-white/20 px-2 py-0.5 rounded">{p}</span>
                  ))}
                </div>
              </div>

              <div className="p-5 space-y-5">
                {/* Timeline */}
                <div>
                  <h3 className="text-xs font-semibold text-zinc-400 uppercase tracking-wider mb-2">構成タイムライン</h3>
                  <div className="flex gap-0.5 rounded-lg overflow-hidden h-12">
                    {result.st.map((s, i) => (
                      <div key={i} className="flex flex-col items-center justify-center px-2" style={{ flex: parseFloat(s.d), background: s.c }}>
                        <span className="text-[10px] font-semibold text-white/90 whitespace-nowrap">{s.l}</span>
                        <span className="text-[9px] text-white/50">{s.d}</span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Telop analysis */}
                <div>
                  <h3 className="text-xs font-semibold text-zinc-400 uppercase tracking-wider mb-2">テロップ分析</h3>
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                    {[
                      ["スタイル", result.telop_analysis.main_style],
                      ["配置", result.telop_analysis.position],
                      ["フォント", result.telop_analysis.font_style],
                      ["カラー", result.telop_analysis.color],
                      ["背景", result.telop_analysis.background],
                      ["アニメーション", result.telop_analysis.animation],
                    ].map(([label, value]) => (
                      <div key={label} className="bg-zinc-50 rounded-lg p-3">
                        <div className="text-[10px] text-zinc-400 mb-0.5">{label}</div>
                        <div className="text-xs text-zinc-700 font-medium">{value}</div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Recommended telops */}
                <div>
                  <h3 className="text-xs font-semibold text-zinc-400 uppercase tracking-wider mb-2">推奨テロップスタイル</h3>
                  <div className="flex gap-2 flex-wrap">
                    {result.telops.map((t) => (
                      <span key={t} className={`text-xs px-3 py-1.5 rounded-lg border ${t === result.rtlp ? "bg-fuchsia-50 border-fuchsia-300 text-fuchsia-700 font-medium" : "bg-zinc-50 border-zinc-200 text-zinc-600"}`}>
                        {t.replace(/_/g, " ")}
                      </span>
                    ))}
                  </div>
                </div>

                {/* Hook & Tips */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div className="bg-amber-50 border border-amber-200 rounded-lg p-3">
                    <div className="text-[10px] font-semibold text-amber-600 uppercase mb-1">フック技法</div>
                    <div className="text-xs text-amber-800">{result.hook_technique}</div>
                  </div>
                  <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
                    <div className="text-[10px] font-semibold text-blue-600 uppercase mb-1">撮影のコツ</div>
                    <div className="text-xs text-blue-800">{result.shooting_tips}</div>
                  </div>
                </div>

                {/* Source info */}
                <div className="text-xs text-zinc-400 flex items-center gap-4">
                  <span>元動画: {result.source_duration.toFixed(1)}秒</span>
                  <span>{result.source_resolution}</span>
                  <span>カット数: {result.cut_points.length - 1}</span>
                </div>

                {/* Actions */}
                <div className="flex gap-3 pt-2 border-t">
                  <button
                    onClick={handleSaveFormat}
                    disabled={saved}
                    className={`flex-1 py-3 rounded-xl font-semibold text-sm transition flex items-center justify-center gap-2 ${
                      saved
                        ? "bg-green-50 text-green-700 border border-green-200"
                        : "bg-gradient-to-r from-indigo-600 to-fuchsia-600 text-white hover:from-indigo-700 hover:to-fuchsia-700"
                    }`}
                  >
                    {saved ? (
                      <>
                        <Check className="w-4 h-4" />
                        フォーマット登録済み
                      </>
                    ) : (
                      "このフォーマットを登録して使う"
                    )}
                  </button>
                  <button
                    onClick={() => {
                      const text = `【解析フォーマット】${result.nm}\n尺: ${result.dur}\n構成: ${result.st.map(s => `${s.l}(${s.d})`).join(" → ")}\nテロップ: ${result.rtlp}\nフック: ${result.hook_technique}\n撮影Tips: ${result.shooting_tips}\n元動画: ${result.source_url}`;
                      navigator.clipboard.writeText(text);
                    }}
                    className="px-4 py-3 rounded-xl border border-zinc-300 text-zinc-600 text-sm font-medium hover:bg-zinc-50 transition"
                  >
                    コピー
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
