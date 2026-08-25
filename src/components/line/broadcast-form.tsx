"use client";

import { useState, useTransition, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Plus, X } from "lucide-react";
import { createLineBroadcast, countBroadcastTargets } from "@/lib/actions/line";

const inputCls =
  "w-full px-3 py-2 text-sm border border-zinc-200 rounded-lg bg-white text-zinc-900 " +
  "focus:outline-none focus:ring-2 focus:ring-emerald-300 focus:border-emerald-400";
const labelCls = "block text-[11px] font-bold text-zinc-500 mb-1";

export function BroadcastForm({ accountId, allTags }: { accountId: string; allTags: string[] }) {
  const router = useRouter();
  const ref = useRef<HTMLFormElement>(null);
  const [open, setOpen] = useState(false);
  const [filterTags, setFilterTags] = useState("");
  const [excludeTags, setExcludeTags] = useState("");
  const [count, setCount] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    if (!open) return;
    const t = setTimeout(() => {
      countBroadcastTargets(accountId, filterTags, excludeTags).then(setCount).catch(() => setCount(null));
    }, 300);
    return () => clearTimeout(t);
  }, [open, accountId, filterTags, excludeTags]);

  function submit(fd: FormData) {
    startTransition(async () => {
      const res = await createLineBroadcast(null, fd);
      if (res.error) {
        setError(res.error);
        return;
      }
      setError(null);
      setOpen(false);
      router.refresh();
    });
  }

  if (!open) {
    return (
      <button type="button" onClick={() => setOpen(true)} className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-600 text-white text-xs font-medium rounded-lg hover:bg-emerald-700">
        <Plus className="w-3.5 h-3.5" />一斉配信を作る
      </button>
    );
  }

  return (
    <form ref={ref} action={submit} className="bg-white rounded-xl border border-emerald-200 p-4 space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-sm font-bold text-zinc-900">一斉配信</p>
        <button type="button" onClick={() => setOpen(false)} className="text-zinc-400 hover:text-zinc-700"><X className="w-4 h-4" /></button>
      </div>
      <input type="hidden" name="accountId" value={accountId} />
      <div className="grid sm:grid-cols-[1fr_220px] gap-3">
        <div>
          <label className={labelCls}>タイトル（管理用）</label>
          <input name="title" className={inputCls} required />
        </div>
        <div>
          <label className={labelCls}>送信日時（空＝今すぐ・JST）</label>
          <input name="scheduledAt" type="datetime-local" className={inputCls} />
        </div>
      </div>
      <div className="grid sm:grid-cols-2 gap-3">
        <div>
          <label className={labelCls}>いずれかのタグを持つ人（空＝全員）</label>
          <input name="filterTags" value={filterTags} onChange={(e) => setFilterTags(e.target.value)} className={inputCls} placeholder="カンマ区切り" list="line-tags" />
        </div>
        <div>
          <label className={labelCls}>このタグを持つ人は除外</label>
          <input name="excludeTags" value={excludeTags} onChange={(e) => setExcludeTags(e.target.value)} className={inputCls} placeholder="カンマ区切り" list="line-tags" />
        </div>
        <datalist id="line-tags">
          {allTags.map((t) => (
            <option key={t} value={t} />
          ))}
        </datalist>
      </div>
      <div>
        <label className={labelCls}>本文</label>
        <textarea name="text" rows={6} className={inputCls} required placeholder="{name} で相手の表示名、{link:名前} で計測リンク（設定タブで登録）" />
      </div>
      <div className="flex items-center justify-between">
        <span className="text-xs text-zinc-600">
          {error ? <span className="text-red-600">{error}</span> : count === null ? "対象人数を計算中…" : <>対象 <b>{count}</b> 人（プッシュ枠を{count}通消費）</>}
        </span>
        <button type="submit" disabled={isPending} className="flex items-center gap-1.5 px-4 py-2 bg-emerald-600 text-white text-xs font-bold rounded-lg hover:bg-emerald-700 disabled:opacity-50">
          {isPending && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
          登録する
        </button>
      </div>
    </form>
  );
}
