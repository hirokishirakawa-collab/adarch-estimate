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
  FileText,
  Briefcase,
  FolderKanban,
  Network,
  Receipt,
  BarChart2,
  CreditCard,
  Megaphone,
  Scale,
  GraduationCap,
  Bot,
  Shield,
  LogOut,
  Building2,
} from "lucide-react";

// ----------------------------------------------------------------
// ナビゲーション定義
// ----------------------------------------------------------------
interface NavItem {
  href: string;
  label: string;
  icon: React.ElementType;
  minRole: UserRole;
}

interface NavSection {
  section: string;
  items: NavItem[];
}

const NAV_SECTIONS: NavSection[] = [
  {
    section: "メイン",
    items: [
      { href: "/dashboard", label: "ダッシュボード", icon: LayoutDashboard, minRole: "USER" },
    ],
  },
  {
    section: "営業・顧客",
    items: [
      { href: "/customers", label: "顧客管理 (CRM)", icon: Users, minRole: "USER" },
      { href: "/deals", label: "商談管理 (SFA)", icon: TrendingUp, minRole: "USER" },
      { href: "/estimates", label: "公式見積もり", icon: FileText, minRole: "USER" },
      { href: "/sales-tools", label: "営業ツール", icon: Briefcase, minRole: "USER" },
    ],
  },
  {
    section: "プロジェクト",
    items: [
      { href: "/projects", label: "プロジェクト管理", icon: FolderKanban, minRole: "USER" },
      { href: "/group-sync", label: "グループ連携履歴", icon: Network, minRole: "USER" },
    ],
  },
  {
    section: "財務・承認",
    items: [
      { href: "/billing", label: "請求依頼", icon: Receipt, minRole: "USER" },
      // MANAGER以上（代表は自拠点のみ、Phase 2でbranchIdフィルタリング）
      { href: "/sales-report", label: "売上報告", icon: BarChart2, minRole: "MANAGER" },
    ],
  },
  {
    section: "ツール",
    items: [
      { href: "/business-cards", label: "名刺管理", icon: CreditCard, minRole: "USER" },
      { href: "/media", label: "媒体依頼", icon: Megaphone, minRole: "USER" },
      { href: "/legal", label: "契約法務依頼", icon: Scale, minRole: "USER" },
      { href: "/training", label: "研修", icon: GraduationCap, minRole: "USER" },
    ],
  },
  {
    section: "AI",
    items: [
      { href: "/gemini", label: "自社 GEMINI", icon: Bot, minRole: "USER" },
    ],
  },
  {
    section: "管理者",
    items: [
      { href: "/admin", label: "管理者パネル", icon: Shield, minRole: "ADMIN" },
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
}

// ----------------------------------------------------------------
// Sidebar コンポーネント
// ----------------------------------------------------------------
export function Sidebar({ user }: SidebarProps) {
  const pathname = usePathname();
  const roleStyle = ROLE_STYLES[user.role];
  const initial = user.name?.[0]?.toUpperCase() ?? "U";

  return (
    <aside className="w-60 h-screen bg-zinc-950 border-r border-zinc-800/80 flex flex-col flex-shrink-0">
      {/* ロゴ */}
      <div className="px-5 h-14 flex items-center border-b border-zinc-800/80">
        <div className="flex items-center gap-2.5">
          <div className="w-7 h-7 bg-blue-600 rounded-lg flex items-center justify-center flex-shrink-0">
            <Building2 className="w-3.5 h-3.5 text-white" />
          </div>
          <div className="leading-none">
            <p className="text-xs font-bold text-white">Ad-Arch</p>
            <p className="text-[10px] text-zinc-500 mt-0.5">Group OS</p>
          </div>
        </div>
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
              <p className="px-2 mb-1 text-[10px] font-semibold text-zinc-600 uppercase tracking-widest">
                {section.section}
              </p>
              <ul className="space-y-0.5">
                {visibleItems.map((item) => {
                  const isActive =
                    pathname === item.href ||
                    (item.href !== "/dashboard" &&
                      pathname.startsWith(item.href));
                  return (
                    <li key={item.href}>
                      <Link
                        href={item.href}
                        className={cn(
                          "flex items-center gap-2.5 px-2.5 py-1.5 rounded-md text-xs transition-all duration-100",
                          isActive
                            ? "bg-blue-600 text-white shadow-sm"
                            : "text-zinc-400 hover:text-white hover:bg-zinc-800"
                        )}
                      >
                        <item.icon className="w-3.5 h-3.5 flex-shrink-0" />
                        <span className="truncate">{item.label}</span>
                      </Link>
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
  );
}
