"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { signOut } from "next-auth/react";
import { cn } from "@/lib/utils";
import { hasMinRole } from "@/types/roles";
import type { UserRole } from "@/types/roles";
import {
  LayoutDashboard,
  Users,
  TrendingUp,
  FolderKanban,
  BookOpen,
  BarChart2,
  CreditCard,
  Megaphone,
  CalendarCheck,
  GraduationCap,
  Shield,
  LogOut,
  Building2,
  FileText,
  Network,
  X,
} from "lucide-react";

// ----------------------------------------------------------------
// ナビゲーション定義
// ----------------------------------------------------------------
interface NavItem {
  href: string;
  label: string;
  icon: React.ElementType;
  minRole: UserRole;
  badge?: string; // "準備中" などのラベル
  external?: boolean; // true のとき新しいタブで開く
}

interface NavSection {
  section: string;
  color: string; // セクションラベルの色
  items: NavItem[];
}

const NAV_SECTIONS: NavSection[] = [
  {
    section: "メイン",
    color: "text-zinc-600",
    items: [
      {
        href: "/dashboard",
        label: "ダッシュボード",
        icon: LayoutDashboard,
        minRole: "USER",
      },
    ],
  },
  {
    section: "CRM",
    color: "text-blue-500/80",
    items: [
      {
        href: "/dashboard/customers",
        label: "顧客管理",
        icon: Users,
        minRole: "USER",
      },
      {
        href: "/dashboard/deals",
        label: "商談管理 (SFA)",
        icon: TrendingUp,
        minRole: "USER",
      },
      {
        href: "/dashboard/estimates",
        label: "公式見積もり",
        icon: FileText,
        minRole: "USER",
      },
    ],
  },
  {
    section: "プロジェクト",
    color: "text-violet-500/80",
    items: [
      {
        href: "/dashboard/projects",
        label: "プロジェクト一覧",
        icon: FolderKanban,
        minRole: "USER",
      },
      {
        href: "/dashboard/group-sync",
        label: "グループ連携依頼",
        icon: Network,
        minRole: "USER",
      },
    ],
  },
  {
    section: "経費管理",
    color: "text-amber-500/80",
    items: [
      {
        href: "/dashboard/billing",
        label: "請求依頼",
        icon: CreditCard,
        minRole: "USER",
      },
      {
        href: "/dashboard/sales-report",
        label: "売上報告",
        icon: BarChart2,
        minRole: "MANAGER",
      },
    ],
  },
  {
    section: "Wiki",
    color: "text-teal-500/80",
    items: [
      {
        href: "/dashboard/wiki",
        label: "社内Wiki",
        icon: BookOpen,
        minRole: "USER",
      },
    ],
  },
  {
    section: "ツール",
    color: "text-zinc-600",
    items: [
      {
        href: "/dashboard/media",
        label: "媒体依頼",
        icon: Megaphone,
        minRole: "USER",
      },
      {
        href: "https://calendar.app.google/ZP3woztffUUoHivm6",
        label: "本部打ち合わせ予約",
        icon: CalendarCheck,
        minRole: "USER",
        external: true,
      },
      {
        href: "https://lms.learningbox.online/index.php?action=login",
        label: "研修",
        icon: GraduationCap,
        minRole: "USER",
        external: true,
      },
    ],
  },
  {
    section: "管理者",
    color: "text-zinc-600",
    items: [
      {
        href: "/dashboard/admin/users",
        label: "メンバー管理",
        icon: Shield,
        minRole: "ADMIN",
      },
    ],
  },
];

// ----------------------------------------------------------------
// ロールバッジのスタイル
// ----------------------------------------------------------------
const ROLE_STYLES: Record<UserRole, { label: string; className: string }> = {
  ADMIN: {
    label: "ADMIN",
    className: "bg-amber-500/15 text-amber-400 border border-amber-500/30",
  },
  MANAGER: {
    label: "MANAGER",
    className: "bg-blue-500/15 text-blue-400 border border-blue-500/30",
  },
  USER: {
    label: "USER",
    className: "bg-zinc-700/60 text-zinc-400 border border-zinc-600/40",
  },
};

// ----------------------------------------------------------------
// Props
// ----------------------------------------------------------------
interface SidebarProps {
  user: {
    name?: string | null;
    email?: string | null;
    image?: string | null;
    role: UserRole;
  };
  isOpen: boolean;
  onClose: () => void;
}

