"use client";

// 郵送DMの材料の履歴（ソート／一括選択／一括削除・発送済み／日付フィルタ）
import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Loader2, Trash2, CheckCircle2, Circle, FileText, Sparkles, Monitor } from "lucide-react";

interface Kit {
  id: string;
  prefecture: string;
  city: string;
  industry: string | null;
  catchCopy: string | null;
  template: string;
  flyerUrl: string | null;
  flyerSource: string;
  source: string;
  readyCount: number;
  needsFixCount: number;
  skippedCount: number;
  sentAt: string | null;
  sentVia: string | null;
  createdByName: string;
  createdById: string;
  createdAt: string;
}
type SortKey = "createdAt" | "city" | "readyCount" | "sentAt";
const fmt = (s: string) => new Intl.DateTimeFormat("ja-JP", { month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", timeZone: "Asia/Tokyo" }).format(new Date(s));

export function DmKitHistory() {
  const [items, setItems] = useState<Kit[]>([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState("");
  const [sent, setSent] = useState<"" | "1" | "0">("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [sort, setSort] = useState<SortKey>("createdAt");
  const [dir, setDir] = useState<"asc" | "desc">("desc");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [busy, setBusy] = useState(false);

  const load = async () => {
    const sp = new URLSearchParams();
    if (q.trim()) sp.set("q", q.trim());
    if (sent) sp.set("sent", sent);
    if (from) sp.set("from", from);
    if (to) sp.set("to", to);
    sp.set("sort", sort);
    sp.set("dir", dir);
    const res = await fetch(`/api/dm/kits?${sp.toString()}`);
    if (res.ok) setItems((await res.json()).items);
    setLoading(false);
  };
  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sent, from, to, sort, dir]);

  const bulk = async (action: "delete" | "sent" | "unsent") => {
    const ids = Array.from(selected);
    if (!ids.length) return;
    if (action === "delete" && !confirm(`${ids.length}件の履歴を削除します。ファイルの再ダウンロードができなくなります（リードの送付記録は残ります）。よろしいですか？`)) return;
    setBusy(true);
    const res = await fetch("/api/dm/kits/bulk", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ ids, action }) });
    setBusy(false);
    if (!res.ok) { alert((await res.json()).error ?? "失敗しました"); return; }
    setSelected(new Set());
    await load();
  };
  const toggleSent = async (k: Kit) => {
    setBusy(true);
    await fetch(`/api/dm/kits/${k.id}`, { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify({ sent: !k.sentAt }) });
    setBusy(false);
    await load();
  };

  const header = (key: SortKey, label: string) => (
    <button onClick={() => { if (sort === key) setDir(dir === "asc" ? "desc" : "asc"); else { setSort(key); setDir(key === "city" ? "asc" : "desc"); } }} className="text-left font-bold text-zinc-500 hover:text-zinc-800">
      {label}{sort === key ? (dir === "asc" ? " ▲" : " ▼") : ""}
    </button>
  );
  const unsentCount = useMemo(() => items.filter((i) => !i.sentAt).length, [items]);

  return (
    <div className="rounded-xl border border-zinc-200 bg-white">
      <div className="px-4 py-3 border-b border-zinc-100 flex flex-wrap items-center gap-2">
        <p className="text-sm font-bold text-zinc-800 mr-2">作った材料の履歴 <span className="text-xs font-normal text-zinc-500">未発送 {unsentCount}件</span></p>
        <form onSubmit={(e) => { e.preventDefault(); void load(); }} className="flex items-center gap-1 flex-1 min-w-[180px]">
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="市・業種・ひとこと・作った人" className="flex-1 rounded-lg border border-zinc-200 px-2.5 py-1.5 text-xs" />
          <button type="submit" className="px-2.5 py-1.5 rounded-lg bg-zinc-800 text-white text-xs font-bold">検索</button>
        </form>
        <select value={sent} onChange={(e) => setSent(e.target.value as "" | "1" | "0")} className="rounded-lg border border-zinc-200 px-2 py-1.5 text-xs">
          <option value="">発送: すべて</option>
          <option value="0">未発送</option>
          <option value="1">発送済み</option>
        </select>
        <div className="flex items-center gap-1 text-xs text-zinc-500">
          <input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className="rounded-lg border border-zinc-200 px-2 py-1 text-xs" />〜
          <input type="date" value={to} onChange={(e) => setTo(e.target.value)} className="rounded-lg border border-zinc-200 px-2 py-1 text-xs" />
        </div>
      </div>
      {selected.size > 0 && (
        <div className="px-4 py-2 border-b border-orange-100 bg-orange-50/60 flex flex-wrap items-center gap-2 text-xs">
          <span className="font-bold text-zinc-700">{selected.size}件を選択</span>
          <button disabled={busy} onClick={() => bulk("sent")} className="px-2.5 py-1 rounded-lg border border-emerald-300 bg-white text-emerald-700 hover:bg-emerald-50">発送済みにする</button>
          <button disabled={busy} onClick={() => bulk("unsent")} className="px-2.5 py-1 rounded-lg border border-zinc-300 bg-white hover:bg-zinc-50">未発送に戻す</button>
          <button disabled={busy} onClick={() => bulk("delete")} className="ml-auto px-2.5 py-1 rounded-lg bg-rose-600 text-white hover:bg-rose-700 inline-flex items-center gap-1"><Trash2 className="w-3 h-3" /> 削除</button>
        </div>
      )}
      <div className="grid grid-cols-[28px_1fr_110px_90px_80px_110px_60px] gap-2 px-4 py-2 border-b border-zinc-100 text-[11px] items-center">
        <input type="checkbox" aria-label="全選択" checked={items.length > 0 && selected.size === items.length} onChange={(e) => setSelected(e.target.checked ? new Set(items.map((i) => i.id)) : new Set())} />
        {header("city", "商圏・チラシ")}
        <span className="font-bold text-zinc-500">作った人</span>
        {header("readyCount", "通数")}
        {header("sentAt", "発送")}
        {header("createdAt", "作成")}
        <span />
      </div>
      {loading ? (
        <div className="flex items-center justify-center py-10 text-zinc-400 text-xs gap-2"><Loader2 className="w-4 h-4 animate-spin" /> 読み込み中</div>
      ) : items.length === 0 ? (
        <div className="py-10 text-center text-xs text-zinc-400">まだ材料を作っていません。リード管理で会社を選んで「郵送DMへ」から作れます</div>
      ) : (
        items.map((k) => (
          <div key={k.id} className={`grid grid-cols-[28px_1fr_110px_90px_80px_110px_60px] gap-2 px-4 py-2.5 border-b border-zinc-50 items-center text-xs ${selected.has(k.id) ? "bg-orange-50/40" : "hover:bg-zinc-50/60"}`}>
            <input type="checkbox" checked={selected.has(k.id)} onChange={() => setSelected((p) => { const n = new Set(p); if (n.has(k.id)) n.delete(k.id); else n.add(k.id); return n; })} />
            <div className="min-w-0">
              <div className="flex items-center gap-1.5 flex-wrap">
                <Link href={`/dashboard/leads/dm/${k.id}`} className="font-bold text-zinc-800 hover:underline">{k.prefecture} {k.city}{k.industry ? `・${k.industry}` : ""}</Link>
                <span className="text-[10px] px-1.5 rounded border border-zinc-200 text-zinc-500 inline-flex items-center gap-0.5">{k.source === "AI" ? <><Sparkles className="w-3 h-3" />AI連携</> : <><Monitor className="w-3 h-3" />画面</>}</span>
                <span className="text-[10px] px-1.5 rounded border border-zinc-200 text-zinc-500 inline-flex items-center gap-0.5"><FileText className="w-3 h-3" />{k.flyerSource === "UPLOADED" ? "自作チラシ" : `OSの型（${k.template}）`}</span>
              </div>
              {k.catchCopy && <p className="text-zinc-500 truncate">{k.catchCopy}</p>}
            </div>
            <div className="text-zinc-600 truncate">{k.createdByName}</div>
            <div className="text-zinc-700">{k.readyCount}通{k.needsFixCount ? <span className="text-amber-700">（＋{k.needsFixCount}要確認）</span> : ""}</div>
            <button onClick={() => toggleSent(k)} disabled={busy} title={k.sentAt ? `発送済み ${fmt(k.sentAt)}${k.sentVia ? `・${k.sentVia}` : ""}（押すと未発送に戻す）` : "押すと発送済みにする"} className="inline-flex items-center gap-1 text-left">
              {k.sentAt ? <><CheckCircle2 className="w-4 h-4 text-emerald-600" /><span className="text-emerald-700">済</span></> : <><Circle className="w-4 h-4 text-zinc-300" /><span className="text-zinc-400">未</span></>}
            </button>
            <div className="text-zinc-500">{fmt(k.createdAt)}</div>
            <Link href={`/dashboard/leads/dm/${k.id}`} className="text-blue-700 hover:underline">開く</Link>
          </div>
        ))
      )}
    </div>
  );
}
