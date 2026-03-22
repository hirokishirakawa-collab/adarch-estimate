"use client";

import { useState } from "react";
import { Sparkles, Link2, Loader2, Check, ChevronDown, ChevronUp, Eye, Copy, Terminal } from "lucide-react";

type AnalysisResult = {
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
  thumbnailBase64?: string;
};

export function VideoAnalyzer() {
  const [url, setUrl] = useState("");
  const [sourceViews, setSourceViews] = useState("");
  const [analyzing, setAnalyzing] = useState(false);
  const [result, setResult] = useState<AnalysisResult | null>(null);
  const [error, setError] = useState("");
  const [expanded, setExpanded] = useState(true);
  const [copiedCmd, setCopiedCmd] = useState(false);

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
      }
    } catch {
      setError("通信エラーが発生しました");
    } finally {
      setAnalyzing(false);
    }
  }

  function genCommand() {
    if (!result) return "";
    const structure = result.st.map((s) => `${s.l}(${s.d})`).join(" → ");
    return `SNSフォーマット自動編集を実行してください。

【フォーマット情報】
・名前: ${result.nm}
・業種: ${result.ind}
・尺: ${result.dur}
・構成: ${structure}
・テロップスタイル: ${result.rtlp}
・参考動画: ${result.source_url}

【実行手順】
1. 素材フォルダ内のメディアをPremiere Proにインポート
2. シーケンス「${result.nm}」を作成
3. 以下の構成でクリップを配置:
${result.st.map((s, i) => `   ${i + 1}. ${s.l} — ${s.d}`).join("\n")}
4. テロップスタイル「${result.rtlp}」でテロップを配置
5. マーカーを各セクション区切りに追加
6. BGMを配置

素材フォルダ: （ここに素材パスを入力）`;
  }

  return (
    <div data-tour="sns-format-analyzer" className="bg-gradient-to-r from-indigo-50 to-fuchsia-50 rounded-xl border border-indigo-200 overflow-hidden">
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
            <div className="text-sm font-bold text-zinc-900">参考動画からフォーマットを生成</div>
            <div className="text-xs text-zinc-500">Instagram / TikTokのURLを貼ると、構成・テロップ・撮影依頼書を自動解析してフォーマット一覧に追加</div>
          </div>
        </div>
        {expanded ? <ChevronUp className="w-4 h-4 text-zinc-400" /> : <ChevronDown className="w-4 h-4 text-zinc-400" />}
      </button>

      {expanded && (
        <div className="px-5 pb-5 space-y-4">
          {/* Input */}
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
            <div className="w-28 relative">
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
            <div className="bg-red-50 border border-red-200 rounded-lg px-4 py-3 text-sm text-red-700 whitespace-pre-wrap">{error}</div>
          )}

          {/* Result */}
          {result && (
            <div className="bg-white rounded-xl border shadow-sm overflow-hidden">
              {/* Header with thumbnail */}
              <div className="relative h-48 overflow-hidden">
                {result.thumbnailBase64 ? (
                  <img src={result.thumbnailBase64} alt="" className="w-full h-full object-cover" />
                ) : (
                  <div className="w-full h-full bg-gradient-to-br from-indigo-200 to-fuchsia-200" />
                )}
                <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/20 to-transparent" />
                <div className="absolute bottom-4 left-5 right-5 z-10">
                  <div className="flex items-center gap-2 mb-1">
                    <Check className="w-4 h-4 text-emerald-400" />
                    <span className="text-xs text-emerald-400 font-medium">フォーマット一覧に自動保存済み</span>
                  </div>
                  <div className="text-xl font-bold text-white">{result.nm}</div>
                  <div className="text-sm text-white/60 mt-0.5">{result.desc}</div>
                  <div className="flex gap-2 mt-2">
                    <span className="text-xs bg-white/20 px-2 py-0.5 rounded">{result.dur}</span>
                    <span className="text-xs bg-white/20 px-2 py-0.5 rounded">{result.ind}</span>
                    <span className="text-xs bg-white/20 px-2 py-0.5 rounded">{result.taste}</span>
                  </div>
                </div>
              </div>

              <div className="p-5 space-y-4">
                {/* Timeline */}
                <div className="flex gap-0.5 rounded-lg overflow-hidden h-11">
                  {result.st.map((s, i) => (
                    <div key={i} className="flex flex-col items-center justify-center px-2" style={{ flex: parseFloat(s.d), background: s.c }}>
                      <span className="text-[10px] font-semibold text-white/90 whitespace-nowrap">{s.l}</span>
                      <span className="text-[9px] text-white/50">{s.d}</span>
                    </div>
                  ))}
                </div>

                {/* Analysis cards */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  <div className="bg-amber-50 rounded-lg border border-amber-200 p-3">
                    <div className="text-[10px] font-semibold text-amber-600 uppercase mb-1">フック技法</div>
                    <div className="text-xs text-amber-800">{result.hook_technique}</div>
                  </div>
                  <div className="bg-blue-50 rounded-lg border border-blue-200 p-3">
                    <div className="text-[10px] font-semibold text-blue-600 uppercase mb-1">撮影のコツ</div>
                    <div className="text-xs text-blue-800">{result.shooting_tips}</div>
                  </div>
                  <div className="bg-zinc-50 rounded-lg border p-3">
                    <div className="text-[10px] font-semibold text-zinc-400 uppercase mb-1">テロップ</div>
                    <div className="text-xs text-zinc-700">{result.telop_analysis.main_style}</div>
                  </div>
                </div>

                {/* Command */}
                <div className="bg-zinc-900 rounded-lg p-4">
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2 text-xs text-emerald-400 font-semibold">
                      <Terminal className="w-3 h-3" /> 制作コマンド
                    </div>
                    <button
                      onClick={() => { navigator.clipboard.writeText(genCommand()); setCopiedCmd(true); setTimeout(() => setCopiedCmd(false), 2000); }}
                      className={`text-xs px-3 py-1 rounded flex items-center gap-1 transition ${copiedCmd ? "bg-emerald-600 text-white" : "bg-emerald-500 text-white hover:bg-emerald-400"}`}
                    >
                      {copiedCmd ? <><Check className="w-3 h-3" /> コピー済み</> : <><Copy className="w-3 h-3" /> コピー</>}
                    </button>
                  </div>
                  <div className="font-mono text-[11px] text-emerald-300/70 max-h-28 overflow-y-auto whitespace-pre-wrap leading-relaxed">
                    {genCommand()}
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
