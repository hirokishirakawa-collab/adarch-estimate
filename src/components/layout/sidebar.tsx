"use client";

import { useState } from "react";
import Link from "next/link";
import Image from "next/image";
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
  ClipboardList,
  LogOut,
  Building2,
  FileText,
  Network,
  Users2,
  Tv2,
  UtensilsCrossed,
  Clapperboard,
  HardDrive,
  Car,
  Flag,
  X,
  Sparkles,
  Target,
  ContactRound,
  HeartHandshake,
  Crosshair,
  Handshake,
  ListChecks,
  Activity,
  Film,
  Eye,
  ChevronDown,
  ChevronRight,
  MessageCircle,
  Palette,
  Wand2,
  ImagePlus,
  Captions,
  Lightbulb,
  Play,
  Send,
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
  requiredFeature?: string; // ADMINが許可した機能のみ表示
  children?: NavItem[]; // 折りたたみサブメニュー
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
    section: "営業",
    color: "text-blue-500/80",
    items: [
      {
        href: "/dashboard/customers",
        label: "顧客管理",
        icon: Users,
        minRole: "USER",
      },
      {
        href: "/dashboard/leads/list",
        label: "リード管理",
        icon: ListChecks,
        minRole: "USER",
      },
      {
        href: "/dashboard/deals",
        label: "商談管理（SFA）",
        icon: TrendingUp,
        minRole: "USER",
      },
      {
        href: "/dashboard/estimates",
        label: "公式見積もり",
        icon: FileText,
        minRole: "USER",
      },
      {
        href: "/dashboard/leads",
        label: "リード獲得AI",
        icon: Crosshair,
        minRole: "USER",
        children: [
          { href: "/dashboard/leads", label: "BtoC リード", icon: Crosshair, minRole: "USER" },
          { href: "/dashboard/leads/btob", label: "BtoB リード", icon: Building2, minRole: "USER" },
          { href: "/dashboard/leads/cinema", label: "シネアド リード", icon: Clapperboard, minRole: "USER" },
        ],
      },
      {
        href: "/dashboard/video-achievements",
        label: "競合実績スクレイピング（自動収集）",
        icon: Target,
        minRole: "USER",
      },
      {
        href: "/dashboard/proposals",
        label: "提案書AI",
        icon: Sparkles,
        minRole: "USER",
      },
      {
        href: "/dashboard/proposals/analytics",
        label: "提案書 閲覧分析",
        icon: Eye,
        minRole: "USER",
      },
    ],
  },
  {
    section: "広告媒体シミュレーター",
    color: "text-indigo-500/80",
    items: [
      {
        href: "/dashboard/strategy-advisor",
        label: "提案戦略アドバイザー（AI）",
        icon: Sparkles,
        minRole: "USER",
      },
      {
        href: "/dashboard/tver-simulator",
        label: "TVer広告シミュレーター",
        icon: Tv2,
        minRole: "USER",
      },
      {
        href: "/dashboard/taxi-ads-simulator",
        label: "タクシー広告（TOKYO PRIME）",
        icon: Car,
        minRole: "USER",
      },
      {
        href: "/dashboard/skylark-simulator",
        label: "すかいらーくインストア",
        icon: UtensilsCrossed,
        minRole: "USER",
      },
      {
        href: "/dashboard/univ-coop-simulator",
        label: "大学生協広告",
        icon: GraduationCap,
        minRole: "USER",
      },
      {
        href: "/dashboard/aeon-cinema-simulator",
        label: "イオンシネマ",
        icon: Clapperboard,
        minRole: "USER",
      },
      {
        href: "/dashboard/golfcart-simulator",
        label: "ゴルフカート（Golfcart Vision）",
        icon: Flag,
        minRole: "USER",
      },
      {
        href: "/dashboard/omochannel-simulator",
        label: "おもチャンネル（アパホテル）",
        icon: Tv2,
        minRole: "USER",
      },
    ],
  },
    {
    section: "制作・プロジェクト",
    color: "text-violet-500/80",
    items: [
      {
        href: "/dashboard/projects",
        label: "プロジェクト一覧",
        icon: FolderKanban,
        minRole: "USER",
      },
      {
        href: "/dashboard/cutsheet",
        label: "動画カット表AI",
        icon: Film,
        minRole: "USER",
        requiredFeature: "cutsheet",
      },
      {
        href: "/dashboard/group-profiles",
        label: "メンバー紹介",
        icon: Users2,
        minRole: "USER",
      },
    ],
  },
  {
    section: "グループ共有",
    color: "text-teal-500/80",
    items: [
      {
        href: "/dashboard/sales-insights",
        label: "営業分析レポート",
        icon: Activity,
        minRole: "USER",
      },
      {
        href: "/dashboard/sales-approaches",
        label: "アプローチ事例集",
        icon: Send,
        minRole: "USER",
      },
      {
        href: "/dashboard/project-matching",
        label: "案件マッチング",
        icon: Handshake,
        minRole: "USER",
      },
    ],
  },
  {
    section: "経理",
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
        label: "月次報告",
        icon: BarChart2,
        minRole: "MANAGER",
      },
    ],
  },
  {
    section: "データベース",
    color: "text-teal-500/80",
    items: [
      {
        href: "/dashboard/business-cards",
        label: "名刺管理",
        icon: ContactRound,
        minRole: "USER",
      },
      {
        href: "/dashboard/wiki",
        label: "社内Wiki",
        icon: BookOpen,
        minRole: "USER",
      },
      {
        href: "/dashboard/portfolio",
        label: "実績フォルダ検索",
        icon: HardDrive,
        minRole: "USER",
      },
      {
        href: "https://drive.google.com/drive/folders/11CJPv-D_37Vn1zntRzI9Qqc2SV89fKPT?usp=drive_link",
        label: "実績フォルダ（Drive）",
        icon: HardDrive,
        minRole: "USER",
        external: true,
      },
      {
        href: "https://drive.google.com/drive/folders/1p9QtqSbPrBAkof5-10jeusyG6T2y7cB8?usp=drive_link",
        label: "グループ運用データ（Drive）",
        icon: HardDrive,
        minRole: "USER",
        external: true,
      },
    ],
  },
  {
    section: "広告申請",
    color: "text-blue-500/80",
    items: [
      {
        href: "/dashboard/tver-review",
        label: "TVer業態考査申請",
        icon: Tv2,
        minRole: "USER",
      },
      {
        href: "/dashboard/tver-campaign",
        label: "TVer配信申請",
        icon: Tv2,
        minRole: "USER",
      },
      {
        href: "/dashboard/tver-creative-review",
        label: "TVer クリエイティブ考査申請",
        icon: Tv2,
        minRole: "USER",
      },
      {
        href: "/dashboard/media",
        label: "媒体依頼",
        icon: Megaphone,
        minRole: "USER",
      },
    ],
  },

  {
    section: "SNS簡易制作（Studio）",
    color: "text-fuchsia-500/80",
    items: [
      {
        href: "/dashboard/studio",
        label: "Studio ホーム",
        icon: Palette,
        minRole: "USER",
      },
      {
        href: "/dashboard/studio/clients",
        label: "クライアント管理",
        icon: Users,
        minRole: "USER",
      },
      {
        href: "/dashboard/studio/generate",
        label: "SNSプラン生成",
        icon: Wand2,
        minRole: "USER",
      },
      {
        href: "/dashboard/studio/caption",
        label: "キャプション生成",
        icon: MessageCircle,
        minRole: "USER",
      },
      {
        href: "/dashboard/studio/subtitle",
        label: "自動字幕生成",
        icon: Captions,
        minRole: "USER",
      },
      {
        href: "/dashboard/studio/results",
        label: "成果ダッシュボード",
        icon: BarChart2,
        minRole: "USER",
      },
      {
        href: "/dashboard/studio/insights",
        label: "営業インサイト",
        icon: Lightbulb,
        minRole: "ADMIN",
      },
      {
        href: "/dashboard/studio/sns-formats",
        label: "SNSフォーマット",
        icon: Play,
        minRole: "USER",
      },
      {
        href: "/dashboard/studio/library",
        label: "制作ライブラリ",
        icon: ImagePlus,
        minRole: "USER",
      },
    ],
  },
  {
    section: "サポート・研修",
    color: "text-teal-500/80",
    items: [
      {
        href: "https://calendar.app.google/DvCvNkUvw91Ytq9u8",
        label: "本部打ち合わせ予約",
        icon: CalendarCheck,
        minRole: "USER",
        external: true,
      },
      {
        href: "/dashboard/learning",
        label: "ラーニング",
        icon: GraduationCap,
        minRole: "USER",
      },
    ],
  },
  {
    section: "管理者",
    color: "text-zinc-600",
    items: [
      {
        href: "/dashboard/group-profiles/highlights",
        label: "連携案件ハイライト",
        icon: Sparkles,
        minRole: "ADMIN",
      },
      {
        href: "/dashboard/group-support",
        label: "グループサポート",
        icon: HeartHandshake,
        minRole: "ADMIN",
      },
      {
        href: "/dashboard/admin/users",
        label: "メンバー管理",
        icon: Shield,
        minRole: "ADMIN",
      },
      {
        href: "/dashboard/login-logs",
        label: "操作ログ",
        icon: ClipboardList,
        minRole: "ADMIN",
      },
      {
        href: "/dashboard/admin/chatbot-logs",
        label: "チャットボット履歴",
        icon: MessageCircle,
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
    enabledFeatures?: string[];
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
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set());
  const [expandedSections, setExpandedSections] = useState<Set<string>>(new Set());

  const toggleGroup = (href: string) => {
    setExpandedGroups((prev) => {
      const next = new Set(prev);
      if (next.has(href)) next.delete(href);
      else next.add(href);
      return next;
    });
  };

  const toggleSection = (section: string) => {
    setExpandedSections((prev) => {
      const next = new Set(prev);
      if (next.has(section)) next.delete(section);
      else next.add(section);
      return next;
    });
  };

  // セクション内のいずれかのアイテムが active ならそのセクションを開く
  const isSectionActive = (section: typeof NAV_SECTIONS[number]) =>
    section.items.some(
      (item) =>
        pathname === item.href ||
        pathname.startsWith(item.href + "/") ||
        item.children?.some(
          (child) =>
            pathname === child.href || pathname.startsWith(child.href + "/")
        )
    );

  // children のいずれかが active なら親グループも開く
  const isGroupActive = (item: NavItem) =>
    item.children?.some(
      (child) =>
        pathname === child.href || pathname.startsWith(child.href + "/")
    ) ?? false;
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
            <Image
              src={user.image}
              alt=""
              width={32}
              height={32}
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
      <nav data-tour="sidebar" className="flex-1 overflow-y-auto px-3 py-3 space-y-4 scrollbar-thin">
        {NAV_SECTIONS.map((section) => {
          const visibleItems = section.items.filter((item) => {
            if (!hasMinRole(user.role, item.minRole)) return false;
            // requiredFeature がある場合: ADMINは常に表示、それ以外は許可されている場合のみ
            if (item.requiredFeature && user.role !== "ADMIN") {
              return (user.enabledFeatures ?? []).includes(item.requiredFeature);
            }
            return true;
          });
          if (visibleItems.length === 0) return null;

          const sectionOpen = expandedSections.has(section.section) || isSectionActive(section);

          return (
            <div key={section.section}>
              <button
                onClick={() => toggleSection(section.section)}
                className={cn(
                  "flex items-center justify-between w-full px-2 mb-1 text-[10px] font-semibold uppercase tracking-widest hover:opacity-100 transition-opacity",
                  section.color,
                  sectionOpen ? "opacity-100" : "opacity-60"
                )}
              >
                <span>{section.section}</span>
                {sectionOpen ? (
                  <ChevronDown className="w-3 h-3 opacity-50" />
                ) : (
                  <ChevronRight className="w-3 h-3 opacity-50" />
                )}
              </button>
              {sectionOpen && (
              <ul className="space-y-0.5">
                {visibleItems.map((item) => {
                  // --- 折りたたみグループ ---
                  if (item.children && item.children.length > 0) {
                    const groupActive = isGroupActive(item);
                    const isOpen_ = expandedGroups.has(item.href) || groupActive;

                    return (
                      <li key={item.href}>
                        <button
                          onClick={() => toggleGroup(item.href)}
                          className={cn(
                            "flex items-center gap-2.5 px-2.5 py-1.5 rounded-md text-xs transition-all duration-100 w-full",
                            groupActive
                              ? "text-white bg-zinc-800/80"
                              : "text-zinc-400 hover:text-white hover:bg-zinc-800"
                          )}
                        >
                          <item.icon className="w-3.5 h-3.5 flex-shrink-0" />
                          <span className="truncate flex-1 text-left">{item.label}</span>
                          {isOpen_ ? (
                            <ChevronDown className="w-3 h-3 flex-shrink-0 opacity-50" />
                          ) : (
                            <ChevronRight className="w-3 h-3 flex-shrink-0 opacity-50" />
                          )}
                        </button>
                        {isOpen_ && (
                          <ul className="ml-3 mt-0.5 space-y-0.5 border-l border-zinc-800 pl-2">
                            {item.children
                              .filter((child) => hasMinRole(user.role, child.minRole))
                              .map((child) => {
                                const childActive =
                                  child.href === "/dashboard/leads"
                                    ? pathname === "/dashboard/leads"
                                    : pathname === child.href ||
                                      pathname.startsWith(child.href + "/");

                                return (
                                  <li key={child.href}>
                                    <Link
                                      href={child.href}
                                      className={cn(
                                        "flex items-center gap-2 px-2 py-1 rounded-md text-[11px] transition-all duration-100",
                                        childActive
                                          ? "bg-blue-600 text-white shadow-sm"
                                          : "text-zinc-500 hover:text-white hover:bg-zinc-800"
                                      )}
                                    >
                                      <child.icon className="w-3 h-3 flex-shrink-0" />
                                      <span className="truncate">{child.label}</span>
                                    </Link>
                                  </li>
                                );
                              })}
                          </ul>
                        )}
                      </li>
                    );
                  }

                  // --- 通常アイテム ---
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
              )}
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
