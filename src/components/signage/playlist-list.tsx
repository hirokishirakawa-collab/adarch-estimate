"use client";
import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Plus, Trash2 } from "lucide-react";
import { btnDanger, btnPrimary, input } from "./shared";

type Row = { id: string; name: string; updatedAt: string; branch: { id: string; name: string } | null; _count: { items: number; schedules: number } };

export function PlaylistList() {
  const [rows, setRows] = useState<Row[] | null>(null);
  const [name, setName] = useState("");
  const router = useRouter();
  const load = useCallback(async () => { const r = await fetch("/api/signage/playlists", { cache: "no-store" }); if (r.ok) setRows(await r.json()); }, []);
  useEffect(() => { void Promise.resolve().then(load); }, [load]);

  const create = async () => {
    if (!name.trim()) return;
    const r = await fetch("/api/signage/playlists", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name }) });
    const j = await r.json();
    if (!r.ok) { toast.error(j.error ?? "作成に失敗"); return; }
    router.push(`/dashboard/signage/playlists/${j.id}`);
  };
  const del = async (row: Row) => {
    if (!confirm(`「${row.name}」を削除しますか？（${row._count.schedules}台の端末から外れます）`)) return;
    const r = await fetch(`/api/signage/playlists/${row.id}`, { method: "DELETE" });
    if (r.ok) { toast.success("削除しました"); load(); } else toast.error("削除に失敗しました");
  };

  return (
    <div>
      <div className="flex gap-2 mb-4 max-w-md">
        <input className={input} placeholder="新しいプレイリスト名（例: 標準・年末セール）" value={name} onChange={(e) => setName(e.target.value)} onKeyDown={(e) => e.key === "Enter" && create()} />
        <button className={btnPrimary} onClick={create}><Plus className="w-3.5 h-3.5" />作成</button>
      </div>
      {rows === null ? <p className="text-sm text-zinc-400 py-8 text-center">読み込み中…</p> : rows.length === 0 ? (
        <div className="bg-white border border-dashed border-zinc-300 rounded-xl p-8 text-center text-sm text-zinc-500">プレイリストがありません。まず「標準」を作って、端末に割り当ててください</div>
      ) : (
        <div className="bg-white border border-zinc-200 rounded-xl divide-y divide-zinc-100">
          {rows.map((r) => (
            <div key={r.id} className="flex items-center justify-between px-4 py-3">
              <Link href={`/dashboard/signage/playlists/${r.id}`} className="min-w-0">
                <div className="font-medium text-zinc-900 hover:text-orange-700">{r.name}</div>
                <div className="text-xs text-zinc-500">{r._count.items}枠・端末{r._count.schedules}台・{r.branch?.name ?? "本部"}</div>
              </Link>
              <button className={btnDanger} onClick={() => del(r)}><Trash2 className="w-3 h-3" />削除</button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