// ----------------------------------------------------------------
// Sidebar コンポーネント
// ----------------------------------------------------------------
export function Sidebar({ user, isOpen, onClose }: SidebarProps) {
  const pathname = usePathname();
  const roleStyle = ROLE_STYLES[user.role];
  const initial = user.name?.[0]?.toUpperCase() ?? "U";

  return (
    <>
      {/* モバイル用オーバーレイ */}
      {isOpen && (
        <div
          className="fixed inset-0 z-30 bg-black/50 md:hidden"
          onClick={onClose}
        />
      )}

      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-40 w-64 bg-zinc-950 border-r border-zinc-800/80 flex flex-col flex-shrink-0",
          "transform transition-transform duration-300 ease-in-out",
          "md:relative md:translate-x-0 md:w-60",
          isOpen ? "translate-x-0" : "-translate-x-full"
        )}
      >
      {/* ロゴ */}
      <div className="px-5 h-14 flex items-center justify-between border-b border-zinc-800/80">
        <div className="flex items-center gap-2.5">
          <div className="w-7 h-7 bg-blue-600 rounded-lg flex items-center justify-center flex-shrink-0">
            <Building2 className="w-3.5 h-3.5 text-white" />
          </div>
          <div className="leading-none">
            <p className="text-xs font-bold text-white">Ad-Arch</p>
            <p className="text-[10px] text-zinc-500 mt-0.5">Group OS</p>
          </div>
        </div>
        {/* モバイル用閉じるボタン */}
        <button
          onClick={onClose}
          className="md:hidden p-1 rounded-md text-zinc-400 hover:text-white hover:bg-zinc-800 transition-colors"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* ユーザー情報 */}
      <div className="px-4 py-3.5 border-b border-zinc-800/80">
        <div className="flex items-center gap-2.5">
          {user.image ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={user.image}
              alt=""
              className="w-8 h-8 rounded-full ring-1 ring-zinc-700"
            />
          ) : (
            <div className="w-8 h-8 rounded-full bg-blue-600 flex items-center justify-center text-white text-xs font-bold flex-shrink-0">
              {initial}
            </div>
          )}
          <div className="min-w-0 flex-1">
            <p className="text-xs font-semibold text-white truncate">
              {user.name ?? "ユーザー"}
            </p>
            <p className="text-[11px] text-zinc-500 truncate">{user.email}</p>
          </div>
        </div>
        <div className="mt-2.5">
          <span
            className={cn(
              "inline-flex items-center px-2 py-0.5 rounded text-[10px] font-semibold tracking-wide",
              roleStyle.className
            )}
          >
            {roleStyle.label}
          </span>
        </div>
      </div>

      {/* ナビゲーション */}
      <nav className="flex-1 overflow-y-auto px-3 py-3 space-y-4 scrollbar-thin">
        {NAV_SECTIONS.map((section) => {
          const visibleItems = section.items.filter((item) =>
            hasMinRole(user.role, item.minRole)
          );
          if (visibleItems.length === 0) return null;

          return (
            <div key={section.section}>
              <p
                className={cn(
                  "px-2 mb-1 text-[10px] font-semibold uppercase tracking-widest",
                  section.color
                )}
              >
                {section.section}
              </p>
              <ul className="space-y-0.5">
                {visibleItems.map((item) => {
                  const isActive =
                    item.href === "/dashboard"
                      ? pathname === "/dashboard"
                      : pathname === item.href ||
                        pathname.startsWith(item.href + "/");

                  const linkClass = cn(
                    "flex items-center gap-2.5 px-2.5 py-1.5 rounded-md text-xs transition-all duration-100",
                    isActive
                      ? "bg-blue-600 text-white shadow-sm"
                      : "text-zinc-400 hover:text-white hover:bg-zinc-800"
                  );
                  const linkContent = (
                    <>
                      <item.icon className="w-3.5 h-3.5 flex-shrink-0" />
                      <span className="truncate flex-1">{item.label}</span>
                      {item.badge && !isActive && (
                        <span className="text-[9px] px-1 py-0.5 rounded bg-zinc-800 text-zinc-500 border border-zinc-700 flex-shrink-0">
                          {item.badge}
                        </span>
                      )}
                    </>
                  );

                  return (
                    <li key={item.href}>
                      {item.external ? (
                        <a
                          href={item.href}
                          target="_blank"
                          rel="noopener noreferrer"
                          className={linkClass}
                        >
                          {linkContent}
                        </a>
                      ) : (
                        <Link href={item.href} className={linkClass}>
                          {linkContent}
                        </Link>
                      )}
                    </li>
                  );
                })}
              </ul>
            </div>
          );
        })}
      </nav>

      {/* ログアウト */}
      <div className="px-3 py-3 border-t border-zinc-800/80">
        <button
          onClick={() => signOut({ callbackUrl: "/login" })}
          className="flex items-center gap-2.5 w-full px-2.5 py-1.5 rounded-md text-xs text-zinc-500 hover:text-white hover:bg-zinc-800 transition-all duration-100"
        >
          <LogOut className="w-3.5 h-3.5" />
          <span>ログアウト</span>
        </button>
      </div>
    </aside>
    </>
  );
}
