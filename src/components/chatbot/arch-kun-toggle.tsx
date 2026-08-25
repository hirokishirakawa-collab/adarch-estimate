"use client";

import { cn } from "@/lib/utils";
import { useArchKunHidden } from "./arch-kun-visibility";

// ヘッダー用: アーチくん（チャットボット）の表示/非表示ボタン
// 消したあとはここから戻す（2026-08-26 代表指示）
function ArchKunIcon({ className }: { className?: string }) {
  return (
    <svg width="18" height="18" viewBox="0 0 80 80" fill="none" className={className}>
      <circle cx="40" cy="40" r="36" fill="currentColor" />
      <ellipse cx="30" cy="36" rx="4" ry="5" fill="#fff" />
      <ellipse cx="50" cy="36" rx="4" ry="5" fill="#fff" />
      <path d="M32 48 Q40 56 48 48" stroke="#fff" strokeWidth="3" strokeLinecap="round" fill="none" />
    </svg>
  );
}

export function ArchKunToggle() {
  const [hidden, setHidden] = useArchKunHidden();
  return (
    <button
      type="button"
      onClick={() => setHidden(!hidden)}
      title={hidden ? "アーチくんを表示" : "アーチくんを非表示"}
      aria-pressed={!hidden}
      className={cn(
        "flex items-center gap-1 px-2 py-1.5 rounded-lg transition-colors text-xs",
        hidden
          ? "text-zinc-300 hover:text-zinc-500 hover:bg-zinc-100"
          : "text-blue-500 hover:text-blue-700 hover:bg-blue-50"
      )}
    >
      <ArchKunIcon className={cn(hidden && "opacity-60")} />
      <span className="hidden sm:block">{hidden ? "アーチくん OFF" : "アーチくん"}</span>
    </button>
  );
}
