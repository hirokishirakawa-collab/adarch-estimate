"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Loader2, BellOff, Bell, Link2, X } from "lucide-react";
import { toggleLineFriendMute, searchCustomersForLine, linkLineFriendCustomer } from "@/lib/actions/line";

const btn = "px-2.5 py-1 text-xs font-medium rounded-lg border transition-colors disabled:opacity-50";

export function MuteButton({ accountId, friendId, muted }: { accountId: string; friendId: string; muted: boolean }) {
  const router = useRouter();
  const [msg, setMsg] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  return (
    <div className="flex items-center gap-2 flex-wrap">
      <button
        type="button"
        disabled={isPending}
        onClick={() =>
          startTransition(async () => {
            const r = await toggleLineFriendMute(accountId, friendId, !muted);
            setMsg(r.error ?? (typeof r.message === "string" ? r.message : "完了"));
            if (!r.error) router.refresh();
          })
        }
        className={`${btn} ${muted ? "border-emerald-200 text-emerald-700 hover:bg-emerald-50" : "border-zinc-200 text-zinc-700 hover:bg-zinc-50"} inline-flex items-center gap-1`}
      >
        {isPending ? <Loader2 className="w-3 h-3 animate-spin" /> : muted ? <Bell className="w-3 h-3" /> : <BellOff className="w-3 h-3" />}
        {muted ? "ミュート解除" : "ミュート"}
      </button>
      <span className="text-[11px] text-zinc-500">{msg ?? (muted ? "配信・新着通知を止めています" : "ミュート＝ステップ配信・一斉配信・新着通知を止める")}</span>
    </div>
  );
}

export function CustomerLink({
  accountId,
  friendId,
  customer,
}: {
  accountId: string;
  friendId: string;
  customer: { id: string; name: string } | null;
}) {
  const router = useRouter();
  const [q, setQ] = useState("");
  const [hits, setHits] = useState<{ id: string; name: string; branch: string }[]>([]);
  const [msg, setMsg] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function search(v: string) {
    setQ(v);
    if (v.trim().length < 1) {
      setHits([]);
      return;
    }
    startTransition(async () => setHits(await searchCustomersForLine(accountId, v)));
  }
  function link(id: string | null) {
    startTransition(async () => {
      const r = await linkLineFriendCustomer(accountId, friendId, id);
      setMsg(r.error ?? (typeof r.message === "string" ? r.message : "完了"));
      if (!r.error) {
        setHits([]);
        setQ("");
        router.refresh();
      }
    });
  }

  return (
    <div className="space-y-1.5">
      <p className="text-[11px] font-bold text-zinc-500 flex items-center gap-1"><Link2 className="w-3 h-3" />OSの顧客と紐付け</p>
      {customer ? (
        <div className="flex items-center gap-2">
          <Link href={`/dashboard/customers/${customer.id}`} className="text-xs text-emerald-700 underline truncate">{customer.name}</Link>
          <button type="button" onClick={() => link(null)} className="text-zinc-400 hover:text-red-600" title="紐付けを外す"><X className="w-3.5 h-3.5" /></button>
        </div>
      ) : (
        <div className="relative">
          <input
            value={q}
            onChange={(e) => search(e.target.value)}
            placeholder="顧客名で検索…"
            className="w-full px-2.5 py-1.5 text-xs border border-zinc-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-emerald-300"
          />
          {hits.length > 0 && (
            <div className="absolute z-10 left-0 right-0 mt-1 bg-white border border-zinc-200 rounded-lg shadow-sm max-h-48 overflow-y-auto">
              {hits.map((h) => (
                <button key={h.id} type="button" onClick={() => link(h.id)} className="block w-full text-left px-2.5 py-1.5 text-xs hover:bg-zinc-50">
                  {h.name} <span className="text-zinc-400">・{h.branch}</span>
                </button>
              ))}
            </div>
          )}
        </div>
      )}
      {msg && <p className="text-[11px] text-zinc-500">{msg}</p>}
    </div>
  );
}
