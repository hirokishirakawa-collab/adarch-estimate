import Link from "next/link";
import { cn } from "@/lib/utils";
import type { UserRole } from "@/types/roles";
import { Menu, Search, Settings } from "lucide-react";
import { NotificationBell } from "./notification-bell";

// ----------------------------------------------------------------
// ロールごとの上部バナー（ADMIN のみ表示）
// ----------------------------------------------------------------
const ROLE_BANNERS: Partial<
  Record<UserRole, { label: string; bgClass: string; textClass: string }>
> = {
  ADMIN: {
    label: "管理者モード — 全データ・財務情報へのアクセスが有効です",
    bgClass: "bg-gradient-to-r from-indigo-500/[0.06] via-cyan-500/[0.04] to-indigo-500/[0.06] border-b border-indigo-500/[0.06]",
    textClass: "text-indigo-500/80",
  },
};

interface HeaderProps {
  pageTitle: string;
  user: {
    name?: string | null;
    role: UserRole;
  };
  onMenuOpen: () => void;
  onSearchOpen: () => void;
}

export function Header({ pageTitle, user, onMenuOpen, onSearchOpen }: HeaderProps) {
  const banner = ROLE_BANNERS[user.role];
  const now = new Date();
  const dateStr = now.toLocaleDateString("ja-JP", {
    year: "numeric",
    month: "long",
    day: "numeric",
    weekday: "short",
  });

  return (
    <header className="flex-shrink-0 relative z-10">
      {/* ADMIN バナー */}
      {banner && (
        <div className={cn("px-6 py-1.5 flex items-center gap-2", banner.bgClass)}>
          <span className="w-1.5 h-1.5 rounded-full bg-indigo-500 animate-pulse" />
          <p className={cn("text-[11px] font-medium", banner.textClass)}>
            {banner.label}
          </p>
        </div>
      )}

      {/* メインヘッダー */}
      <div className="h-14 px-4 sm:px-6 bg-white/80 backdrop-blur-xl border-b border-black/[0.06] flex items-center justify-between">
        <div className="flex items-center">
          {/* モバイル用ハンバーガーボタン */}
          <button
            className="md:hidden mr-3 p-1.5 rounded-md text-zinc-500 hover:text-zinc-900 hover:bg-zinc-100 transition-colors"
            onClick={onMenuOpen}
          >
            <Menu className="w-5 h-5" />
          </button>
          <h1 className="text-base font-semibold text-zinc-900">{pageTitle}</h1>
        </div>

        <div className="flex items-center gap-3">
          {/* 横断検索 */}
          <button
            onClick={onSearchOpen}
            className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-zinc-100 text-zinc-500 text-xs hover:bg-zinc-200 hover:text-zinc-700 transition-colors"
          >
            <Search className="w-3.5 h-3.5" />
            <span className="hidden sm:block">検索...</span>
            <kbd className="hidden sm:block text-[10px] bg-zinc-200 px-1.5 py-0.5 rounded">⌘K</kbd>
          </button>

          {/* 通知ベル */}
          <NotificationBell />

          {/* 設定 */}
          <Link
            href="/dashboard/settings"
            className="flex items-center gap-1 px-2 py-1.5 rounded-lg text-zinc-400 hover:text-zinc-700 hover:bg-zinc-100 transition-colors text-xs"
            title="通知設定"
          >
            <Settings className="w-4 h-4" />
            <span className="hidden sm:block">通知設定</span>
          </Link>

          {/* 日付 */}
          <p className="hidden md:block text-xs text-zinc-400">{dateStr}</p>
        </div>
      </div>
    </header>
  );
}
