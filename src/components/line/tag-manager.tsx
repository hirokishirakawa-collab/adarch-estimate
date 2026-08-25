"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Plus, Tag } from "lucide-react";
import { saveLineTag, deleteLineTag, importLineTagsFromFriends } from "@/lib/actions/line";

const inputCls =
  "w-full px-3 py-2 text-sm border border-zinc-200 rounded-lg bg-white text-zinc-900 " +
  "focus:outline-none focus:ring-2 focus:ring-emerald-300 focus:border-emerald-400";
export const TAG_COLORS = ["#71717a", "#059669", "#2563eb", "#d97706", "#dc2626", "#7c3aed", "#db2777", "#0891b2"];

export type TagDef = { id: string; name: string; color: string; note: string | null; count: number };

/** タグのチップ（色つき） */
export function TagChip({ name, color }: { name: string; color?: string }) {
  const c = color ?? "#71717a";
  return (
    <span className="inline-flex items-center gap-1 text-[10px] rounded px-1.5 py-0.5 border" style={{ color: c, borderColor: `${c}55`, background: `${c}14` }}>
      <span className="w-1.5 h-1.5 rounded-full" style={{ background: c }} />
      {name}
    </span>
  );
}

function TagForm({ accountId, initial, onClose }: { accountId: string; initial?: TagDef; onClose: () => void }) {
  const router = useRouter();
  const [color, setColor] = useState(initial?.color ?? TAG_COLORS[0]);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  function submit(fd: FormData) {
    startTransition(async () => {
      const r = await saveLineTag(null, fd);
      if (r.error) {
        setError(r.error);
        return;
      }
      router.refresh();
      onClose();
    });
  }
  return (
    <form action={submit} className="border border-emerald-200 rounded-lg p-3 space-y-2">
      <input type="hidden" name="accountId" value={accountId} />
      {initial && <input type="hidden" name="id" value={initial.id} />}
      <input type="hidden" name="color" value={color} />
      <div className="grid sm:grid-cols-[1fr_1fr] gap-2">
        <input name="name" defaultValue={initial?.name ?? ""} placeholder="タグ名（例: 見込み）" className={inputCls} required />
        <input name="note" defaultValue={initial?.note ?? ""} placeholder="使いどころのメモ（任意）" className={inputCls} />
      </div>
      <div className="flex items-center gap-1.5">
        {TAG_COLORS.map((c) => (
          <button key={c} type="button" onClick={() => setColor(c)} className="w-5 h-5 rounded-full border-2" style={{ background: c, borderColor: color === c ? "#111" : "transparent" }} aria-label={c} />
        ))}
      </div>
      {error && <p className="text-xs text-red-600">{error}</p>}
      <div className="flex justify-end gap-2">
        <button type="button" onClick={onClose} className="px-3 py-1.5 text-xs rounded-lg border border-zinc-200">やめる</button>
        <button type="submit" disabled={isPending} className="flex items-center gap-1 px-3 py-1.5 text-xs font-bold rounded-lg bg-emerald-600 text-white disabled:opacity-50">
          {isPending && <Loader2 className="w-3 h-3 animate-spin" />}保存
        </button>
      </div>
    </form>
  );
}

export function TagManager({ accountId, tags }: { accountId: string; tags: TagDef[] }) {
  const router = useRouter();
  const [adding, setAdding] = useState(false);
  const [editing, setEditing] = useState<string | null>(null);
  const [confirm, setConfirm] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  return (
    <section className="bg-white rounded-xl border border-zinc-200 p-4 space-y-3">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div>
          <p className="text-sm font-bold text-zinc-900 flex items-center gap-1.5"><Tag className="w-4 h-4 text-emerald-700" />タグの設定</p>
          <p className="text-[11px] text-zinc-400">名前を変えると、付いている友だち・シナリオの開始条件・セミナー枠にも反映されます。</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            disabled={isPending}
            onClick={() =>
              startTransition(async () => {
                const r = await importLineTagsFromFriends(accountId);
                setMsg(r.error ?? (typeof r.message === "string" ? r.message : "完了"));
                router.refresh();
              })
            }
            className="px-3 py-1.5 text-xs rounded-lg border border-zinc-200 hover:bg-zinc-50"
          >
            使われているタグを取り込む
          </button>
          {!adding && (
            <button type="button" onClick={() => setAdding(true)} className="flex items-center gap-1 px-3 py-1.5 text-xs font-medium rounded-lg bg-emerald-600 text-white hover:bg-emerald-700">
              <Plus className="w-3.5 h-3.5" />タグを追加
            </button>
          )}
        </div>
      </div>
      {msg && <p className="text-[11px] text-zinc-500">{msg}</p>}
      {adding && <TagForm accountId={accountId} onClose={() => setAdding(false)} />}
      {tags.length === 0 ? (
        <p className="text-xs text-zinc-400">まだタグの定義はありません。友だちに付けたタグは「取り込む」で一覧にできます。</p>
      ) : (
        <ul className="divide-y divide-zinc-100">
          {tags.map((t) =>
            editing === t.id ? (
              <li key={t.id} className="py-2"><TagForm accountId={accountId} initial={t} onClose={() => setEditing(null)} /></li>
            ) : (
              <li key={t.id} className="py-2 flex items-center gap-3">
                <TagChip name={t.name} color={t.color} />
                <span className="text-[11px] text-zinc-400 tabular-nums">{t.count}人</span>
                {t.note && <span className="text-[11px] text-zinc-500 truncate">{t.note}</span>}
                <span className="ml-auto flex items-center gap-1.5">
                  <button type="button" onClick={() => setEditing(t.id)} className="text-[11px] text-zinc-500 hover:text-zinc-900">編集</button>
                  {confirm === t.id ? (
                    <>
                      <button type="button" disabled={isPending} onClick={() => startTransition(async () => { await deleteLineTag(accountId, t.id, false); setConfirm(null); router.refresh(); })} className="text-[11px] text-zinc-700 border border-zinc-200 rounded px-1.5">定義だけ削除</button>
                      <button type="button" disabled={isPending} onClick={() => startTransition(async () => { await deleteLineTag(accountId, t.id, true); setConfirm(null); router.refresh(); })} className="text-[11px] text-white bg-red-600 rounded px-1.5">友だちからも外して削除</button>
                      <button type="button" onClick={() => setConfirm(null)} className="text-[11px] text-zinc-400">やめる</button>
                    </>
                  ) : (
                    <button type="button" onClick={() => setConfirm(t.id)} className="text-[11px] text-zinc-400 hover:text-red-600">削除</button>
                  )}
                </span>
              </li>
            ),
          )}
        </ul>
      )}
    </section>
  );
}
