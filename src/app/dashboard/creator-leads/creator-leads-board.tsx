"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Search, Save, Trash2, ExternalLink, Sparkles } from "lucide-react";
import { saveCreatorLeads, updateCreatorLead, bulkDeleteCreatorLeads } from "@/lib/actions/creator-lead";
import type { CreatorLeadStatus } from "@/generated/prisma/client";

type Discovered = {
  name: string; handle?: string; prefecture?: string; genre?: string; skills?: string; achievements?: string;
  portfolioUrl?: string; websiteUrl?: string; youtubeUrl?: string; instagramUrl?: string; xUrl?: string; tiktokUrl?: string; email?: string;
  scoreTotal?: number; scoreComment?: string; fitReason?: string; aiAdvice?: string;
};

type Row = {
  id: string; name: string; handle: string | null; prefecture: string | null; genre: string | null; skills: string | null;
  portfolioUrl: string | null; youtubeUrl: string | null; instagramUrl: string | null; xUrl: string | null; tiktokUrl: string | null; email: string | null;
  scoreTotal: number | null; scoreComment: string | null; fitReason: string | null; aiAdvice: string | null;
  status: CreatorLeadStatus; notes: string | null; createdAt: string;
};

const STATUS_OPTIONS: { value: CreatorLeadStatus; label: string }[] = [
  { value: "NEW", label: "新規" },
  { value: "CONTACTED", label: "接触済" },
  { value: "INTERESTED", label: "興味あり" },
  { value: "MEETING_SCHEDULED", label: "面談予定" },
  { value: "MEETING_DONE", label: "面談済" },
  { value: "NEGOTIATING", label: "交渉中" },
  { value: "CONTRACTED", label: "加盟" },
  { value: "REJECTED", label: "見送り" },
  { value: "NOT_FIT", label: "対象外" },
];

function scoreCls(s: number | null | undefined): string {
  const v = s ?? 0;
  if (v >= 80) return "bg-emerald-100 text-emerald-700 border-emerald-200";
  if (v >= 65) return "bg-blue-100 text-blue-700 border-blue-200";
  if (v >= 50) return "bg-amber-100 text-amber-700 border-amber-200";
  return "bg-zinc-100 text-zinc-500 border-zinc-200";
}

