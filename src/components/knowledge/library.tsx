"use client";

// 資料ライブラリ（全員）: 一覧（検索・出どころ・並べ替え）＋「資料に聞く」。行のチェックで聞く先を絞れる
import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Search, FileText, Link2, AlignLeft, Settings2, Loader2 } from "lucide-react";
import { AskPanel } from "./ask-panel";
import { OriginBadge } from "./origin-badge";
import { ORIGIN_UI, fmtDate, type KnowledgeItem, type KnowledgeOrigin } from "./types";

type SortKey = "createdAt" | "title" | "publisher" | "charCount";

const KIND_ICON = { FILE: FileText, URL: Link2, TEXT: AlignLeft } as const;

export function KnowledgeLibrary() {
  const [items, setItems] = useState<KnowledgeItem[]>([]);
  const [isAdmin, setIsAdmin] = useState(false);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState("");
  const [origin, setOrigin] = useState<KnowledgeOrigin | "">("");
  const [sort, setSort] = useState<SortKey>("createdAt");
  const [dir, setDir] = useState<"asc" | "desc">("desc");
  const [selected, setSelected] = useState<Set<string>>(new Set());

  const load = async () => {
    setLoading(true);
    const sp = new URLSearchParams();
    if (q.trim()) sp.set("q", q.trim());
    if (origin) sp.set("origin", origin);
    sp.set("sort", sort);
    sp.set("dir", dir);
    const res = await fetch(`/api/knowledge?${sp.toString()}`);
    if (res.ok) {
      const data = await res.json();
      setItems(data.items);
      setIsAdmin(Boolean(data.isAdmin));
    }
    setLoading(false);
  };

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [origin, sort, dir]);

  const ready = useMemo(() => items.filter((i) => i.status === "READY"), [items]);
  const counts = useMemo(() => ({ own: ready.filter((i) => i.origin === "OWN").length, ext: ready.filter((i) => i.origin === "EXTERNAL").length }), [ready]);

  const toggle = (id: string) =>
    setSelected((prev) => {
      const n = new Set(prev);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });

  const header = (key: SortKey, label: string) => (
    <button
      onClick={() => {
        if (sort === key) setDir(dir === "asc" ? "desc" : "asc");
        else {
          setSort(key);
          setDir(key === "title" || key === "publisher" ? "asc" : "desc");
        }
      }}
      className="text-left font-bold text-zinc-500 hover:text-zinc-800"
    >
      {label}
      {sort === key ? (dir === "asc" ? " ▲" : " ▼") : ""}
    </button>
  );

  return (
    <div className="space-y-4">
      <AskPanel sourceIds={Array.from(selected)} origin={origin} />

      <div className="flex flex-wrap items-center gap-2">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            void load();
          }}
          className="flex items-center gap-2 flex-1 min-w-[240px]"
        >
          <div className="relative flex-1">
            <Search className="absolute left-2.5 top-2.5 w-3.5 h-3.5 text-zinc-400" />
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="題名・発行元・検索語・本文で探す"
              className="w-full rounded-lg border border-zinc-200 bg-white pl-8 pr-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-300"
            />
          </div>
          <button type="submit" className="px-3 py-2 rounded-lg bg-zinc-800 text-white text-xs font-bold hover:bg-zinc-900">検索</button>
        </form>
        <div className="flex items-center gap-1 text-xs">
          {(["", "OWN", "EXTERNAL"] as const).map((o) => (
            <button
              key={o}
              onClick={() => setOrigin(o)}
              className={`px-2.5 py-1.5 rounded-lg border font-bold ${origin === o ? "bg-zinc-800 text-white border-zinc-800" : "bg-white text-zinc-600 border-zinc-200 hover:bg-zinc-50"}`}
            >
              {o === "" ? `すべて ${ready.length}` : o === "OWN" ? `自社 ${counts.own}` : `他社・媒体 ${counts.ext}`}
            </button>
          ))}
        </div>
        {isAdmin && (
          <Link href="/dashboard/admin/knowledge" className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-amber-600 text-white text-xs font-bold hover:bg-amber-700">
            <Settings2 className="w-3.5 h-3.5" /> 資料を登録・管理（本部）
          </Link>
        )}
      </div>

      <div className="rounded-xl border border-zinc-200 bg-white overflow-hidden">
        <div className="grid grid-cols-[28px_1fr_140px_90px_90px] gap-2 px-3 py-2 border-b border-zinc-100 text-[11px] items-center">
          <input
            type="checkbox"
            aria-label="全選択"
            checked={ready.length > 0 && selected.size === ready.length}
            onChange={(e) => setSelected(e.target.checked ? new Set(ready.map((i) => i.id)) : new Set())}
          />
          {header("title", "資料")}
          {header("publisher", "発行元")}
          {header("charCount", "分量")}
          {header("createdAt", "登録日")}
        </div>
        {loading ? (
          <div className="flex items-center justify-center py-10 text-zinc-400 text-xs gap-2"><Loader2 className="w-4 h-4 animate-spin" /> 読み込み中</div>
        ) : ready.length === 0 ? (
          <div className="py-10 text-center text-xs text-zinc-400">まだ資料がありません{isAdmin ? "。「資料を登録・管理」から入れてください" : "。本部が登録すると、ここに並びます"}</div>
        ) : (
          ready.map((it) => {
            const Icon = KIND_ICON[it.kind];
            return (
              <div key={it.id} className={`grid grid-cols-[28px_1fr_140px_90px_90px] gap-2 px-3 py-2.5 border-b border-zinc-50 items-start text-xs ${selected.has(it.id) ? "bg-amber-50/50" : "hover:bg-zinc-50/60"}`}>
                <input type="checkbox" className="mt-0.5" checked={selected.has(it.id)} onChange={() => toggle(it.id)} aria-label="この資料に聞く" />
                <div className="min-w-0">
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <OriginBadge origin={it.origin} size="xs" />
                    {it.hqOnly && <span className="text-[10px] px-1.5 rounded border border-zinc-300 text-zinc-500">本部限定</span>}
                    <Link href={`/dashboard/knowledge/${it.id}`} className="font-bold text-zinc-800 hover:underline flex items-center gap-1 min-w-0">
                      <Icon className="w-3.5 h-3.5 text-zinc-400 shrink-0" />
                      <span className="truncate">{it.title}</span>
                    </Link>
                    {it.publishedAt && <span className="text-zinc-400">{it.publishedAt}</span>}
                  </div>
                  {it.summary && <p className="text-zinc-500 mt-0.5 line-clamp-2">{it.summary}</p>}
                  <p className="text-[10px] text-zinc-400 mt-0.5">{ORIGIN_UI[it.origin].hint}</p>
                </div>
                <div className="text-zinc-600 truncate">{it.publisher ?? "—"}</div>
                <div className="text-zinc-500">{it.pageCount ? `${it.pageCount}p` : `${Math.round(it.charCount / 1000)}千字`}</div>
                <div className="text-zinc-500">{fmtDate(it.createdAt)}</div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
