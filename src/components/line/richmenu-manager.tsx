"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Plus, LayoutGrid, ImagePlus } from "lucide-react";
import { saveLineRichMenu, deleteLineRichMenu, reapplyLineRichMenus, publishLineRichMenu, seedSampleRichMenu } from "@/lib/actions/line";

const inputCls =
  "w-full px-3 py-2 text-sm border border-zinc-200 rounded-lg bg-white text-zinc-900 " +
  "focus:outline-none focus:ring-2 focus:ring-emerald-300 focus:border-emerald-400";
const smallCls = "px-2 py-1 text-xs border border-zinc-200 rounded bg-white";

export type LayoutDef = { key: string; label: string; cols: number; rows: number; width: number; height: number };
export type Area = { type: "uri" | "tag" | "message"; value: string; label: string };
export type MenuDef = {
  id: string;
  name: string;
  layout: string;
  chatBarText: string;
  areas: Area[];
  hasImage: boolean;
  lineRichMenuId: string | null;
  isDefault: boolean;
  ruleTag: string | null;
  priority: number;
  lastError: string | null;
  linkedCount: number;
};

function MenuForm({ accountId, layouts, initial, tagNames, onClose }: { accountId: string; layouts: LayoutDef[]; initial?: MenuDef; tagNames: string[]; onClose: () => void }) {
  const router = useRouter();
  const [layout, setLayout] = useState(initial?.layout ?? "L6");
  const L = layouts.find((l) => l.key === layout) ?? layouts[0];
  const n = L.cols * L.rows;
  const [areas, setAreas] = useState<Area[]>(() => {
    const base = initial?.areas ?? [];
    return Array.from({ length: 6 }, (_, i) => base[i] ?? { type: "uri", value: "", label: "" });
  });
  const [error, setError] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [fileName, setFileName] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function onPick(f: File | null) {
    if (!f) {
      setPreview(null);
      setFileName(null);
      return;
    }
    setFileName(`${f.name}（${Math.round(f.size / 1024)}KB）`);
    const url = URL.createObjectURL(f);
    setPreview(url);
  }

  function upd(i: number, patch: Partial<Area>) {
    setAreas((p) => p.map((a, j) => (j === i ? { ...a, ...patch } : a)));
  }
  function submit(fd: FormData) {
    fd.set("areas", JSON.stringify(areas.slice(0, n)));
    startTransition(async () => {
      const r = await saveLineRichMenu(null, fd);
      if (r.error) {
        setError(r.error);
        return;
      }
      setError(null);
      setMsg(typeof r.message === "string" ? r.message : "保存しました");
      router.refresh();
      onClose();
    });
  }

  return (
    <form action={submit} className="bg-white rounded-xl border border-emerald-200 p-4 space-y-3">
      <input type="hidden" name="accountId" value={accountId} />
      {initial && <input type="hidden" name="id" value={initial.id} />}
      <div className="grid sm:grid-cols-[1fr_200px_140px] gap-2">
        <input name="name" defaultValue={initial?.name ?? ""} placeholder="メニュー名（管理用）" className={inputCls} required />
        <select name="layout" value={layout} onChange={(e) => setLayout(e.target.value)} className={inputCls}>
          {layouts.map((l) => (
            <option key={l.key} value={l.key}>{l.label}</option>
          ))}
        </select>
        <input name="chatBarText" defaultValue={initial?.chatBarText ?? "メニュー"} placeholder="下部バーの文字" maxLength={14} className={inputCls} />
      </div>

      <div className="grid sm:grid-cols-[1fr_260px] gap-3">
        <div className="space-y-2">
          <p className="text-[11px] font-bold text-zinc-500">ボタン（左上から順・{n}個）</p>
          {Array.from({ length: n }, (_, i) => (
            <div key={i} className="flex items-center gap-2 flex-wrap bg-zinc-50/60 border border-zinc-200 rounded-lg p-2">
              <span className="text-[11px] text-zinc-500 w-5">{i + 1}</span>
              <select value={areas[i].type} onChange={(e) => upd(i, { type: e.target.value as Area["type"] })} className={smallCls}>
                <option value="uri">URLを開く</option>
                <option value="tag">タグを付ける</option>
                <option value="message">メッセージを送る</option>
              </select>
              <input
                value={areas[i].value}
                onChange={(e) => upd(i, { value: e.target.value })}
                placeholder={areas[i].type === "uri" ? "https://…" : areas[i].type === "tag" ? "タグ名" : "送信される文言"}
                className={`${smallCls} flex-1 min-w-40`}
                list={areas[i].type === "tag" ? "line-tag-names-rm" : undefined}
              />
              <input value={areas[i].label} onChange={(e) => upd(i, { label: e.target.value })} placeholder="ラベル（任意）" className={`${smallCls} w-32`} maxLength={20} />
            </div>
          ))}
          <datalist id="line-tag-names-rm">{tagNames.map((t) => <option key={t} value={t} />)}</datalist>
        </div>
        <div className="space-y-2">
          <p className="text-[11px] font-bold text-zinc-500">画像</p>
          <div className="border border-dashed border-zinc-300 rounded-lg overflow-hidden bg-zinc-50" style={{ aspectRatio: `${L.width} / ${L.height}` }}>
            {preview ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={preview} alt="" className="w-full h-full object-cover" />
            ) : initial?.hasImage ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={`/api/line/richmenu-image/${initial.id}`} alt="" className="w-full h-full object-cover" />
            ) : (
              <div className="w-full h-full grid" style={{ gridTemplateColumns: `repeat(${L.cols}, 1fr)`, gridTemplateRows: `repeat(${L.rows}, 1fr)` }}>
                {Array.from({ length: n }, (_, i) => (
                  <div key={i} className="border border-zinc-200 flex items-center justify-center text-[11px] text-zinc-400">{i + 1}</div>
                ))}
              </div>
            )}
          </div>
          <label className="flex items-center justify-center gap-1.5 w-full px-3 py-2 bg-zinc-800 text-white text-xs font-bold rounded-lg cursor-pointer hover:bg-zinc-900">
            <ImagePlus className="w-3.5 h-3.5" />
            {initial?.hasImage ? "画像を差し替える" : "画像を選ぶ（PNG / JPEG）"}
            <input type="file" name="image" accept="image/png,image/jpeg" className="sr-only" onChange={(e) => onPick(e.target.files?.[0] ?? null)} />
          </label>
          <p className="text-[11px] text-zinc-600">{fileName ?? (initial?.hasImage ? "現在の画像を使います（変えるときだけ選択）" : "まだ画像が選ばれていません")}</p>
          <p className="text-[11px] text-zinc-400">サイズ {L.width}×{L.height}px・1MB以下。Canva等で「カスタムサイズ」にこの数値を入れて作れます。</p>
        </div>
      </div>

      <div className="grid sm:grid-cols-[auto_1fr_120px] gap-3 items-center">
        <label className="text-xs text-zinc-700 flex items-center gap-1.5">
          <input type="checkbox" name="isDefault" value="on" defaultChecked={initial?.isDefault ?? false} />全員の既定メニューにする
        </label>
        <input name="ruleTag" defaultValue={initial?.ruleTag ?? ""} placeholder="このタグを持つ人に自動で切り替える（任意）" className={inputCls} list="line-tag-names-rm" />
        <input name="priority" type="number" min={0} max={99} defaultValue={initial?.priority ?? 0} title="優先順位（小さいほど優先）" className={inputCls} />
      </div>

      {error && <p className="text-xs text-red-600 whitespace-pre-wrap">{error}</p>}
      {msg && <p className="text-xs text-emerald-700">{msg}</p>}
      <div className="flex justify-end gap-2">
        <button type="button" onClick={onClose} className="px-3 py-1.5 text-xs rounded-lg border border-zinc-200">やめる</button>
        <button type="submit" disabled={isPending} className="flex items-center gap-1 px-4 py-2 text-xs font-bold rounded-lg bg-emerald-600 text-white disabled:opacity-50">
          {isPending && <Loader2 className="w-3 h-3 animate-spin" />}保存してLINEへ登録
        </button>
      </div>
    </form>
  );
}

