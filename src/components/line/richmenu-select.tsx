"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { setLineFriendRichMenu } from "@/lib/actions/line";

export function RichMenuSelect({ accountId, friendId, current, menus }: { accountId: string; friendId: string; current: string | null; menus: { id: string; name: string }[] }) {
  const router = useRouter();
  const [msg, setMsg] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  if (menus.length === 0) return null;
  return (
    <div className="space-y-1">
      <p className="text-[11px] font-bold text-zinc-500">リッチメニュー</p>
      <select
        value={current ?? ""}
        disabled={isPending}
        onChange={(e) =>
          startTransition(async () => {
            const r = await setLineFriendRichMenu(accountId, friendId, e.target.value || null);
            setMsg(r.error ?? (typeof r.message === "string" ? r.message : "完了"));
            if (!r.error) router.refresh();
          })
        }
        className="w-full px-2 py-1.5 text-xs border border-zinc-200 rounded-lg bg-white"
      >
        <option value="">既定（全員向け）</option>
        {menus.map((m) => (
          <option key={m.id} value={m.id}>{m.name}</option>
        ))}
      </select>
      {msg && <p className="text-[11px] text-zinc-500">{msg}</p>}
    </div>
  );
}
