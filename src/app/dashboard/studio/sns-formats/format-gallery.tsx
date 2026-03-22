"use client";

import { useState } from "react";
import { Eye, Calendar, ExternalLink, Copy, Check, ArrowUpDown, Terminal, ChevronDown, X, Play } from "lucide-react";

type ReferenceFormat = {
  id: string;
  sourceUrl: string;
  sourceViews: number | null;
  sourceDuration: number | null;
  sourceResolution: string | null;
  thumbnailBase64: string | null;
  title: string;
  description: string | null;
  industry: string;
  taste: string;
  duration: string;
  platforms: string;
  structure: any;
  cutPoints: any;
  telopAnalysis: any;
  recommendedTelops: string | null;
  hookTechnique: string | null;
  shootingTips: string | null;
  createdAt: string;
  createdBy: { name: string | null } | null;
};

type SortKey = "createdAt" | "sourceViews" | "title";

const INDUSTRY_LABELS: Record<string, string> = {
  beauty: "美容", food: "飲食", gym: "ジム", medical: "医療", dental: "歯科",
  realestate: "不動産", hotel: "宿泊", bridal: "ブライダル", fashion: "ファッション",
  car: "車", pet: "ペット", school: "スクール", cleaning: "清掃", photo: "フォト",
  reform: "リフォーム", it: "IT", lawyer: "士業", flower: "花屋", general: "汎用",
};

const INDUSTRY_COLORS: Record<string, string> = {
  beauty: "bg-pink-100 text-pink-700", food: "bg-orange-100 text-orange-700",
  gym: "bg-blue-100 text-blue-700", medical: "bg-teal-100 text-teal-700",
  general: "bg-zinc-100 text-zinc-700",
};

