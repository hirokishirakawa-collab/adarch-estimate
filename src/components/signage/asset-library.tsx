"use client";
// 素材ライブラリ: アップロード（進捗つき）・一覧・ゴミ箱
import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { Trash2, Upload, RotateCcw, Film, Image as ImageIcon } from "lucide-react";
import { btnDanger, btnGhost, btnPrimary, fmtBytes, fmtSec } from "./shared";

export type Asset = {
  id: string; originalName: string; mimeType: string; sizeBytes: number; durationSec: number | null;
  width: number | null; height: number | null; thumbName: string | null; trashedAt: string | null; createdAt: string;
  branch: { id: string; name: string } | null; _count: { items: number };
};

export function AssetLibrary({ pickMode, onPick }: { pickMode?: boolean; onPick?: (a: Asset) => void }) {
  const [assets, setAssets] = useState<Asset[] | null>(null);
  const [trash, setTrash] = useState(false);
  const [q, setQ] = useState("");
  const [progress, setProgress] = useState<{ name: string; pct: number } | null>(null);
  const fileRef = useRef<HTMLInputElement | null>(null);

  const load = useCallback(async () => {
    const r = await fetch(`/api/signage/assets?trash=${trash ? 1 : 0}&q=${encodeURIComponent(q)}`, { cache: "no-store" });
    if (r.ok) setAssets(await r.json());
  }, [trash, q]);
  useEffect(() => { void Promise.resolve().then(load); }, [load]);

  const upload = (files: FileList | null) => {
    if (!files || files.length === 0) return;
    const list = Array.from(files);
    (async () => {
      for (const f of list) {
        await new Promise<void>((resolve) => {
          const xhr = new XMLHttpRequest();
          xhr.open("POST", "/api/signage/assets");
          xhr.upload.onprogress = (e) => { if (e.lengthComputable) setProgress({ name: f.name, pct: Math.round((e.loaded / e.total) * 100) }); };
          xhr.onload = () => {
            try {
              const j = JSON.parse(xhr.responseText);
              if (xhr.status >= 200 && xhr.status < 300) toast.success(`${f.name} を追加しました`);
              else toast.error(`${f.name}: ${j.error ?? "失敗"}`);
            } catch { toast.error(`${f.name}: 失敗`); }
            resolve();
          };
          xhr.onerror = () => { toast.error(`${f.name}: 通信エラー`); resolve(); };
          const fd = new FormData(); fd.append("file", f);
          xhr.send(fd);
        });
      }
      setProgress(null);
      load();
    })();
  };

  const toggleTrash = async (a: Asset) => {
    const r = await fetch(`/api/signage/assets/${a.id}${a.trashedAt ? "?restore=1" : ""}`, { method: "DELETE" });
    if (r.ok) { toast.success(a.trashedAt ? "戻しました" : "ゴミ箱に入れました（使用中の端末からも外れます）"); load(); }
    else toast.error("失敗しました");
  };

  return (
    <div>
      <div className="flex items-center justify-between gap-3 mb-4 flex-wrap">
        <div className="flex items-center gap-2">
          <input className="px-3 py-1.5 text-sm border border-zinc-200 rounded-lg" placeholder="ファイル名で検索" value={q} onChange={(e) => setQ(e.target.value)} />
          <button className={trash ? btnPrimary : btnGhost} onClick={() => setTrash((v) => !v)}><Trash2 className="w-3.5 h-3.5" />{trash ? "ゴミ箱を表示中" : "ゴミ箱"}</button>
        </div>
        {!pickMode && (
          <div>
            <input ref={fileRef} type="file" accept="image/jpeg,image/png,video/mp4" multiple hidden onChange={(e) => { upload(e.target.files); e.target.value = ""; }} />
            <button className={btnPrimary} onClick={() => fileRef.current?.click()} disabled={!!progress}><Upload className="w-3.5 h-3.5" />アップロード</button>
          </div>
        )}
      </div>
      <p className="text-xs text-zinc-500 mb-3">jpg / png / mp4・動画は8秒以上・1ファイル1GBまで。画像は表示秒数をプレイリスト側で指定します。</p>

      {progress && (
        <div className="mb-4 bg-white border border-zinc-200 rounded-lg p-3">
          <div className="text-xs text-zinc-600 mb-1">{progress.name} — {progress.pct}%{progress.pct === 100 ? "（サーバーで処理中…）" : ""}</div>
          <div className="h-1.5 bg-zinc-100 rounded"><div className="h-1.5 bg-orange-500 rounded" style={{ width: `${progress.pct}%` }} /></div>
        </div>
      )}

      {assets === null ? (
        <p className="text-sm text-zinc-400 py-8 text-center">読み込み中…</p>
      ) : assets.length === 0 ? (
        <div className="bg-white border border-dashed border-zinc-300 rounded-xl p-8 text-center text-sm text-zinc-500">{trash ? "ゴミ箱は空です" : "素材がありません。アップロードしてください"}</div>
      ) : (
        <div className="grid gap-3 grid-cols-2 md:grid-cols-3 xl:grid-cols-5">
          {assets.map((a) => (
            <div key={a.id} className="bg-white border border-zinc-200 rounded-xl overflow-hidden">
              <div className="aspect-video bg-zinc-100 flex items-center justify-center overflow-hidden">
                {/* eslint-disable-next-line @next/next/no-img-element -- 認証付きサムネAPI */}
                {a.thumbName ? <img src={`/api/signage/assets/${a.id}/thumb`} alt="" className="w-full h-full object-cover" /> : a.mimeType.startsWith("video/") ? <Film className="w-8 h-8 text-zinc-400" /> : <ImageIcon className="w-8 h-8 text-zinc-400" />}
              </div>
              <div className="p-2.5">
                <div className="text-xs font-medium text-zinc-800 truncate" title={a.originalName}>{a.originalName}</div>
                <div className="text-[11px] text-zinc-500 mt-0.5">
                  {a.mimeType.startsWith("video/") ? `動画 ${fmtSec(a.durationSec)}` : "画像"}・{fmtBytes(a.sizeBytes)}{a.width ? `・${a.width}×${a.height}` : ""}
                </div>
                <div className="text-[11px] text-zinc-400">{a.branch?.name ?? "本部"}・使用 {a._count.items}枠</div>
                <div className="flex gap-1.5 mt-2">
                  {pickMode ? (
                    <button className={btnPrimary} onClick={() => onPick?.(a)}>この素材を追加</button>
                  ) : (
                    <button className={a.trashedAt ? btnGhost : btnDanger} onClick={() => toggleTrash(a)}>
                      {a.trashedAt ? <><RotateCcw className="w-3 h-3" />戻す</> : <><Trash2 className="w-3 h-3" />ゴミ箱</>}
                    </button>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