export function RichMenuManager({ accountId, layouts, menus, tagNames }: { accountId: string; layouts: LayoutDef[]; menus: MenuDef[]; tagNames: string[] }) {
  const router = useRouter();
  const [adding, setAdding] = useState(false);
  const [editing, setEditing] = useState<string | null>(null);
  const [confirm, setConfirm] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <p className="text-xs text-zinc-500">
          既定メニュー＝全員に出るもの。「タグで自動切替」を設定すると、そのタグが付いた瞬間にその人だけメニューが変わります（例: 加盟者→会員メニュー）。
        </p>
        <div className="flex items-center gap-2">
          <button
            type="button"
            disabled={isPending}
            onClick={() => startTransition(async () => { const r = await seedSampleRichMenu(accountId); setMsg(r.error ?? (typeof r.message === "string" ? r.message : "完了")); router.refresh(); })}
            className="px-3 py-1.5 text-xs rounded-lg border border-emerald-300 text-emerald-700 hover:bg-emerald-50"
          >
            サンプルを投入（画像付き）
          </button>
          <button
            type="button"
            disabled={isPending}
            onClick={() => startTransition(async () => { const r = await reapplyLineRichMenus(accountId); setMsg(r.error ?? (typeof r.message === "string" ? r.message : "完了")); router.refresh(); })}
            className="px-3 py-1.5 text-xs rounded-lg border border-zinc-200 hover:bg-zinc-50"
          >
            全員にルールを当て直す
          </button>
          {!adding && (
            <button type="button" onClick={() => setAdding(true)} className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-600 text-white text-xs font-medium rounded-lg hover:bg-emerald-700">
              <Plus className="w-3.5 h-3.5" />メニューを作る
            </button>
          )}
        </div>
      </div>
      {msg && <p className="text-[11px] text-zinc-500">{msg}</p>}
      {adding && <MenuForm accountId={accountId} layouts={layouts} tagNames={tagNames} onClose={() => setAdding(false)} />}

      {menus.length === 0 ? (
        <div className="bg-white rounded-xl border border-dashed border-zinc-300 p-8 text-center text-sm text-zinc-500">まだメニューはありません。</div>
      ) : (
        <div className="grid md:grid-cols-2 gap-3">
          {menus.map((m) =>
            editing === m.id ? (
              <div key={m.id} className="md:col-span-2"><MenuForm accountId={accountId} layouts={layouts} initial={m} tagNames={tagNames} onClose={() => setEditing(null)} /></div>
            ) : (
              <div key={m.id} className="bg-white rounded-xl border border-zinc-200 p-4 flex gap-4">
                <div className="w-[140px] shrink-0 rounded-lg overflow-hidden bg-zinc-100 border border-zinc-200" style={{ aspectRatio: m.layout.startsWith("S") ? "2500/843" : "2500/1686" }}>
                  {m.hasImage ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={`/api/line/richmenu-image/${m.id}`} alt="" className="w-full h-full object-cover" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-[11px] text-zinc-400"><LayoutGrid className="w-4 h-4" /></div>
                  )}
                </div>
                <div className="min-w-0 flex-1 space-y-1">
                  <p className="text-sm font-bold text-zinc-900 flex items-center gap-2 flex-wrap">
                    {m.name}
                    {m.isDefault && <span className="text-[10px] bg-emerald-50 text-emerald-700 rounded px-1.5">既定</span>}
                    <span className={`text-[10px] rounded px-1.5 ${m.lineRichMenuId ? "bg-zinc-100 text-zinc-600" : "bg-amber-50 text-amber-700"}`}>{m.lineRichMenuId ? "LINE登録済" : "未登録（画像なし）"}</span>
                  </p>
                  <p className="text-[11px] text-zinc-500">
                    {layouts.find((l) => l.key === m.layout)?.label ?? m.layout} ・ ボタン{m.areas.filter((a) => a.value).length}個
                    {m.ruleTag ? ` ・ タグ「${m.ruleTag}」で自動切替（優先${m.priority}）` : ""}
                    {m.linkedCount > 0 ? ` ・ 個別適用 ${m.linkedCount}人` : ""}
                  </p>
                  {m.lastError && <p className="text-[11px] text-red-600">{m.lastError}</p>}
                  <div className="flex items-center gap-2 pt-1 flex-wrap">
                    {m.hasImage && (
                      <button
                        type="button"
                        disabled={isPending}
                        onClick={() => startTransition(async () => { const r = await publishLineRichMenu(accountId, m.id); setMsg(r.error ?? (typeof r.message === "string" ? r.message : "完了")); router.refresh(); })}
                        className={`px-2.5 py-1 text-xs rounded-lg ${m.lineRichMenuId ? "border border-zinc-200 hover:bg-zinc-50" : "bg-emerald-600 text-white hover:bg-emerald-700"}`}
                      >
                        {m.lineRichMenuId ? "LINEへ再登録" : "LINEへ登録"}
                      </button>
                    )}
                    <button type="button" onClick={() => setEditing(m.id)} className="px-2.5 py-1 text-xs rounded-lg border border-zinc-200 hover:bg-zinc-50">編集</button>
                    {confirm === m.id ? (
                      <>
                        <button type="button" disabled={isPending} onClick={() => startTransition(async () => { const r = await deleteLineRichMenu(accountId, m.id); setMsg(r.error ?? "削除しました"); setConfirm(null); router.refresh(); })} className="px-2.5 py-1 text-xs rounded-lg bg-red-600 text-white">本当に削除</button>
                        <button type="button" onClick={() => setConfirm(null)} className="px-2.5 py-1 text-xs rounded-lg border border-zinc-200">やめる</button>
                      </>
                    ) : (
                      <button type="button" onClick={() => setConfirm(m.id)} className="px-2.5 py-1 text-xs rounded-lg border border-red-200 text-red-600 hover:bg-red-50">削除</button>
                    )}
                  </div>
                </div>
              </div>
            ),
          )}
        </div>
      )}
    </div>
  );
}