export function FormatGallery({ initialFormats }: { initialFormats: ReferenceFormat[] }) {
  const [formats] = useState(initialFormats);
  const [sortKey, setSortKey] = useState<SortKey>("createdAt");
  const [sortAsc, setSortAsc] = useState(false);
  const [filterIndustry, setFilterIndustry] = useState<string | null>(null);
  const [selectedFormat, setSelectedFormat] = useState<ReferenceFormat | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  if (formats.length === 0) return null;

  const industries = [...new Set(formats.map((f) => f.industry))];

  const filtered = formats.filter((f) => !filterIndustry || f.industry === filterIndustry);
  const sorted = [...filtered].sort((a, b) => {
    const dir = sortAsc ? 1 : -1;
    if (sortKey === "createdAt") return dir * (new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
    if (sortKey === "sourceViews") return dir * ((a.sourceViews || 0) - (b.sourceViews || 0));
    return dir * a.title.localeCompare(b.title);
  });

  function toggleSort(key: SortKey) {
    if (sortKey === key) setSortAsc(!sortAsc);
    else { setSortKey(key); setSortAsc(false); }
  }

  function genCommand(f: ReferenceFormat) {
    const st = f.structure as any[];
    const telop = f.recommendedTelops?.split(",")[0] || "solid_white";
    const structure = st.map((s: any) => `${s.label}(${s.duration})`).join(" → ");
    return `SNSフォーマット自動編集を実行してください。

【フォーマット情報】
・名前: ${f.title}
・業種: ${f.industry}
・尺: ${f.duration}
・構成: ${structure}
・テロップスタイル: ${telop}
・参考動画: ${f.sourceUrl}

【実行手順】
1. 素材フォルダ内のメディアをPremiere Proにインポート
2. シーケンス「${f.title}」を作成
3. 以下の構成でクリップを配置:
${st.map((s: any, i: number) => `   ${i + 1}. ${s.label} — ${s.duration}`).join("\n")}
4. テロップスタイル「${telop}」でテロップを配置
5. マーカーを各セクション区切りに追加
6. BGMを配置

素材フォルダ: （ここに素材パスを入力）`;
  }

  function copyCommand(f: ReferenceFormat) {
    navigator.clipboard.writeText(genCommand(f));
    setCopiedId(f.id);
    setTimeout(() => setCopiedId(null), 2000);
  }

  return (
    <div data-tour="sns-format-recent" className="mt-8">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <h2 className="text-lg font-bold text-zinc-900">フォーマット一覧</h2>
          <span className="text-xs text-zinc-400 bg-zinc-100 px-2 py-0.5 rounded-full">{sorted.length}件</span>
        </div>
        <div className="flex items-center gap-2">
          {/* Industry filter */}
          <div className="relative">
            <select
              value={filterIndustry || ""}
              onChange={(e) => setFilterIndustry(e.target.value || null)}
              className="text-xs border border-zinc-200 rounded-lg px-3 py-1.5 bg-white text-zinc-600 appearance-none pr-7 cursor-pointer"
            >
              <option value="">全業種</option>
              {industries.map((ind) => (
                <option key={ind} value={ind}>{INDUSTRY_LABELS[ind] || ind}</option>
              ))}
            </select>
            <ChevronDown className="w-3 h-3 absolute right-2 top-1/2 -translate-y-1/2 text-zinc-400 pointer-events-none" />
          </div>
          {/* Sort */}
          {([["createdAt", "新着順"], ["sourceViews", "再生数順"]] as [SortKey, string][]).map(([key, label]) => (
            <button
              key={key}
              onClick={() => toggleSort(key)}
              className={`text-xs px-3 py-1.5 rounded-lg transition flex items-center gap-1 ${
                sortKey === key ? "bg-indigo-50 text-indigo-700 font-medium border border-indigo-200" : "text-zinc-500 hover:bg-zinc-100 border border-transparent"
              }`}
            >
              {label}
              {sortKey === key && <ArrowUpDown className="w-3 h-3" />}
            </button>
          ))}
        </div>
      </div>

      {/* Card Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {sorted.map((f) => {
          const st = f.structure as any[];
          return (
            <div
              key={f.id}
              onClick={() => setSelectedFormat(f)}
              className="bg-white rounded-xl border border-zinc-200 overflow-hidden cursor-pointer transition hover:border-fuchsia-300 hover:shadow-lg hover:-translate-y-0.5 group"
            >
              {/* Thumbnail */}
              <div className="h-44 relative overflow-hidden bg-zinc-100">
                {f.thumbnailBase64 ? (
                  <img src={f.thumbnailBase64} alt={f.title} className="w-full h-full object-cover group-hover:scale-105 transition duration-300" />
                ) : (
                  <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-indigo-100 to-fuchsia-100">
                    <Play className="w-10 h-10 text-fuchsia-300" />
                  </div>
                )}
                {/* Overlay info */}
                <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent" />
                <div className="absolute bottom-3 left-3 right-3 z-10">
                  <div className="text-sm font-bold text-white drop-shadow">{f.title}</div>
                  <div className="flex items-center gap-2 mt-1">
                    <span className="text-[10px] text-white/70 bg-white/15 px-2 py-0.5 rounded backdrop-blur-sm">{f.duration}</span>
                    <span className="text-[10px] text-white/70 bg-white/15 px-2 py-0.5 rounded backdrop-blur-sm">{INDUSTRY_LABELS[f.industry] || f.industry}</span>
                    {f.sourceViews && (
                      <span className="text-[10px] text-white/70 flex items-center gap-0.5">
                        <Eye className="w-3 h-3" />{f.sourceViews.toLocaleString()}
                      </span>
                    )}
                  </div>
                </div>
                {/* Timeline mini */}
                <div className="absolute bottom-0 left-0 right-0 h-1.5 flex z-10">
                  {st.map((s: any, i: number) => {
                    const colors = ["bg-purple-500", "bg-blue-500", "bg-blue-400", "bg-pink-500", "bg-emerald-500"];
                    return <div key={i} className={`${colors[i % colors.length]} opacity-80`} style={{ flex: parseFloat(s.duration) }} />;
                  })}
                </div>
              </div>

              {/* Body */}
              <div className="p-3">
                {f.description && (
                  <p className="text-xs text-zinc-500 line-clamp-2 mb-2">{f.description}</p>
                )}
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 text-[10px] text-zinc-400">
                    <span className="flex items-center gap-0.5">
                      <Calendar className="w-3 h-3" />
                      {new Date(f.createdAt).toLocaleDateString("ja-JP")}
                    </span>
                    {f.createdBy?.name && <span>{f.createdBy.name}</span>}
                  </div>
                  <a
                    href={f.sourceUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-[10px] text-indigo-500 hover:text-indigo-600 flex items-center gap-0.5"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <ExternalLink className="w-3 h-3" />元動画
                  </a>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Detail Modal */}
      {selectedFormat && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4" onClick={(e) => e.target === e.currentTarget && setSelectedFormat(null)}>
          <div className="bg-white rounded-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto shadow-2xl">
            {/* Thumbnail header */}
            <div className="h-48 relative overflow-hidden rounded-t-2xl">
              {selectedFormat.thumbnailBase64 ? (
                <img src={selectedFormat.thumbnailBase64} alt="" className="w-full h-full object-cover" />
              ) : (
                <div className="w-full h-full bg-gradient-to-br from-indigo-200 to-fuchsia-200" />
              )}
              <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/20 to-transparent" />
              <button onClick={() => setSelectedFormat(null)} className="absolute top-4 right-4 z-20 w-8 h-8 bg-black/30 backdrop-blur rounded-lg flex items-center justify-center text-white/70 hover:text-white transition">
                <X className="w-4 h-4" />
              </button>
              <div className="absolute bottom-4 left-5 right-5 z-10">
                <div className="text-xl font-bold text-white">{selectedFormat.title}</div>
                <div className="flex items-center gap-2 mt-1.5">
                  <span className="text-xs text-white/70 bg-white/15 px-2 py-0.5 rounded">{selectedFormat.duration}</span>
                  <span className="text-xs text-white/70 bg-white/15 px-2 py-0.5 rounded">{INDUSTRY_LABELS[selectedFormat.industry] || selectedFormat.industry}</span>
                  <span className="text-xs text-white/70 bg-white/15 px-2 py-0.5 rounded">{selectedFormat.taste}</span>
                  {selectedFormat.sourceViews && (
                    <span className="text-xs text-white/60 flex items-center gap-1"><Eye className="w-3 h-3" />{selectedFormat.sourceViews.toLocaleString()}再生</span>
                  )}
                </div>
              </div>
            </div>

            <div className="p-5 space-y-5">
              {selectedFormat.description && (
                <p className="text-sm text-zinc-600">{selectedFormat.description}</p>
              )}

              {/* Timeline */}
              <div>
                <h3 className="text-xs font-semibold text-zinc-400 uppercase tracking-wider mb-2">構成タイムライン</h3>
                <div className="flex gap-0.5 rounded-lg overflow-hidden h-12">
                  {(selectedFormat.structure as any[]).map((s: any, i: number) => {
                    const colors = ["rgba(139,92,246,.5)", "rgba(59,130,246,.4)", "rgba(59,130,246,.3)", "rgba(236,72,153,.45)", "rgba(16,185,129,.4)"];
                    return (
                      <div key={i} className="flex flex-col items-center justify-center px-2" style={{ flex: parseFloat(s.duration), background: colors[i % colors.length] }}>
                        <span className="text-[10px] font-semibold text-white/90 whitespace-nowrap">{s.label}</span>
                        <span className="text-[9px] text-white/50">{s.duration}</span>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Analysis details */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                {selectedFormat.hookTechnique && (
                  <div className="bg-amber-50 rounded-lg border border-amber-200 p-3">
                    <div className="text-[10px] font-semibold text-amber-600 uppercase mb-1">フック技法</div>
                    <div className="text-xs text-amber-800">{selectedFormat.hookTechnique}</div>
                  </div>
                )}
                {selectedFormat.shootingTips && (
                  <div className="bg-blue-50 rounded-lg border border-blue-200 p-3">
                    <div className="text-[10px] font-semibold text-blue-600 uppercase mb-1">撮影のコツ</div>
                    <div className="text-xs text-blue-800">{selectedFormat.shootingTips}</div>
                  </div>
                )}
                {selectedFormat.telopAnalysis && (
                  <div className="bg-zinc-50 rounded-lg border p-3">
                    <div className="text-[10px] font-semibold text-zinc-400 uppercase mb-1">テロップ</div>
                    <div className="text-xs text-zinc-700">{(selectedFormat.telopAnalysis as any).main_style}</div>
                  </div>
                )}
              </div>

              {/* Source info */}
              <div className="flex items-center gap-4 text-xs text-zinc-400">
                <a href={selectedFormat.sourceUrl} target="_blank" rel="noopener noreferrer" className="text-indigo-500 hover:text-indigo-600 flex items-center gap-1">
                  <ExternalLink className="w-3 h-3" /> 元動画を見る
                </a>
                {selectedFormat.sourceDuration && <span>{selectedFormat.sourceDuration.toFixed(1)}秒</span>}
                {selectedFormat.sourceResolution && <span>{selectedFormat.sourceResolution}</span>}
                <span>{new Date(selectedFormat.createdAt).toLocaleDateString("ja-JP")} 生成</span>
              </div>

              {/* Production command */}
              <div className="bg-zinc-900 rounded-xl p-4">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2 text-xs text-emerald-400 font-semibold">
                    <Terminal className="w-3 h-3" /> 制作コマンド（Claudeに貼り付け）
                  </div>
                  <button
                    onClick={(e) => { e.stopPropagation(); copyCommand(selectedFormat); }}
                    className={`text-xs px-3 py-1 rounded transition flex items-center gap-1 ${
                      copiedId === selectedFormat.id ? "bg-emerald-600 text-white" : "bg-emerald-500 text-white hover:bg-emerald-400"
                    }`}
                  >
                    {copiedId === selectedFormat.id ? <><Check className="w-3 h-3" /> コピー済み</> : <><Copy className="w-3 h-3" /> コピー</>}
                  </button>
                </div>
                <div className="font-mono text-[11px] text-emerald-300/70 max-h-36 overflow-y-auto whitespace-pre-wrap leading-relaxed">
                  {genCommand(selectedFormat)}
                </div>
                <div className="text-[10px] text-zinc-500 mt-3">
                  💡 コピー → Claude Code に貼り付け → 素材パスを指定 → Premiere Pro が自動編集
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
