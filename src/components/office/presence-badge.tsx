"use client";
// ヘッダーの在席バッジ: いま動いている人の顔（先頭5人）＋人数 → /dashboard/live
//   新しいチャットがあればオレンジの点（自分の投稿は除く）
import Link from "next/link";
import { useOfficeState } from "@/lib/office/store";
import { Avatar } from "./avatar";

export function PresenceBadge() {
  const s = useOfficeState();
  if (!s.ready) return null;
  return (
    <Link
      href="/dashboard/live"
      title="いま OS を開いている代表。グループライブでチャット／ひとことが送れます"
      className="relative flex items-center gap-2 pl-1.5 pr-2.5 py-1 rounded-full border border-zinc-200 bg-white text-xs text-zinc-600 hover:bg-zinc-50 transition-colors"
    >
      <span className="flex -space-x-2">
        {s.faces.slice(0, 4).map((f) => (
          <Avatar key={f.id} src={f.avatar} initials={f.initials} size={24} className="border-2 border-white" />
        ))}
      </span>
      <span className="tabular-nums whitespace-nowrap">
        いま <b className="text-zinc-900">{s.online}</b>人
      </span>
      {s.unreadChat && (
        <span className="absolute -top-0.5 -right-0.5 w-2.5 h-2.5 rounded-full bg-orange-500 border-2 border-white" aria-label="新しいチャット" />
      )}
    </Link>
  );
}
