"use client";
// ヘッダーの在席バッジ「いま N人が動いています」→ /dashboard/live へ
import Link from "next/link";
import { useOfficeState } from "@/lib/office/store";

export function PresenceBadge() {
  const s = useOfficeState();
  if (!s.ready) return null;
  return (
    <Link
      href="/dashboard/live"
      title="いま OS を開いている代表（グループライブで声をかけられます）"
      className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs text-zinc-600 hover:bg-zinc-100 transition-colors"
    >
      <span className="relative flex h-2 w-2">
        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-60" />
        <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500" />
      </span>
      <span className="tabular-nums">
        いま <b className="text-zinc-900">{s.online}</b>人
      </span>
    </Link>
  );
}
