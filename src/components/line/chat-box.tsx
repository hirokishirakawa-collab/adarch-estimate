"use client";

import { useState, useTransition, useRef } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Send } from "lucide-react";
import { sendLineChat, updateLineFriend, startScenarioForFriend } from "@/lib/actions/line";

const inputCls =
  "w-full px-3 py-2 text-sm border border-zinc-200 rounded-lg bg-white text-zinc-900 " +
  "focus:outline-none focus:ring-2 focus:ring-emerald-300 focus:border-emerald-400";

export function ChatSendBox({ accountId, friendId, disabled }: { accountId: string; friendId: string; disabled: boolean }) {
  const router = useRouter();
  const ref = useRef<HTMLFormElement>(null);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function submit(fd: FormData) {
    startTransition(async () => {
      const res = await sendLineChat(null, fd);
      if (res.error) {
        setError(res.error);
        return;
      }
      setError(null);
      ref.current?.reset();
      router.refresh();
    });
  }

  return (
    <form ref={ref} action={submit} className="space-y-2">
      <input type="hidden" name="accountId" value={accountId} />
      <input type="hidden" name="friendId" value={friendId} />
      <textarea
        name="text"
        rows={3}
        disabled={disabled}
        placeholder={disabled ? "ブロック中・解除済のため送れません" : "メッセージを入力（Ctrl+Enterで送信）"}
        className={inputCls}
        onKeyDown={(e) => {
          if ((e.ctrlKey || e.metaKey) && e.key === "Enter") ref.current?.requestSubmit();
        }}
      />
      <div className="flex items-center justify-between">
        <span className="text-xs text-red-600">{error}</span>
        <button
          type="submit"
          disabled={isPending || disabled}
          className="flex items-center gap-1.5 px-4 py-1.5 bg-emerald-600 text-white text-xs font-bold rounded-lg hover:bg-emerald-700 disabled:opacity-50"
        >
          {isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />}
          送信
        </button>
      </div>
    </form>
  );
}

export function FriendMetaForm({
  accountId,
  friendId,
  tags,
  note,
}: {
  accountId: string;
  friendId: string;
  tags: string[];
  note: string | null;
}) {
  const router = useRouter();
  const [msg, setMsg] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function submit(fd: FormData) {
    startTransition(async () => {
      const res = await updateLineFriend(null, fd);
      setMsg(res.error ?? "保存しました");
      if (!res.error) router.refresh();
    });
  }

  return (
    <form action={submit} className="space-y-2">
      <input type="hidden" name="accountId" value={accountId} />
      <input type="hidden" name="friendId" value={friendId} />
      <div>
        <label className="block text-[11px] font-bold text-zinc-500 mb-1">タグ（カンマ区切り）</label>
        <input name="tags" defaultValue={tags.join(", ")} className={inputCls} placeholder="例: 加盟見込み, 面談済" />
      </div>
      <div>
        <label className="block text-[11px] font-bold text-zinc-500 mb-1">メモ</label>
        <textarea name="note" rows={4} defaultValue={note ?? ""} className={inputCls} />
      </div>
      <div className="flex items-center justify-between">
        <span className="text-[11px] text-zinc-500">{msg}</span>
        <button type="submit" disabled={isPending} className="px-3 py-1.5 text-xs font-bold rounded-lg bg-zinc-800 text-white disabled:opacity-50">
          保存
        </button>
      </div>
    </form>
  );
}

export function StartScenarioSelect({
  accountId,
  friendId,
  scenarios,
}: {
  accountId: string;
  friendId: string;
  scenarios: { id: string; name: string }[];
}) {
  const router = useRouter();
  const [sel, setSel] = useState("");
  const [msg, setMsg] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  if (scenarios.length === 0) return null;

  return (
    <div className="flex items-center gap-2">
      <select value={sel} onChange={(e) => setSel(e.target.value)} className="px-2 py-1.5 text-xs border border-zinc-200 rounded-lg bg-white flex-1">
        <option value="">シナリオを手動で開始…</option>
        {scenarios.map((s) => (
          <option key={s.id} value={s.id}>{s.name}</option>
        ))}
      </select>
      <button
        type="button"
        disabled={!sel || isPending}
        onClick={() =>
          startTransition(async () => {
            const r = await startScenarioForFriend(accountId, friendId, sel);
            setMsg(r.error ?? "開始しました");
            if (!r.error) router.refresh();
          })
        }
        className="px-3 py-1.5 text-xs font-medium rounded-lg border border-zinc-200 disabled:opacity-50"
      >
        開始
      </button>
      {msg && <span className="text-[11px] text-zinc-500">{msg}</span>}
    </div>
  );
}
