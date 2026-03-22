"use client";

import { useState, useEffect, useCallback } from "react";
import { Sparkles, Link2, Loader2, Check, ChevronDown, ChevronUp, ExternalLink, Eye, Calendar, ArrowUpDown, Copy } from "lucide-react";

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
  savedId?: string;
};

type HistoryItem = {
  id: string;
  sourceUrl: string;
  sourceViews: number | null;
  sourceDuration: number | null;
  title: string;
  description: string | null;
  industry: string;
  taste: string;
  duration: string;
  platforms: string;
  structure: any;
  recommendedTelops: string | null;
  hookTechnique: string | null;
  shootingTips: string | null;
  createdAt: string;
  createdBy: { name: string | null } | null;
};

type SortKey = "createdAt" | "sourceViews" | "title";

export function VideoAnalyzer() {
  const [url, setUrl] = useState("");
  const [sourceViews, setSourceViews] = useState("");
  const [analyzing, setAnalyzing] = useState(false);
  const [result, setResult] = useState<AnalysisResult | null>(null);
  const [error, setError] = useState("");
  const [expanded, setExpanded] = useState(true);

  // History
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [showHistory, setShowHistory] = useState(false);
  const [sortKey, setSortKey] = useState<SortKey>("createdAt");
  const [sortAsc, setSortAsc] = useState(false);

  const loadHistory = useCallback(async () => {
    try {
      const res = await fetch("/api/studio/sns-formats/analyze");
      if (res.ok) {
        const data = await res.json();
        setHistory(data);
      }
    } catch { /* ignore */ }
  }, []);

  useEffect(() => { loadHistory(); }, [loadHistory]);

  async function handleAnalyze() {
    if (!url.trim()) return;
    setAnalyzing(true);
    setError("");
    setResult(null);

    try {
      const res = await fetch("/api/studio/sns-formats/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: url.trim(), sourceViews: sourceViews || null }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "解析に失敗しました");
        if (data.detail) setError((prev) => prev + "\n" + data.detail);
      } else {
        setResult(data);
        loadHistory(); // Refresh history
      }
    } catch {
      setError("通信エラーが発生しました");
    } finally {
      setAnalyzing(false);
    }
  }

  function genClaudeCommand(item: HistoryItem | AnalysisResult) {
    const st = "st" in item ? item.st : (item.structure as any[]);
    const telop = "rtlp" in item ? item.rtlp : (item.recommendedTelops?.split(",")[0] || "solid_white");
    const title = "nm" in item ? item.nm : item.title;
    const dur = "dur" in item ? item.dur : item.duration;
    const structure = st.map((s: any) => `${s.l || s.label}(${s.d || s.duration})`).join(" → ");

    return `SNSフォーマット自動編集を実行してください。

【フォーマット情報】
・名前: ${title}
・業種: ${"ind" in item ? item.ind : item.industry}
・尺: ${dur}
・構成: ${structure}
・テロップスタイル: ${telop}
${"source_url" in item ? `・参考動画: ${item.source_url}` : `・参考動画: ${item.sourceUrl}`}

【実行手順】
1. 素材フォルダ内のメディアをPremiere Proにインポート
2. シーケンス「${title}」を作成
3. 以下の構成でクリップを配置:
${st.map((s: any, i: number) => `   ${i + 1}. ${s.l || s.label} — ${s.d || s.duration}`).join("\n")}
4. テロップスタイル「${telop}」でテロップを配置
5. マーカーを各セクション区切りに追加
6. BGMを配置

素材フォルダ: （ここに素材パスを入力）`;
  }

  const sortedHistory = [...history].sort((a, b) => {
    const dir = sortAsc ? 1 : -1;
    if (sortKey === "createdAt") return dir * (new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
    if (sortKey === "sourceViews") return dir * ((a.sourceViews || 0) - (b.sourceViews || 0));
    return dir * a.title.localeCompare(b.title);
  });

  function toggleSort(key: SortKey) {
    if (sortKey === key) { setSortAsc(!sortAsc); }
    else { setSortKey(key); setSortAsc(false); }
  }

  return (
    <div data-tour="sns-format-analyzer" className="bg-gradient-to-r from-indigo-50 to-fuchsia-50 rounded-xl border border-indigo-200 mb-6 overflow-hidden">
      {/* Header */}
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
        <div className="flex items-center gap-2">
          {history.length > 0 && (
            <span className="text-xs bg-indigo-100 text-indigo-600 px-2 py-0.5 rounded-full font-medium">{history.length}件の履歴</span>
          )}
          {expanded ? <ChevronUp className="w-4 h-4 text-zinc-400" /> : <ChevronDown className="w-4 h-4 text-zinc-400" />}
        </div>
      </button>

      {expanded && (
        <div className="px-5 pb-5 space-y-4">
          {/* URL Input + Views */}
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
            <div className="w-32 relative">
              <Eye className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-400" />
              <input
                type="number"
                value={sourceViews}
                onChange={(e) => setSourceViews(e.target.value)}
                placeholder="再生数"
                className="w-full pl-10 pr-2 py-3 rounded-lg border border-zinc-300 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400 focus:border-transparent"
              />
            </div>
            <button
              onClick={handleAnalyze}
              disabled={analyzing || !url.trim()}
              className="px-6 py-3 bg-gradient-to-r from-indigo-600 to-fuchsia-600 text-white text-sm font-semibold rounded-lg hover:from-indigo-700 hover:to-fuchsia-700 disabled:opacity-50 transition flex items-center gap-2 whitespace-nowrap"
            >
              {analyzing ? <><Loader2 className="w-4 h-4 animate-spin" /> 解析中...</> : <><Sparkles className="w-4 h-4" /> 解析する</>}
            </button>
          </div>

          {/* Progress */}
          {analyzing && (
            <div className="bg-white rounded-lg border p-4 space-y-2">
              <div className="flex items-center gap-2 text-xs text-zinc-500">
                <Loader2 className="w-3 h-3 animate-spin" />
                動画ダウンロード → シーン検出 → フレーム抽出 → AI解析中...
              </div>
              <div className="w-full h-1.5 bg-zinc-100 rounded-full overflow-hidden">
                <div className="h-full bg-gradient-to-r from-indigo-500 to-fuchsia-500 rounded-full animate-pulse" style={{ width: "60%" }} />
              </div>
              <div className="text-xs text-zinc-400">30〜60秒ほどかかります</div>
            </div>
          )}

          {/* Error */}
          {error && (
            <div className="bg-red-50 border border-red-200 rounded-lg px-4 py-3 text-sm text-red-700 whitespace-pre-wrap">
              {error}
            </div>
          )}

          {/* Result */}
          {result && (
            <div className="bg-white rounded-xl border shadow-sm overflow-hidden">
              <div className="bg-gradient-to-r from-indigo-500 to-fuchsia-500 px-5 py-4 text-white">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="text-lg font-bold">{result.nm}</div>
                    <div className="text-sm text-white/70 mt-1">{result.desc}</div>
                  </div>
                  <div className="flex items-center gap-1 text-xs text-white/60">
                    <Check className="w-3 h-3" /> 自動保存済み
                  </div>
                </div>
                <div className="flex gap-2 mt-2">
                  <span className="text-xs bg-white/20 px-2 py-0.5 rounded">{result.dur}</span>
                  <span className="text-xs bg-white/20 px-2 py-0.5 rounded">{result.ind}</span>
                  <span className="text-xs bg-white/20 px-2 py-0.5 rounded">{result.taste}</span>
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
                {/* Telop + Hook + Tips */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  <div className="bg-zinc-50 rounded-lg border p-3">
                    <div className="text-[10px] font-semibold text-zinc-400 uppercase mb-1">テロップスタイル</div>
                    <div className="text-xs text-zinc-700">{result.telop_analysis.main_style}</div>
                  </div>
                  <div className="bg-amber-50 rounded-lg border border-amber-200 p-3">
                    <div className="text-[10px] font-semibold text-amber-600 uppercase mb-1">フック技法</div>
                    <div className="text-xs text-amber-800">{result.hook_technique}</div>
                  </div>
                  <div className="bg-blue-50 rounded-lg border border-blue-200 p-3">
                    <div className="text-[10px] font-semibold text-blue-600 uppercase mb-1">撮影のコツ</div>
                    <div className="text-xs text-blue-800">{result.shooting_tips}</div>
                  </div>
                </div>
                {/* Command */}
                <div className="bg-zinc-900 rounded-lg p-4">
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2 text-xs text-emerald-400 font-semibold">
                      <span className="w-2 h-2 bg-emerald-400 rounded-full" /> 制作コマンド
                    </div>
                    <button
                      onClick={() => { navigator.clipboard.writeText(genClaudeCommand(result)); }}
                      className="text-xs bg-emerald-500 text-white px-3 py-1 rounded hover:bg-emerald-400 transition flex items-center gap-1"
                    >
                      <Copy className="w-3 h-3" /> コピー
                    </button>
                  </div>
                  <div className="font-mono text-[11px] text-emerald-300/70 max-h-32 overflow-y-auto whitespace-pre-wrap leading-relaxed">
                    {genClaudeCommand(result)}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* History */}
          {history.length > 0 && (
            <div>
              <button
                onClick={() => setShowHistory(!showHistory)}
                className="flex items-center gap-2 text-xs font-semibold text-indigo-600 hover:text-indigo-700 transition"
              >
                <Calendar className="w-3 h-3" />
                解析履歴（{history.length}件）
                {showHistory ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
              </button>

              {showHistory && (
                <div className="mt-3 bg-white rounded-xl border overflow-hidden">
                  {/* Sort controls */}
                  <div className="flex items-center gap-1 px-4 py-2 border-b bg-zinc-50 text-xs">
                    <span className="text-zinc-400 mr-2">並び替え:</span>
                    {([["createdAt", "登録日"], ["sourceViews", "再生数"], ["title", "名前"]] as [SortKey, string][]).map(([key, label]) => (
                      <button
                        key={key}
                        onClick={() => toggleSort(key)}
                        className={`px-2 py-1 rounded transition flex items-center gap-1 ${sortKey === key ? "bg-indigo-100 text-indigo-700 font-medium" : "text-zinc-500 hover:bg-zinc-100"}`}
                      >
                        {label}
                        {sortKey === key && <ArrowUpDown className="w-3 h-3" />}
                      </button>
                    ))}
                  </div>
                  {/* History list */}
                  <div className="divide-y max-h-80 overflow-y-auto">
                    {sortedHistory.map((item) => (
                      <div key={item.id} className="px-4 py-3 hover:bg-zinc-50 transition group">
                        <div className="flex items-center justify-between">
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                              <span className="text-sm font-medium text-zinc-900 truncate">{item.title}</span>
                              <span className="text-[10px] px-1.5 py-0.5 rounded bg-zinc-100 text-zinc-500">{item.industry}</span>
                              <span className="text-[10px] px-1.5 py-0.5 rounded bg-zinc-100 text-zinc-500">{item.duration}</span>
                            </div>
                            <div className="flex items-center gap-3 mt-1 text-xs text-zinc-400">
                              <span className="flex items-center gap-1">
                                <Calendar className="w-3 h-3" />
                                {new Date(item.createdAt).toLocaleDateString("ja-JP")}
                              </span>
                              {item.sourceViews && (
                                <span className="flex items-center gap-1">
                                  <Eye className="w-3 h-3" />
                                  {item.sourceViews.toLocaleString()}再生
                                </span>
                              )}
                              <a
                                href={item.sourceUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="flex items-center gap-1 text-indigo-500 hover:text-indigo-600"
                                onClick={(e) => e.stopPropagation()}
                              >
                                <ExternalLink className="w-3 h-3" />
                                元動画
                              </a>
                              {item.createdBy?.name && (
                                <span>{item.createdBy.name}</span>
                              )}
                            </div>
                          </div>
                          <button
                            onClick={() => {
                              navigator.clipboard.writeText(genClaudeCommand(item));
                            }}
                            className="opacity-0 group-hover:opacity-100 transition text-xs bg-emerald-500 text-white px-3 py-1.5 rounded-lg hover:bg-emerald-400 flex items-center gap-1 shrink-0 ml-3"
                          >
                            <Copy className="w-3 h-3" /> 制作コマンド
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