function LinkChip({ url, label }: { url: string | null | undefined; label: string }) {
  if (!url) return null;
  return (
    <a href={url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-0.5 text-[10px] text-fuchsia-600 hover:underline">
      {label}<ExternalLink className="w-2.5 h-2.5" />
    </a>
  );
}

const inputCls = "w-full px-2.5 py-1.5 text-sm border border-zinc-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-fuchsia-300 focus:border-fuchsia-400 bg-white";

export function CreatorLeadsBoard({ initialRows }: { initialRows: Row[] }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  // 検索フォーム
  const [genre, setGenre] = useState("");
  const [area, setArea] = useState("");
  const [keywords, setKeywords] = useState("");
  const [count, setCount] = useState(8);

  // 発掘結果
  const [searching, setSearching] = useState(false);
  const [searchError, setSearchError] = useState("");
  const [results, setResults] = useState<Discovered[]>([]);
  const [picked, setPicked] = useState<Set<number>>(new Set());

  // 保存済みリスト
  const [selected, setSelected] = useState<Set<string>>(new Set());

  async function runSearch() {
    setSearching(true);
    setSearchError("");
    setResults([]);
    setPicked(new Set());
    try {
      const res = await fetch("/api/creator-leads/search", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ genre, area, keywords, count }),
      });
      const data = await res.json();
      if (!res.ok) { setSearchError(data.error ?? "発掘に失敗しました"); return; }
      const creators = (data.creators ?? []) as Discovered[];
      setResults(creators);
      setPicked(new Set(creators.map((_, i) => i))); // 既定で全選択
    } catch {
      setSearchError("通信エラーが発生しました");
    } finally {
      setSearching(false);
    }
  }

  function savePicked() {
    const toSave = results.filter((_, i) => picked.has(i));
    if (toSave.length === 0) return;
    startTransition(async () => {
      const res = await saveCreatorLeads(toSave);
      if (res.error) { alert(res.error); return; }
      alert(`${res.saved}件を保存しました（重複は自動スキップ）`);
      setResults([]); setPicked(new Set());
      router.refresh();
    });
  }

  function setStatus(id: string, status: CreatorLeadStatus) {
    startTransition(async () => {
      await updateCreatorLead(id, { status });
      router.refresh();
    });
  }

  function bulkDelete() {
    if (selected.size === 0) return;
    if (!confirm(`${selected.size}件を削除します。よろしいですか？`)) return;
    startTransition(async () => {
      await bulkDeleteCreatorLeads([...selected]);
      setSelected(new Set());
      router.refresh();
    });
  }

  const sortedRows = useMemo(
    () => [...initialRows].sort((a, b) => (b.scoreTotal ?? 0) - (a.scoreTotal ?? 0)),
    [initialRows],
  );

  return (
    <div className="space-y-6">
      {/* 検索パネル */}
      <div className="bg-white border border-zinc-200 rounded-xl p-4">
        <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
          <div>
            <label className="block text-[11px] font-semibold text-zinc-600 mb-1">ジャンル</label>
            <input value={genre} onChange={(e) => setGenre(e.target.value)} placeholder="動画 / デザイン / Web 等" className={inputCls} />
          </div>
          <div>
            <label className="block text-[11px] font-semibold text-zinc-600 mb-1">地域</label>
            <input value={area} onChange={(e) => setArea(e.target.value)} placeholder="全国 / 東京 / 地方 等" className={inputCls} />
          </div>
          <div>
            <label className="block text-[11px] font-semibold text-zinc-600 mb-1">キーワード（任意）</label>
            <input value={keywords} onChange={(e) => setKeywords(e.target.value)} placeholder="例: Vook 個人 商売気質" className={inputCls} />
          </div>
          <div>
            <label className="block text-[11px] font-semibold text-zinc-600 mb-1">件数</label>
            <select value={count} onChange={(e) => setCount(parseInt(e.target.value, 10))} className={inputCls}>
              <option value={5}>5件</option>
              <option value={8}>8件</option>
              <option value={12}>12件</option>
              <option value={20}>20件</option>
            </select>
          </div>
        </div>
        <div className="flex items-center gap-3 mt-3">
          <button onClick={runSearch} disabled={searching} className="inline-flex items-center gap-1.5 px-4 py-2 bg-fuchsia-600 text-white text-sm font-semibold rounded-lg hover:bg-fuchsia-700 disabled:opacity-60 transition-colors">
            {searching ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
            {searching ? "Web検索で発掘中…（数十秒）" : "クリエイターを発掘"}
          </button>
          <span className="text-[11px] text-zinc-400">※ Web検索を使用（1回 約¥30〜50）。実在確認＋スコアリングまで自動</span>
        </div>
        {searchError && <p className="mt-2 text-sm text-red-600">{searchError}</p>}
      </div>

      {/* 発掘結果 */}
      {results.length > 0 && (
        <div className="bg-fuchsia-50/40 border border-fuchsia-200 rounded-xl p-4">
          <div className="flex items-center justify-between mb-3">
            <p className="text-sm font-bold text-fuchsia-800 flex items-center gap-1.5"><Sparkles className="w-4 h-4" />発掘結果 {results.length}件（{picked.size}件 選択中）</p>
            <button onClick={savePicked} disabled={isPending || picked.size === 0} className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-fuchsia-600 text-white text-xs font-semibold rounded-lg hover:bg-fuchsia-700 disabled:opacity-50 transition-colors">
              {isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}選択を保存（{picked.size}）
            </button>
          </div>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-2.5">
            {results.map((c, i) => (
              <label key={i} className={`block bg-white rounded-lg border p-3 cursor-pointer ${picked.has(i) ? "border-fuchsia-300 ring-1 ring-fuchsia-200" : "border-zinc-200"}`}>
                <div className="flex items-start gap-2">
                  <input type="checkbox" checked={picked.has(i)} onChange={() => setPicked((p) => { const n = new Set(p); if (n.has(i)) n.delete(i); else n.add(i); return n; })} className="mt-1 rounded border-zinc-300" />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-sm font-bold text-zinc-900">{c.name}</span>
                      {c.genre && <span className="text-[10px] text-zinc-500 bg-zinc-100 px-1.5 py-0.5 rounded">{c.genre}</span>}
                      {c.prefecture && <span className="text-[10px] text-zinc-400">📍{c.prefecture}</span>}
                      <span className={`text-[11px] font-bold px-1.5 py-0.5 rounded border ${scoreCls(c.scoreTotal)}`}>{c.scoreTotal ?? "-"}点</span>
                    </div>
                    {c.scoreComment && <p className="text-[11px] text-zinc-600 mt-1 leading-relaxed">{c.scoreComment}</p>}
                    <div className="flex items-center gap-2 flex-wrap mt-1.5">
                      <LinkChip url={c.portfolioUrl} label="ポートフォリオ" />
                      <LinkChip url={c.websiteUrl} label="Web" />
                      <LinkChip url={c.youtubeUrl} label="YouTube" />
                      <LinkChip url={c.instagramUrl} label="Instagram" />
                      <LinkChip url={c.xUrl} label="X" />
                      <LinkChip url={c.tiktokUrl} label="TikTok" />
                      {c.email && <span className="text-[10px] text-zinc-400">✉ {c.email}</span>}
                    </div>
                  </div>
                </div>
              </label>
            ))}
          </div>
        </div>
      )}

      {/* 保存済みリスト */}
      <div className="bg-white border border-zinc-200 rounded-xl overflow-hidden">
        <div className="flex items-center justify-between px-4 py-2.5 border-b border-zinc-100 bg-zinc-50">
          <p className="text-xs font-semibold text-zinc-600">保存済みクリエイター（{sortedRows.length}）</p>
          {selected.size > 0 && (
            <button onClick={bulkDelete} disabled={isPending} className="inline-flex items-center gap-1 px-2.5 py-1 bg-red-600 text-white text-[11px] font-medium rounded-md hover:bg-red-700 disabled:opacity-50">
              <Trash2 className="w-3 h-3" />削除（{selected.size}）
            </button>
          )}
        </div>
        {sortedRows.length === 0 ? (
          <div className="px-6 py-12 text-center text-sm text-zinc-400">まだありません。上の検索でクリエイターを発掘して保存してください。</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-zinc-50/50 border-b border-zinc-200">
                  <th className="px-3 py-2.5 w-8"><input type="checkbox" checked={selected.size === sortedRows.length && sortedRows.length > 0} onChange={() => setSelected(selected.size === sortedRows.length ? new Set() : new Set(sortedRows.map((r) => r.id)))} className="rounded border-zinc-300" /></th>
                  <th className="px-3 py-2.5 text-left text-xs font-semibold text-zinc-600">クリエイター</th>
                  <th className="px-3 py-2.5 text-center text-xs font-semibold text-zinc-600">スコア</th>
                  <th className="px-3 py-2.5 text-left text-xs font-semibold text-zinc-600">リンク</th>
                  <th className="px-3 py-2.5 text-left text-xs font-semibold text-zinc-600">ステータス</th>
                  <th className="px-3 py-2.5 text-left text-xs font-semibold text-zinc-600">登録日</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-100">
                {sortedRows.map((r) => (
                  <tr key={r.id} className={`hover:bg-zinc-50/50 ${selected.has(r.id) ? "bg-fuchsia-50/30" : ""}`}>
                    <td className="px-3 py-3"><input type="checkbox" checked={selected.has(r.id)} onChange={() => setSelected((p) => { const n = new Set(p); if (n.has(r.id)) n.delete(r.id); else n.add(r.id); return n; })} className="rounded border-zinc-300" /></td>
                    <td className="px-3 py-3">
                      <p className="text-sm font-medium text-zinc-900">{r.name}{r.handle ? <span className="text-[11px] text-zinc-400 ml-1">@{r.handle}</span> : null}</p>
                      <p className="text-[11px] text-zinc-400">{[r.genre, r.prefecture].filter(Boolean).join("・")}</p>
                      {r.scoreComment && <p className="text-[11px] text-zinc-500 mt-0.5 max-w-md">{r.scoreComment}</p>}
                    </td>
                    <td className="px-3 py-3 text-center"><span className={`text-[11px] font-bold px-1.5 py-0.5 rounded border ${scoreCls(r.scoreTotal)}`}>{r.scoreTotal ?? "-"}</span></td>
                    <td className="px-3 py-3">
                      <div className="flex flex-col gap-0.5">
                        <LinkChip url={r.portfolioUrl} label="ポートフォリオ" />
                        <LinkChip url={r.youtubeUrl} label="YouTube" />
                        <LinkChip url={r.instagramUrl} label="Instagram" />
                        <LinkChip url={r.xUrl} label="X" />
                      </div>
                    </td>
                    <td className="px-3 py-3">
                      <select value={r.status} onChange={(e) => setStatus(r.id, e.target.value as CreatorLeadStatus)} className="text-xs border border-zinc-200 rounded-lg px-2 py-1 bg-white">
                        {STATUS_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                      </select>
                    </td>
                    <td className="px-3 py-3 text-xs text-zinc-400">{new Date(r.createdAt).toLocaleDateString("ja-JP", { year: "numeric", month: "2-digit", day: "2-digit" })}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
