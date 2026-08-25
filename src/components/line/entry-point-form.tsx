"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Plus, X } from "lucide-react";
import { saveLineEntryPoint } from "@/lib/actions/line";

const inputCls =
  "w-full px-3 py-2 text-sm border border-zinc-200 rounded-lg bg-white text-zinc-900 " +
  "focus:outline-none focus:ring-2 focus:ring-emerald-300 focus:border-emerald-400";
const labelCls = "block text-[11px] font-bold text-zinc-500 mb-1";

export type EntryPointInput = {
  id?: string;
  name: string;
  tag: string;
  startsAt: string; // datetime-local（JST）
  endsAt: string;
  askOnFollow: boolean;
};

export function EntryPointForm({ accountId, initial, onClose }: { accountId: string; initial?: EntryPointInput; onClose?: () => void }) {
  const router = useRouter();
  const [name, setName] = useState(initial?.name ?? "");
  const [tag, setTag] = useState(initial?.tag ?? "");
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function submit(fd: FormData) {
    startTransition(async () => {
      const res = await saveLineEntryPoint(null, fd);
      if (res.error) {
        setError(res.error);
        return;
      }
      setError(null);
      router.refresh();
      onClose?.();
    });
  }

  return (
    <form action={submit} className="bg-white rounded-xl border border-emerald-200 p-4 space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-sm font-bold text-zinc-900">{initial?.id ? "枠を編集" : "セミナー・流入枠を登録"}</p>
        {onClose && (
          <button type="button" onClick={onClose} className="text-zinc-400 hover:text-zinc-700"><X className="w-4 h-4" /></button>
        )}
      </div>
      <input type="hidden" name="accountId" value={accountId} />
      {initial?.id && <input type="hidden" name="id" value={initial.id} />}
      <div className="grid sm:grid-cols-2 gap-3">
        <div>
          <label className={labelCls}>セミナー名（ボタンにもこの名前が出ます・20字まで推奨）</label>
          <input name="name" value={name} onChange={(e) => setName(e.target.value)} className={inputCls} required placeholder="例: 9/10 グループ定例" />
        </div>
        <div>
          <label className={labelCls}>付けるタグ（空なら「セミナー:名前」）</label>
          <input name="tag" value={tag} onChange={(e) => setTag(e.target.value)} className={inputCls} placeholder={name ? `セミナー:${name}` : "セミナー:○○"} />
        </div>
        <div>
          <label className={labelCls}>開始日時（JST・空なら常設＝広告など）</label>
          <input name="startsAt" type="datetime-local" defaultValue={initial?.startsAt ?? ""} className={inputCls} />
        </div>
        <div>
          <label className={labelCls}>終了日時（空なら開始+2時間）</label>
          <input name="endsAt" type="datetime-local" defaultValue={initial?.endsAt ?? ""} className={inputCls} />
        </div>
      </div>
      <label className="text-xs text-zinc-700 flex items-center gap-1.5">
        <input type="checkbox" name="askOnFollow" defaultChecked={initial?.askOnFollow ?? true} />
        友だち追加の1通目に「ご参加のセミナーをお選びください」のボタン候補として出す
      </label>
      <p className="text-[11px] text-zinc-400">
        開始30分前〜終了2時間後に友だち追加した人には自動でタグが付きます。ボタンは終了後3日間まで出ます。
      </p>
      {error && <p className="text-xs text-red-600">{error}</p>}
      <div className="flex justify-end">
        <button type="submit" disabled={isPending} className="flex items-center gap-1.5 px-4 py-2 bg-emerald-600 text-white text-xs font-bold rounded-lg hover:bg-emerald-700 disabled:opacity-50">
          {isPending && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
          保存
        </button>
      </div>
    </form>
  );
}

export function NewEntryPointToggle({ accountId }: { accountId: string }) {
  const [open, setOpen] = useState(false);
  if (open) return <EntryPointForm accountId={accountId} onClose={() => setOpen(false)} />;
  return (
    <button type="button" onClick={() => setOpen(true)} className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-600 text-white text-xs font-medium rounded-lg hover:bg-emerald-700">
      <Plus className="w-3.5 h-3.5" />枠を登録
    </button>
  );
}

export function EntryPointEditToggle({ accountId, initial }: { accountId: string; initial: EntryPointInput }) {
  const [open, setOpen] = useState(false);
  if (open) return <EntryPointForm accountId={accountId} initial={initial} onClose={() => setOpen(false)} />;
  return (
    <button type="button" onClick={() => setOpen(true)} className="px-2.5 py-1 text-xs font-medium rounded-lg border border-zinc-200 text-zinc-700 hover:bg-zinc-50">
      編集
    </button>
  );
}
