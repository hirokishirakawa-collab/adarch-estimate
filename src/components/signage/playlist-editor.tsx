"use client";
// プレイリスト（枠）編集: 並べ替え・秒数・広告主・掲載期間 → PUT /items で一括保存
import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { ArrowDown, ArrowUp, Plus, Save, Trash2, X } from "lucide-react";
import { AssetLibrary, type Asset } from "./asset-library";
import { CustomerPicker, btnDanger, btnGhost, btnPrimary, fmtSec, input, label } from "./shared";

type Item = {
  key: string; assetId: string; asset: Asset; durationSec: number;
  advertiser: { id: string; name: string } | null; startDate: string; endDate: string;
};
type Playlist = {
  id: string; name: string;
  items: { id: string; assetId: string; asset: Asset; durationSec: number; advertiserCustomer: { id: string; name: string } | null; startDate: string | null; endDate: string | null }[];
  schedules: { id: string; device: { id: string; name: string } }[];
};

const d10 = (s: string | null) => (s ? s.slice(0, 10) : "");

export function PlaylistEditor({ playlistId }: { playlistId: string }) {
  const [pl, setPl] = useState<Playlist | null>(null);
  const [name, setName] = useState("");
  const [items, setItems] = useState<Item[]>([]);
  const [picking, setPicking] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    const r = await fetch(`/api/signage/playlists/${playlistId}`, { cache: "no-store" });
    if (!r.ok) { toast.error("プレイリストが見つかりません"); return; }
    const j: Playlist = await r.json();
    setPl(j); setName(j.name);
    setItems(j.items.map((it) => ({ key: it.id, assetId: it.assetId, asset: it.asset, durationSec: it.durationSec, advertiser: it.advertiserCustomer, startDate: d10(it.startDate), endDate: d10(it.endDate) })));
    setDirty(false);
  }, [playlistId]);
  useEffect(() => { load(); }, [load]);

  const update = (i: number, patch: Partial<Item>) => { setItems((arr) => arr.map((it, k) => (k === i ? { ...it, ...patch } : it))); setDirty(true); };
  const move = (i: number, dir: -1 | 1) => {
    setItems((arr) => { const n = [...arr]; const j = i + dir; if (j < 0 || j >= n.length) return arr; [n[i], n[j]] = [n[j], n[i]]; return n; });
    setDirty(true);
  };
  const remove = (i: number) => { setItems((arr) => arr.filter((_, k) => k !== i)); setDirty(true); };
  const add = (a: Asset) => {
    setItems((arr) => [...arr, { key: `new-${Date.now()}-${arr.length}`, assetId: a.id, asset: a, durationSec: 15, advertiser: null, startDate: "", endDate: "" }]);
    setDirty(true); setPicking(false);
  };

  const save = async () => {
    setSaving(true);
    try {
      if (pl && name.trim() && name !== pl.name) {
        const r = await fetch(`/api/signage/playlists/${playlistId}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name }) });
        if (!r.ok) { toast.error("名前の保存に失敗しました"); return; }
      }
      const r = await fetch(`/api/signage/playlists/${playlistId}/items`, {
        method: "PUT", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ items: items.map((it) => ({ assetId: it.assetId, durationSec: it.durationSec, advertiserCustomerId: it.advertiser?.id ?? null, startDate: it.startDate || null, endDate: it.endDate ? `${it.endDate}T23:59:59` : null })) }),
      });
      const j = await r.json();
      if (!r.ok) { toast.error(j.error ?? "保存に失敗しました"); return; }
      toast.success(`保存しました。${pl?.schedules.length ?? 0}台の端末に次回の問い合わせで反映されます`);
      load();
    } finally { setSaving(false); }
  };

  const totalSec = items.reduce((s, it) => s + (it.asset.mimeType.startsWith("video/") ? Math.round(it.asset.durationSec ?? 0) : it.durationSec), 0);
  const sold = items.filter((it) => it.advertiser).length;

  if (!pl) return <p className="text-sm text-zinc-400 py-8 text-center">読み込み中…</p>;

  return (
    <div className="space-y-4">
      <div className="bg-white border border-zinc-200 rounded-xl p-4 grid gap-3 md:grid-cols-[1fr_auto] items-end">
        <div><label className={label}>プレイリスト名</label><input className={input} value={name} onChange={(e) => { setName(e.target.value); setDirty(true); }} /></div>
        <div className="text-xs text-zinc-600">
          1周 <b>{fmtSec(totalSec)}</b>・{items.length}枠（広告主あり {sold}／空き {items.length - sold}）<br />
          使用端末: {pl.schedules.length === 0 ? <span className="text-red-600">なし</span> : pl.schedules.map((s) => s.device.name).join("、")}
        </div>
      </div>

      <div className="bg-white border border-zinc-200 rounded-xl overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-zinc-50 text-xs text-zinc-500">
            <tr><th className="text-left px-3 py-2 w-10">#</th><th className="text-left px-3 py-2">素材</th><th className="text-left px-3 py-2 w-28">秒数</th><th className="text-left px-3 py-2">広告主（枠の売り先）</th><th className="text-left px-3 py-2 w-64">掲載期間</th><th className="w-28"></th></tr>
          </thead>
          <tbody>
            {items.length === 0 && <tr><td colSpan={6} className="px-3 py-8 text-center text-zinc-400">枠がありません。「素材を追加」から入れてください</td></tr>}
            {items.map((it, i) => {
              const isVideo = it.asset.mimeType.startsWith("video/");
              return (
                <tr key={it.key} className="border-t border-zinc-100 align-top">
                  <td className="px-3 py-2 text-zinc-400">{i + 1}</td>
                  <td className="px-3 py-2">
                    <div className="flex items-center gap-2">
                      {/* eslint-disable-next-line @next/next/no-img-element -- 認証付きサムネAPI */}
                      <div className="w-16 h-9 bg-zinc-100 rounded overflow-hidden flex-shrink-0">{it.asset.thumbName && <img src={`/api/signage/assets/${it.asset.id}/thumb`} alt="" className="w-full h-full object-cover" />}</div>
                      <div className="min-w-0"><div className="truncate text-zinc-800 text-xs font-medium" title={it.asset.originalName}>{it.asset.originalName}</div><div className="text-[11px] text-zinc-400">{isVideo ? `動画 ${fmtSec(it.asset.durationSec)}` : "画像"}</div></div>
                    </div>
                  </td>
                  <td className="px-3 py-2">{isVideo ? <span className="text-xs text-zinc-500">動画の長さ</span> : <input type="number" min={1} max={600} className={input} value={it.durationSec} onChange={(e) => update(i, { durationSec: Number(e.target.value) })} />}</td>
                  <td className="px-3 py-2"><CustomerPicker value={it.advertiser} onChange={(c) => update(i, { advertiser: c })} placeholder="空き枠（広告主を検索して設定）" /></td>
                  <td className="px-3 py-2"><div className="flex items-center gap-1"><input type="date" className={input} value={it.startDate} onChange={(e) => update(i, { startDate: e.target.value })} /><span className="text-zinc-400">〜</span><input type="date" className={input} value={it.endDate} onChange={(e) => update(i, { endDate: e.target.value })} /></div></td>
                  <td className="px-3 py-2">
                    <div className="flex gap-1">
                      <button className={btnGhost} onClick={() => move(i, -1)} disabled={i === 0} title="上へ"><ArrowUp className="w-3 h-3" /></button>
                      <button className={btnGhost} onClick={() => move(i, 1)} disabled={i === items.length - 1} title="下へ"><ArrowDown className="w-3 h-3" /></button>
                      <button className={btnDanger} onClick={() => remove(i)} title="外す"><Trash2 className="w-3 h-3" /></button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <div className="flex items-center justify-between">
        <button className={btnGhost} onClick={() => setPicking(true)}><Plus className="w-3.5 h-3.5" />素材を追加</button>
        <button className={btnPrimary} onClick={save} disabled={!dirty || saving}><Save className="w-3.5 h-3.5" />{saving ? "保存中…" : dirty ? "保存して端末に反映" : "保存済み"}</button>
      </div>

      {picking && (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4" onClick={() => setPicking(false)}>
          <div className="bg-white rounded-xl w-full max-w-5xl max-h-[85vh] overflow-auto p-5" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-3"><h3 className="font-bold">素材を選ぶ</h3><button className={btnGhost} onClick={() => setPicking(false)}><X className="w-3.5 h-3.5" />閉じる</button></div>
            <AssetLibrary pickMode onPick={add} />
          </div>
        </div>
      )}
    </div>
  );
}
