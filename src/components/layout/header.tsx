import { cn } from "@/lib/utils";
import type { UserRole } from "@/types/roles";
import { Bell, Menu, Search } from "lucide-react";

// ----------------------------------------------------------------
// ロールごとの上部バナー（ADMIN のみ表示）
// ----------------------------------------------------------------
const ROLE_BANNERS: Partial<
  Record<UserRole, { label: string; bgClass: string; textClass: string }>
> = {
  ADMIN: {
    label: "管理者モード — 全データ・財務情報へのアクセスが有効です",
    bgClass: "bg-amber-950/60 border-b border-amber-800/50",
    textClass: "text-amber-400",
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
    <header className="flex-shrink-0">
      {/* ADMIN バナー */}
      {banner && (
        <div className={cn("px-6 py-1.5 flex items-center gap-2", banner.bgClass)}>
          <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse" />
          <p className={cn("text-[11px] font-medium", banner.textClass)}>
            {banner.label}
          </p>
        </div>
      )}

      {/* メインヘッダー */}
      <div className="h-14 px-4 sm:px-6 bg-white border-b border-zinc-200 flex items-center justify-between">
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

          {/* 通知ベル（将来実装） */}
          <button className="relative w-8 h-8 flex items-center justify-center rounded-lg hover:bg-zinc-100 text-zinc-500 transition-colors">
            <Bell className="w-4 h-4" />
            <span className="absolute top-1.5 right-1.5 w-1.5 h-1.5 bg-blue-500 rounded-full" />
          </button>

          {/* 日付 */}
          <p className="hidden md:block text-xs text-zinc-400">{dateStr}</p>
        </div>
      </div>
    </header>
  );
}
