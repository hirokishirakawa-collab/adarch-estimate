"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Plus, MousePointerClick } from "lucide-react";
import { saveLineLink, deleteLineLink } from "@/lib/actions/line";

const inputCls =
  "w-full px-3 py-2 text-sm border border-zinc-200 rounded-lg bg-white text-zinc-900 " +
  "focus:outline-none focus:ring-2 focus:ring-emerald-300 focus:border-emerald-400";

export type LinkDef = { id: string; label: string; code: string; url: string; addTags: string[]; clickCount: number; uniqueCount: number };

function LinkForm({ accountId, initial, tagNames, onClose }: { accountId: string; initial?: LinkDef; tagNames: string[]; onClose: () => void }) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  function submit(fd: FormData) {
    startTransition(async () => {
      const r = await saveLineLink(null, fd);
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
      <div className="grid sm:grid-cols-2 gap-2">
        <input name="label" defaultValue={initial?.label ?? ""} placeholder="表示名（例: 会社紹介資料）" className={inputCls} required />
        <input name="code" defaultValue={initial?.code ?? ""} placeholder="本文で使う名前（例: 資料 → {link:資料}）" className={inputCls} required />
      </div>
      <input name="url" type="url" defaultValue={initial?.url ?? ""} placeholder="https://（転送先）" className={inputCls} required />
      <input name="addTags" defaultValue={initial?.addTags.join(", ") ?? ""} placeholder="クリックしたら付けるタグ（カンマ区切り・任意）" className={inputCls} list="line-tag-names-link" />
      <datalist id="line-tag-names-link">{tagNames.map((t) => <option key={t} value={t} />)}</datalist>
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

export function LinkManager({ accountId, links, tagNames }: { accountId: string; links: LinkDef[]; tagNames: string[] }) {
  const router = useRouter();
  const [adding, setAdding] = useState(false);
  const [editing, setEditing] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  return (
    <section className="bg-white rounded-xl border border-zinc-200 p-4 space-y-3">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div>
          <p className="text-sm font-bold text-zinc-900 flex items-center gap-1.5"><MousePointerClick className="w-4 h-4 text-emerald-700" />計測リンク（URLクリック計測）</p>
          <p className="text-[11px] text-zinc-400">
            本文に <code className="bg-zinc-100 rounded px-1">{"{link:名前}"}</code> と書くと相手ごとの計測URLに置き換わります。誰がいつクリックしたかがチャットに残り、タグも付けられます。
          </p>
        </div>
        {!adding && (
          <button type="button" onClick={() => setAdding(true)} className="flex items-center gap-1 px-3 py-1.5 text-xs font-medium rounded-lg bg-emerald-600 text-white hover:bg-emerald-700">
            <Plus className="w-3.5 h-3.5" />リンクを追加
          </button>
        )}
      </div>
      {adding && <LinkForm accountId={accountId} tagNames={tagNames} onClose={() => setAdding(false)} />}
      {links.length === 0 ? (
        <p className="text-xs text-zinc-400">まだリンクはありません。</p>
      ) : (
        <ul className="divide-y divide-zinc-100">
          {links.map((l) =>
            editing === l.id ? (
              <li key={l.id} className="py-2"><LinkForm accountId={accountId} initial={l} tagNames={tagNames} onClose={() => setEditing(null)} /></li>
            ) : (
              <li key={l.id} className="py-2 flex items-start gap-3">
                <div className="min-w-0 flex-1">
                  <p className="text-xs font-bold text-zinc-800">
                    {l.label} <code className="ml-1 text-[10px] bg-zinc-100 rounded px-1 font-normal">{`{link:${l.code}}`}</code>
                  </p>
                  <p className="text-[11px] text-zinc-500 truncate">{l.url}</p>
                  {l.addTags.length > 0 && <p className="text-[11px] text-zinc-500">クリックでタグ: {l.addTags.join(", ")}</p>}
                </div>
                <span className="text-[11px] text-zinc-600 tabular-nums shrink-0">クリック {l.clickCount}回 ／ {l.uniqueCount}人</span>
                <span className="flex items-center gap-1.5 shrink-0">
                  <button type="button" onClick={() => setEditing(l.id)} className="text-[11px] text-zinc-500 hover:text-zinc-900">編集</button>
                  <button type="button" disabled={isPending} onClick={() => startTransition(async () => { await deleteLineLink(accountId, l.id); router.refresh(); })} className="text-[11px] text-zinc-400 hover:text-red-600">削除</button>
                </span>
              </li>
            ),
          )}
        </ul>
      )}
    </section>
  );
}
