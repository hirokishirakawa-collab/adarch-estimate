"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Plus } from "lucide-react";
import { saveLineCannedReply, deleteLineCannedReply } from "@/lib/actions/line";

const inputCls =
  "w-full px-3 py-2 text-sm border border-zinc-200 rounded-lg bg-white text-zinc-900 " +
  "focus:outline-none focus:ring-2 focus:ring-emerald-300 focus:border-emerald-400";

export type Canned = { id: string; title: string; text: string };

/** 設定タブ：定型文の管理 */
export function CannedReplyManager({ accountId, items }: { accountId: string; items: Canned[] }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function submit(fd: FormData) {
    startTransition(async () => {
      const r = await saveLineCannedReply(null, fd);
      if (r.error) {
        setError(r.error);
        return;
      }
      setError(null);
      setOpen(false);
      router.refresh();
    });
  }
  function remove(id: string) {
    startTransition(async () => {
      await deleteLineCannedReply(accountId, id);
      router.refresh();
    });
  }

  return (
    <section className="bg-white rounded-xl border border-zinc-200 p-4 space-y-3">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm font-bold text-zinc-900">チャットの定型文</p>
          <p className="text-[11px] text-zinc-400">チャット画面の「定型文」から本文に差し込めます。{"{name}"} で相手の表示名。</p>
        </div>
        {!open && (
          <button type="button" onClick={() => setOpen(true)} className="flex items-center gap-1 px-3 py-1.5 text-xs font-medium rounded-lg border border-zinc-200 hover:bg-zinc-50">
            <Plus className="w-3.5 h-3.5" />追加
          </button>
        )}
      </div>
      {open && (
        <form action={submit} className="space-y-2 border border-emerald-200 rounded-lg p-3">
          <input type="hidden" name="accountId" value={accountId} />
          <input name="title" placeholder="タイトル（例: 初回のご挨拶）" className={inputCls} required />
          <textarea name="text" rows={4} placeholder="本文" className={inputCls} required />
          {error && <p className="text-xs text-red-600">{error}</p>}
          <div className="flex justify-end gap-2">
            <button type="button" onClick={() => setOpen(false)} className="px-3 py-1.5 text-xs rounded-lg border border-zinc-200">やめる</button>
            <button type="submit" disabled={isPending} className="flex items-center gap-1 px-3 py-1.5 text-xs font-bold rounded-lg bg-emerald-600 text-white disabled:opacity-50">
              {isPending && <Loader2 className="w-3 h-3 animate-spin" />}保存
            </button>
          </div>
        </form>
      )}
      {items.length === 0 ? (
        <p className="text-xs text-zinc-400">まだ定型文はありません。</p>
      ) : (
        <ul className="divide-y divide-zinc-100">
          {items.map((c) => (
            <li key={c.id} className="py-2 flex items-start gap-3">
              <div className="min-w-0 flex-1">
                <p className="text-xs font-bold text-zinc-800">{c.title}</p>
                <p className="text-xs text-zinc-500 whitespace-pre-wrap line-clamp-2">{c.text}</p>
              </div>
              <button type="button" onClick={() => remove(c.id)} className="text-[11px] text-zinc-400 hover:text-red-600 shrink-0">削除</button>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
