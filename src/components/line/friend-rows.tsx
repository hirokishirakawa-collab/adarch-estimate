"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Loader2, LayoutGrid } from "lucide-react";
import { cn } from "@/lib/utils";
import { TagChip } from "@/components/line/tag-manager";
import { StarRating } from "@/components/line/star-rating";
import { bulkSetLineFriendRichMenu } from "@/lib/actions/line";

export type FriendRow = {
  id: string;
  displayName: string | null;
  pictureUrl: string | null;
  tags: string[];
  note: string | null;
  isFollowing: boolean;
  unfollowedAgo: string;
  unreadCount: number;
  activeEnrollments: number;
  mutedAt: boolean;
  rating: number;
  richMenuName: string | null;
  richMenuPinned: boolean;
  inboundAgo: string;
  followedAgo: string;
};

export function FriendRows({
  accountId,
  friends,
  colors,
  menus,
}: {
  accountId: string;
  friends: FriendRow[];
  colors: Record<string, string>;
  menus: { id: string; name: string }[];
}) {
  const router = useRouter();
  const [sel, setSel] = useState<Set<string>>(new Set());
  const [menuId, setMenuId] = useState("");
  const [msg, setMsg] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const allSelected = friends.length > 0 && sel.size === friends.length;

  function toggle(id: string) {
    setSel((p) => {
      const n = new Set(p);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });
  }
  function apply(target: string | null) {
    const ids = [...sel];
    if (ids.length === 0) return;
    startTransition(async () => {
      const r = await bulkSetLineFriendRichMenu(accountId, ids, target);
      setMsg(r.error ?? (typeof r.message === "string" ? r.message : "完了"));
      if (!r.error) {
        setSel(new Set());
        router.refresh();
      }
    });
  }

  return (
    <div className="space-y-2">
      {menus.length > 0 && (
        <div className={cn("flex items-center gap-2 flex-wrap rounded-lg border px-3 py-2 text-xs", sel.size > 0 ? "bg-emerald-50 border-emerald-200" : "bg-white border-zinc-200")}>
          <label className="flex items-center gap-1.5 text-zinc-700">
            <input type="checkbox" checked={allSelected} onChange={() => setSel(allSelected ? new Set() : new Set(friends.map((f) => f.id)))} />
            {sel.size > 0 ? `${sel.size}人を選択中` : "全て選択"}
          </label>
          <span className="text-zinc-300">|</span>
          <LayoutGrid className="w-3.5 h-3.5 text-zinc-500" />
          <span className="text-zinc-600">選んだ人のリッチメニューを</span>
          <select value={menuId} onChange={(e) => setMenuId(e.target.value)} className="px-2 py-1 text-xs border border-zinc-200 rounded-lg bg-white">
            <option value="">メニューを選ぶ…</option>
            {menus.map((m) => (
              <option key={m.id} value={m.id}>{m.name}</option>
            ))}
          </select>
          <button type="button" disabled={isPending || sel.size === 0 || !menuId} onClick={() => apply(menuId)} className="px-3 py-1 text-xs font-bold rounded-lg bg-emerald-600 text-white disabled:opacity-50">
            {isPending ? <Loader2 className="w-3 h-3 animate-spin" /> : "適用"}
          </button>
          <button type="button" disabled={isPending || sel.size === 0} onClick={() => apply(null)} className="px-3 py-1 text-xs rounded-lg border border-zinc-200 bg-white disabled:opacity-50">
            既定に戻す
          </button>
          {msg && <span className="text-zinc-600">{msg}</span>}
        </div>
      )}

      <div className="bg-white rounded-xl border border-zinc-200 divide-y divide-zinc-100">
        {friends.map((f) => (
          <div key={f.id} className={cn("flex items-center gap-3 px-3 py-2.5 hover:bg-zinc-50 transition-colors", sel.has(f.id) && "bg-emerald-50/60")}>
            {menus.length > 0 && <input type="checkbox" checked={sel.has(f.id)} onChange={() => toggle(f.id)} className="shrink-0" />}
            <Link href={`/dashboard/line/${accountId}/chat/${f.id}`} className="flex items-center gap-3 min-w-0 flex-1">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={`/api/line/avatar/${f.id}`} alt="" className="w-9 h-9 rounded-full object-cover bg-zinc-100" loading="lazy" />
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <p className={cn("text-sm truncate", f.unreadCount > 0 ? "font-bold text-zinc-900" : "text-zinc-800")}>{f.displayName ?? "（名前未取得）"}</p>
                  {!f.isFollowing && (
                    <span className="text-[10px] font-bold text-red-700 bg-red-50 border border-red-200 rounded px-1">ブロック/解除 {f.unfollowedAgo}</span>
                  )}
                  {f.mutedAt && <span className="text-[10px] text-zinc-600 bg-zinc-100 rounded px-1">ミュート</span>}
                  {f.unreadCount > 0 && <span className="text-[10px] font-bold bg-red-500 text-white rounded-full px-1.5">{f.unreadCount}</span>}
                  {f.activeEnrollments > 0 && <span className="text-[10px] text-emerald-700 bg-emerald-50 rounded px-1">配信中</span>}
                  {f.richMenuName && (
                    <span className="text-[10px] text-indigo-700 bg-indigo-50 rounded px-1" title={f.richMenuPinned ? "手動で指定" : "タグで自動"}>
                      <LayoutGrid className="inline w-3 h-3 mr-0.5" />{f.richMenuName}{f.richMenuPinned ? "（手動）" : ""}
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-1 mt-0.5 flex-wrap">
                  {f.tags.map((t) => (
                    <TagChip key={t} name={t} color={colors[t]} />
                  ))}
                  {f.note && <span className="text-[11px] text-zinc-400 truncate">{f.note}</span>}
                </div>
              </div>
            </Link>
            <div className="text-right text-[11px] text-zinc-400 shrink-0 flex flex-col items-end gap-0.5">
              <StarRating accountId={accountId} friendId={f.id} value={f.rating} />
              <p>受信 {f.inboundAgo}</p>
              <p>追加 {f.followedAgo}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
