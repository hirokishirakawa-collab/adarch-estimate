"use client";

import { useState, useEffect } from "react";
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
  Repeat,
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
  AlertTriangle,
  Star,
  Bot,
  Rocket,
  Paintbrush,
  Briefcase,
  Banknote,
} from "lucide-react";

// ----------------------------------------------------------------
// お気に入り型定義
// ----------------------------------------------------------------
interface FavoriteItem {
  id: string;
  path: string;
  label: string;
  icon: string | null;
}

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
      {
        href: "/dashboard/partner-status",
        label: "稼働ステータス申告",
        icon: Activity,
        minRole: "MANAGER",
      },
      {
        href: "/dashboard/leads/list",
        label: "リード管理・営業報告",
        icon: ListChecks,
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
        href: "/dashboard/regulars",
        label: "レギュラー案件",
        icon: Repeat,
        minRole: "MANAGER",
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
      },
      {
        href: "/dashboard/leads/tvcm-pool",
        label: "TVer広告 案件プール",
        icon: Film,
        minRole: "USER",
      },
      {
        href: "/dashboard/leads/tvcm",
        label: "TVer広告 案件クロール（本部）",
        icon: Film,
        minRole: "ADMIN",
      },
      {
        href: "/dashboard/leads/tvcm-history",
        label: "TVer広告 案件履歴（本部）",
        icon: Film,
        minRole: "ADMIN",
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
      {
        // 本部は常時表示。開拓パートナー（enabledFeatures に franchise-leads）にのみ追加開放
        href: "/dashboard/franchise-leads",
        label: "加盟リード獲得AI",
        icon: Users,
        minRole: "USER",
        requiredFeature: "franchise-leads",
      },
      {
        href: "/dashboard/creator-leads",
        label: "クリエイター発掘AI",
        icon: Sparkles,
        minRole: "ADMIN",
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
        href: "/review",
        label: "映像チェッカー",
        icon: Eye,
        minRole: "USER",
        external: true,
      },
      {
        href: "/dashboard/cutsheet",
        label: "動画カット表AI",
        icon: Film,
        minRole: "USER",
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
        href: "/dashboard/violation-report",
        label: "コンプライアンス相談",
        icon: AlertTriangle,
        minRole: "MANAGER",
      },
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
      {
        href: "/dashboard/playbook",
        label: "営業プレイブック",
        icon: BookOpen,
        minRole: "USER",
      },
    ],
  },
  {
    section: "経理",
    color: "text-indigo-500/80",
    items: [
      {
        href: "/dashboard/billing",
        label: "請求依頼",
        icon: CreditCard,
        minRole: "USER",
      },
      {
        href: "/dashboard/payments",
        label: "支払明細",
        icon: Banknote,
        minRole: "MANAGER",
      },
      {
        href: "/dashboard/royalty",
        label: "ロイヤリティ",
        icon: Sparkles,
        minRole: "MANAGER",
      },
      {
        href: "/dashboard/billing/settings",
        label: "経理情報の登録",
        icon: Building2,
        minRole: "MANAGER",
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
    section: "クリエイター",
    color: "text-indigo-600",
    items: [
      {
        href: "/dashboard/creators",
        label: "クリエイター検索",
        icon: Paintbrush,
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
        href: "/dashboard/admin/partner-status",
        label: "パートナー稼働管理",
        icon: Activity,
        minRole: "ADMIN",
      },
      {
        href: "/dashboard/admin/violation-reports",
        label: "コンプライアンス相談管理",
        icon: AlertTriangle,
        minRole: "ADMIN",
      },
      {
        href: "/dashboard/admin/payments",
        label: "支払明細管理",
        icon: Banknote,
        minRole: "ADMIN",
      },
      {
        href: "/dashboard/admin/group-invoices",
        label: "グループ請求書",
        icon: FileText,
        minRole: "ADMIN",
      },
      {
        href: "/dashboard/admin/royalty",
        label: "ロイヤリティ状況",
        icon: TrendingUp,
        minRole: "ADMIN",
      },
      {
        href: "/dashboard/admin/partner-billing",
        label: "パートナー経理管理",
        icon: Building2,
        minRole: "ADMIN",
      },
      {
        href: "/dashboard/admin/users",
        label: "メンバー管理",
        icon: Shield,
        minRole: "ADMIN",
      },
      {
        href: "/dashboard/admin/learning",
        label: "ラーニング管理",
        icon: GraduationCap,
        minRole: "ADMIN",
      },
      {
        href: "/dashboard/login-logs",
        label: "操作ログ",
        icon: ClipboardList,
        minRole: "ADMIN",
      },
      {
        href: "/dashboard/admin/audit-logs",
        label: "操作ログ（詳細）",
        icon: Shield,
        minRole: "ADMIN",
      },
      {
        href: "/dashboard/admin/api-usage",
        label: "API利用状況",
        icon: Activity,
        minRole: "ADMIN",
      },
      {
        href: "/dashboard/admin/chatbot-logs",
        label: "チャットボット履歴",
        icon: MessageCircle,
        minRole: "ADMIN",
      },
      {
        href: "/dashboard/creators/admin",
        label: "クリエイター管理",
        icon: Paintbrush,
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
    className: "bg-gradient-to-r from-indigo-500 to-cyan-500 text-white border-0 rounded-full",
  },
  MANAGER: {
    label: "MANAGER",
    className: "bg-cyan-500/10 text-cyan-600 border border-cyan-500/15 rounded-full",
  },
  USER: {
    label: "USER",
    className: "bg-slate-100 text-slate-500 border border-slate-200 rounded-full",
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
  reportWarning?: "yellow" | "red" | null;
  isSuspended?: boolean;
}

// ----------------------------------------------------------------
// Sidebar コンポーネント
// ----------------------------------------------------------------
// ----------------------------------------------------------------
// 営業タブ: 最優先の7項目（フラット表示）
// ----------------------------------------------------------------
const SALES_TAB_ITEMS: NavItem[] = [
  { href: "/dashboard/customers", label: "顧客管理", icon: Users, minRole: "USER" },
  { href: "/dashboard/leads/list", label: "リード管理", icon: ListChecks, minRole: "USER" },
  { href: "/dashboard/deals", label: "商談管理（SFA）", icon: TrendingUp, minRole: "USER" },
  { href: "/dashboard/leads", label: "リード獲得AI", icon: Crosshair, minRole: "USER" },
  { href: "/dashboard/video-achievements", label: "競合実績スクレイピング", icon: Target, minRole: "USER" },
  { href: "/dashboard/sales-insights", label: "営業分析レポート", icon: Activity, minRole: "USER" },
  { href: "/dashboard/sales-approaches", label: "アプローチ事例集", icon: Send, minRole: "USER" },
  { href: "/dashboard/playbook", label: "営業プレイブック", icon: BookOpen, minRole: "MANAGER" },
  { href: "/dashboard/leads/list", label: "営業報告", icon: ClipboardList, minRole: "USER" },
  {
    href: "#media-simulators",
    label: "広告媒体シミュレーター",
    icon: Megaphone,
    minRole: "USER",
    children: [
      { href: "/dashboard/strategy-advisor", label: "提案戦略アドバイザー（AI）", icon: Sparkles, minRole: "USER" },
      { href: "/dashboard/tver-simulator", label: "TVer広告", icon: Tv2, minRole: "USER" },
      { href: "/dashboard/taxi-ads-simulator", label: "タクシー広告", icon: Car, minRole: "USER" },
      { href: "/dashboard/skylark-simulator", label: "すかいらーくインストア", icon: UtensilsCrossed, minRole: "USER" },
      { href: "/dashboard/univ-coop-simulator", label: "大学生協広告", icon: GraduationCap, minRole: "USER" },
      { href: "/dashboard/aeon-cinema-simulator", label: "イオンシネマ", icon: Clapperboard, minRole: "USER" },
      { href: "/dashboard/golfcart-simulator", label: "ゴルフカート", icon: Flag, minRole: "USER" },
      { href: "/dashboard/omochannel-simulator", label: "おもチャンネル", icon: Tv2, minRole: "USER" },
    ],
  },
];

// ----------------------------------------------------------------
// 制作タブ
// ----------------------------------------------------------------
const PRODUCTION_TAB_ITEMS: NavItem[] = [
  { href: "/dashboard/projects", label: "プロジェクト一覧", icon: FolderKanban, minRole: "USER" },
  { href: "/dashboard/tver-review", label: "TVer業態考査申請", icon: Tv2, minRole: "USER" },
  { href: "/dashboard/tver-campaign", label: "TVer配信申請", icon: Tv2, minRole: "USER" },
  { href: "/dashboard/tver-creative-review", label: "TVer クリエイティブ考査申請", icon: Tv2, minRole: "USER" },
  { href: "/dashboard/media", label: "媒体依頼", icon: Megaphone, minRole: "USER" },
];

// ----------------------------------------------------------------
// 管理タブ
// ----------------------------------------------------------------
const ADMIN_TAB_ITEMS: NavItem[] = [
  { href: "/dashboard/billing", label: "請求依頼", icon: CreditCard, minRole: "USER" },
  { href: "/dashboard/sales-report", label: "月次報告", icon: BarChart2, minRole: "MANAGER" },
  {
    href: "https://calendar.app.google/DvCvNkUvw91Ytq9u8",
    label: "本部打ち合わせ予約",
    icon: CalendarCheck,
    minRole: "USER",
    external: true,
  },
  { href: "/dashboard/partner-status", label: "稼働ステータス申告", icon: Activity, minRole: "MANAGER" },
];

type SidebarTab = "sales" | "production" | "admin" | "all";

export function Sidebar({ user, isOpen, onClose, reportWarning, isSuspended }: SidebarProps) {
  const pathname = usePathname();
  const roleStyle = ROLE_STYLES[user.role];
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set());
  const [expandedSections, setExpandedSections] = useState<Set<string>>(new Set());
  const [favorites, setFavorites] = useState<FavoriteItem[]>([]);
  const [activeTab, setActiveTab] = useState<SidebarTab>("sales");

  useEffect(() => {
    fetch("/api/favorites")
      .then((res) => res.json())
      .then((data: FavoriteItem[]) => {
        if (Array.isArray(data)) setFavorites(data.slice(0, 5));
      })
      .catch(() => {});
  }, []);

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

  const warningColor = reportWarning === "red" ? "red" : "yellow";

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
          "fixed inset-y-0 left-0 z-40 w-64 flex flex-col flex-shrink-0",
          "transform transition-transform duration-300 ease-in-out",
          "md:relative md:translate-x-0 md:w-60",
          isOpen ? "translate-x-0" : "-translate-x-full"
        )}
        style={{
          background: "rgba(255,255,255,0.65)",
          backdropFilter: "blur(20px)",
          WebkitBackdropFilter: "blur(20px)",
          borderRight: "1px solid rgba(0,0,0,0.04)",
          position: isOpen ? "fixed" : undefined,
        }}
      >

        {/* ロゴ */}
        <div className="relative px-5 pt-5 pb-4 border-b border-black/[0.04]">
          <div className="flex items-center justify-between">
            <Link href="/dashboard" className="no-underline cursor-pointer">
              <Image src="/logo-adarch.png" alt="Ad Arch Group" width={140} height={28} />
              <p className="text-[11px] font-medium tracking-[3px] uppercase text-slate-400 mt-1.5">
                GROUP OS
              </p>
            </Link>
            {/* モバイル用閉じるボタン */}
            <button
              onClick={onClose}
              className="md:hidden p-1 rounded-md text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* ユーザー情報カード */}
        <div className="relative mx-3 my-3 p-3 rounded-xl bg-indigo-500/[0.04] border border-indigo-500/[0.08] transition-colors hover:border-indigo-500/[0.15]">
          <div className="flex items-center gap-2.5">
            {user.image ? (
              <Image
                src={user.image}
                alt=""
                width={36}
                height={36}
                className="w-9 h-9 rounded-[10px] ring-1 ring-black/[0.06]"
              />
            ) : (
              <div className="w-9 h-9 rounded-[10px] bg-gradient-to-br from-indigo-500 to-indigo-600 flex items-center justify-center text-sm font-bold text-white flex-shrink-0">
                {initial}
              </div>
            )}
            <div className="min-w-0 flex-1">
              <p className="text-[13px] font-semibold text-slate-800 truncate">
                {user.name ?? "ユーザー"}
              </p>
              <p className="text-[11px] text-slate-400 truncate">{user.email}</p>
            </div>
          </div>
          <div className="mt-2.5">
            <span
              className={cn(
                "inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold tracking-wide",
                roleStyle.className
              )}
            >
              {roleStyle.label}
            </span>
          </div>
        </div>

        {/* Report Warning */}
        {reportWarning && (
          <Link
            href="/dashboard/sales-report/new"
            className={cn(
              "mx-3 mb-2 p-2.5 rounded-[10px] flex items-center gap-2.5 cursor-pointer transition-all",
              warningColor === "red"
                ? "bg-gradient-to-br from-red-500/10 to-red-500/[0.04] border border-red-500/20 hover:border-red-500/35"
                : "bg-gradient-to-br from-yellow-500/10 to-yellow-500/[0.04] border border-yellow-500/20 hover:border-yellow-500/35"
            )}
          >
            <div className="relative">
              <div
                className={cn(
                  "w-8 h-8 rounded-lg flex items-center justify-center",
                  warningColor === "red" ? "bg-red-500/15" : "bg-yellow-500/15"
                )}
              >
                <AlertTriangle
                  className={cn(
                    "w-4 h-4",
                    warningColor === "red" ? "text-red-500" : "text-yellow-500"
                  )}
                />
              </div>
              <span
                className={cn(
                  "w-1.5 h-1.5 rounded-full animate-pulse absolute -top-0.5 -right-0.5",
                  warningColor === "red" ? "bg-red-500" : "bg-yellow-500"
                )}
              />
            </div>
            <div className="flex-1 min-w-0">
              <p
                className={cn(
                  "text-[11px] font-bold",
                  warningColor === "red" ? "text-red-500" : "text-yellow-500"
                )}
              >
                月次報告 未提出
              </p>
              <p
                className={cn(
                  "text-[10px]",
                  warningColor === "red" ? "text-red-500/60" : "text-yellow-500/60"
                )}
              >
                {warningColor === "red"
                  ? "翌月1日にアクセス停止"
                  : "月末までに提出してください"}
              </p>
            </div>
            <span
              className={cn(
                "text-xs flex-shrink-0",
                warningColor === "red" ? "text-red-500/40" : "text-yellow-500/40"
              )}
            >
              ›
            </span>
          </Link>
        )}

        {/* タブ切り替え */}
        <div className="relative mx-3 mt-2 mb-1 grid grid-cols-4 rounded-[10px] bg-black/[0.03] p-[3px] gap-0.5">
          {([
            { key: "sales", label: "営業" },
            { key: "production", label: "制作" },
            { key: "admin", label: "管理" },
            { key: "all", label: "全て" },
          ] as const).map((tab) => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={cn(
                "py-1.5 text-[10px] font-bold tracking-wide rounded-md transition-all duration-200",
                activeTab === tab.key
                  ? "bg-white text-indigo-600 shadow-sm"
                  : "text-slate-400 hover:text-slate-600"
              )}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* ナビゲーション */}
        <nav
          data-tour="sidebar"
          className="relative flex-1 overflow-y-auto px-3 py-3 space-y-4"
          style={{
            scrollbarWidth: "thin",
            scrollbarColor: "rgba(0,0,0,0.06) transparent",
          }}
        >
          <style>{`
            nav[data-tour="sidebar"]::-webkit-scrollbar { width: 3px; }
            nav[data-tour="sidebar"]::-webkit-scrollbar-track { background: transparent; }
            nav[data-tour="sidebar"]::-webkit-scrollbar-thumb { background: rgba(0,0,0,0.06); border-radius: 3px; }
          `}</style>

          {/* ===== 営業タブ ===== */}
          {activeTab === "sales" && (
            <ul className="space-y-0.5">
              {SALES_TAB_ITEMS.filter((item) => hasMinRole(user.role, item.minRole)).map((item) => {
                // 折りたたみグループ（リード獲得AI）
                if (item.children && item.children.length > 0) {
                  const groupActive = item.children.some(
                    (child) => pathname === child.href || pathname.startsWith(child.href + "/")
                  );
                  const isOpen_ = expandedGroups.has(item.href) || groupActive;

                  return (
                    <li key={item.href}>
                      <button
                        onClick={() => toggleGroup(item.href)}
                        className={cn(
                          "relative flex items-center gap-2.5 px-2.5 py-[7px] rounded-lg text-[13px] transition-all duration-150 w-full group",
                          groupActive
                            ? "bg-indigo-50 text-indigo-600 font-medium"
                            : "text-slate-500 hover:text-slate-800 hover:bg-slate-100/60"
                        )}
                      >
                        {groupActive && (
                          <span className="absolute left-0 top-1/2 -translate-y-1/2 w-[3px] h-4 rounded-r-sm bg-gradient-to-b from-indigo-500 to-cyan-500" />
                        )}
                        <item.icon
                          className={cn(
                            "w-4 h-4 flex-shrink-0 transition-colors",
                            groupActive ? "text-indigo-500" : "text-slate-400 group-hover:text-indigo-500/70"
                          )}
                        />
                        <span className="truncate flex-1 text-left">{item.label}</span>
                        {isOpen_ ? (
                          <ChevronDown className="w-3 h-3 flex-shrink-0 text-slate-300" />
                        ) : (
                          <ChevronRight className="w-3 h-3 flex-shrink-0 text-slate-300" />
                        )}
                      </button>
                      {isOpen_ && (
                        <ul className="ml-5 mt-0.5 space-y-0.5 border-l border-indigo-200/50 pl-2.5">
                          {item.children
                            .filter((child) => hasMinRole(user.role, child.minRole))
                            .map((child) => {
                              const childActive =
                                child.href === "/dashboard/leads"
                                  ? pathname === "/dashboard/leads"
                                  : pathname === child.href || pathname.startsWith(child.href + "/");
                              return (
                                <li key={child.href}>
                                  <Link
                                    href={child.href}
                                    className={cn(
                                      "relative flex items-center gap-2 text-xs py-[5px] px-2.5 rounded-lg transition-all duration-150 group",
                                      childActive
                                        ? "bg-indigo-50 text-indigo-600 font-medium"
                                        : "text-slate-500 hover:text-slate-800 hover:bg-slate-100/60"
                                    )}
                                  >
                                    {childActive && (
                                      <span className="absolute left-0 top-1/2 -translate-y-1/2 w-[3px] h-4 rounded-r-sm bg-gradient-to-b from-indigo-500 to-cyan-500" />
                                    )}
                                    <child.icon
                                      className={cn(
                                        "w-3.5 h-3.5 flex-shrink-0 transition-colors",
                                        childActive ? "text-indigo-500" : "text-slate-400 group-hover:text-indigo-500/70"
                                      )}
                                    />
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

                // 通常アイテム
                const isActive =
                  pathname === item.href || pathname.startsWith(item.href + "/");
                return (
                  <li key={item.href}>
                    <Link
                      href={item.href}
                      className={cn(
                        "relative flex items-center gap-2.5 px-2.5 py-[7px] rounded-lg text-[13px] transition-all duration-150 group",
                        isActive
                          ? "bg-indigo-50 text-indigo-600 font-medium"
                          : "text-slate-500 hover:text-slate-800 hover:bg-slate-100/60"
                      )}
                    >
                      {isActive && (
                        <span className="absolute left-0 top-1/2 -translate-y-1/2 w-[3px] h-4 rounded-r-sm bg-gradient-to-b from-indigo-500 to-cyan-500" />
                      )}
                      <item.icon
                        className={cn(
                          "w-4 h-4 flex-shrink-0 transition-colors",
                          isActive ? "text-indigo-500" : "text-slate-400 group-hover:text-indigo-500/70"
                        )}
                      />
                      <span className="truncate flex-1">{item.label}</span>
                    </Link>
                  </li>
                );
              })}
            </ul>
          )}

          {/* ===== 制作タブ ===== */}
          {activeTab === "production" && (
            <ul className="space-y-0.5">
              {PRODUCTION_TAB_ITEMS.filter((item) => hasMinRole(user.role, item.minRole)).map((item) => {
                const isActive = pathname === item.href || pathname.startsWith(item.href + "/");
                return (
                  <li key={item.href}>
                    <Link
                      href={item.href}
                      className={cn(
                        "relative flex items-center gap-2.5 px-2.5 py-[7px] rounded-lg text-[13px] transition-all duration-150 group",
                        isActive
                          ? "bg-indigo-50 text-indigo-600 font-medium"
                          : "text-slate-500 hover:text-slate-800 hover:bg-slate-100/60"
                      )}
                    >
                      {isActive && (
                        <span className="absolute left-0 top-1/2 -translate-y-1/2 w-[3px] h-4 rounded-r-sm bg-gradient-to-b from-indigo-500 to-cyan-500" />
                      )}
                      <item.icon
                        className={cn(
                          "w-4 h-4 flex-shrink-0 transition-colors",
                          isActive ? "text-indigo-500" : "text-slate-400 group-hover:text-indigo-500/70"
                        )}
                      />
                      <span className="truncate flex-1">{item.label}</span>
                    </Link>
                  </li>
                );
              })}
            </ul>
          )}

          {/* ===== 管理タブ ===== */}
          {activeTab === "admin" && (
            <ul className="space-y-0.5">
              {ADMIN_TAB_ITEMS.filter((item) => hasMinRole(user.role, item.minRole)).map((item) => {
                const isActive = pathname === item.href || pathname.startsWith(item.href + "/");
                const isMonthlyReport = item.href === "/dashboard/sales-report";
                return (
                  <li key={item.href}>
                    {item.external ? (
                      <a
                        href={item.href}
                        target="_blank"
                        rel="noopener noreferrer"
                        className={cn(
                          "relative flex items-center gap-2.5 px-2.5 py-[7px] rounded-lg text-[13px] transition-all duration-150 group",
                          "text-slate-500 hover:text-slate-800 hover:bg-slate-100/60"
                        )}
                      >
                        <item.icon className="w-4 h-4 flex-shrink-0 text-slate-400 group-hover:text-indigo-500/70 transition-colors" />
                        <span className="truncate flex-1">{item.label}</span>
                      </a>
                    ) : (
                      <Link
                        href={item.href}
                        className={cn(
                          "relative flex items-center gap-2.5 px-2.5 py-[7px] rounded-lg text-[13px] transition-all duration-150 group",
                          isActive
                            ? "bg-indigo-50 text-indigo-600 font-medium"
                            : "text-slate-500 hover:text-slate-800 hover:bg-slate-100/60"
                        )}
                      >
                        {isActive && (
                          <span className="absolute left-0 top-1/2 -translate-y-1/2 w-[3px] h-4 rounded-r-sm bg-gradient-to-b from-indigo-500 to-cyan-500" />
                        )}
                        <item.icon
                          className={cn(
                            "w-4 h-4 flex-shrink-0 transition-colors",
                            isActive ? "text-indigo-500" : "text-slate-400 group-hover:text-indigo-500/70"
                          )}
                        />
                        <span className="truncate flex-1">{item.label}</span>
                        {isMonthlyReport && reportWarning && (
                          <span className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse flex-shrink-0" />
                        )}
                      </Link>
                    )}
                  </li>
                );
              })}
            </ul>
          )}

          {/* ===== すべてタブ ===== */}
          {activeTab === "all" && (<>

          {/* ピン留めセクション */}
          {favorites.length > 0 && (
            <div>
              <div className="flex items-center gap-2 px-2.5 py-2 text-[10px] font-semibold tracking-[1.5px] uppercase text-slate-400">
                <Star className="w-3 h-3 text-indigo-500/60" />
                <span className="flex-shrink-0">ピン留め</span>
                <span className="flex-1 h-px bg-gradient-to-r from-slate-200 to-transparent" />
              </div>
              <ul className="space-y-0.5">
                {favorites.map((fav) => {
                  const isActive = pathname === fav.path || pathname.startsWith(fav.path + "/");
                  return (
                    <li key={fav.id}>
                      <Link
                        href={fav.path}
                        className={cn(
                          "relative flex items-center gap-2.5 px-2.5 py-[7px] rounded-lg text-[13px] transition-all duration-150 group",
                          isActive
                            ? "bg-indigo-50 text-indigo-600 font-medium"
                            : "text-slate-500 hover:text-slate-800 hover:bg-slate-100/60"
                        )}
                      >
                        {isActive && (
                          <span className="absolute left-0 top-1/2 -translate-y-1/2 w-[3px] h-4 rounded-r-sm bg-gradient-to-b from-indigo-500 to-cyan-500" />
                        )}
                        <Star
                          className={cn(
                            "w-4 h-4 flex-shrink-0 transition-colors",
                            isActive
                              ? "text-indigo-500"
                              : "text-indigo-400 group-hover:text-indigo-500"
                          )}
                          fill="currentColor"
                        />
                        <span className="truncate flex-1">{fav.label}</span>
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </div>
          )}

          {NAV_SECTIONS.map((section) => {
            const visibleItems = section.items.filter((item) => {
              // 停止中は月次報告のみ表示
              if (isSuspended) {
                return item.href === "/dashboard/sales-report";
              }
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
                  className="flex items-center gap-2 px-2.5 py-2 w-full text-[10px] font-semibold tracking-[1.5px] uppercase text-slate-400 cursor-pointer hover:text-slate-500 transition-colors"
                >
                  <span className="flex-shrink-0">{section.section}</span>
                  <span className="flex-1 h-px bg-gradient-to-r from-slate-200 to-transparent" />
                  {sectionOpen ? (
                    <ChevronDown className="w-3 h-3 text-slate-300 flex-shrink-0" />
                  ) : (
                    <ChevronRight className="w-3 h-3 text-slate-300 flex-shrink-0" />
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
                              "relative flex items-center gap-2.5 px-2.5 py-[7px] rounded-lg text-[13px] transition-all duration-150 w-full group",
                              groupActive
                                ? "bg-indigo-50 text-indigo-600 font-medium"
                                : "text-slate-500 hover:text-slate-800 hover:bg-slate-100/60"
                            )}
                          >
                            {groupActive && (
                              <span className="absolute left-0 top-1/2 -translate-y-1/2 w-[3px] h-4 rounded-r-sm bg-gradient-to-b from-indigo-500 to-cyan-500" />
                            )}
                            <item.icon
                              className={cn(
                                "w-4 h-4 flex-shrink-0 transition-colors",
                                groupActive
                                  ? "text-indigo-500"
                                  : "text-slate-400 group-hover:text-indigo-500/70"
                              )}
                            />
                            <span className="truncate flex-1 text-left">{item.label}</span>
                            {item.badge && !groupActive && (
                              <span className="text-[9px] px-1.5 py-0.5 rounded bg-indigo-50 text-indigo-500/60 border border-indigo-200/50 font-semibold tracking-wide flex-shrink-0">
                                {item.badge}
                              </span>
                            )}
                            {isOpen_ ? (
                              <ChevronDown className="w-3 h-3 flex-shrink-0 text-slate-300" />
                            ) : (
                              <ChevronRight className="w-3 h-3 flex-shrink-0 text-slate-300" />
                            )}
                          </button>
                          {isOpen_ && (
                            <ul className="ml-5 mt-0.5 space-y-0.5 border-l border-indigo-200/50 pl-2.5">
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
                                          "relative flex items-center gap-2 text-xs py-[5px] px-2.5 rounded-lg transition-all duration-150 group",
                                          childActive
                                            ? "bg-indigo-50 text-indigo-600 font-medium"
                                            : "text-slate-500 hover:text-slate-800 hover:bg-slate-100/60"
                                        )}
                                      >
                                        {childActive && (
                                          <span className="absolute left-0 top-1/2 -translate-y-1/2 w-[3px] h-4 rounded-r-sm bg-gradient-to-b from-indigo-500 to-cyan-500" />
                                        )}
                                        <child.icon
                                          className={cn(
                                            "w-3.5 h-3.5 flex-shrink-0 transition-colors",
                                            childActive
                                              ? "text-indigo-500"
                                              : "text-slate-400 group-hover:text-indigo-500/70"
                                          )}
                                        />
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

                    const isMonthlyReport = item.href === "/dashboard/sales-report";

                    const linkClass = cn(
                      "relative flex items-center gap-2.5 px-2.5 py-[7px] rounded-lg text-[13px] transition-all duration-150 group",
                      isActive
                        ? "bg-indigo-50 text-indigo-600 font-medium"
                        : "text-slate-500 hover:text-slate-800 hover:bg-slate-100/60"
                    );
                    const linkContent = (
                      <>
                        {isActive && (
                          <span className="absolute left-0 top-1/2 -translate-y-1/2 w-[3px] h-4 rounded-r-sm bg-gradient-to-b from-indigo-500 to-cyan-500" />
                        )}
                        <item.icon
                          className={cn(
                            "w-4 h-4 flex-shrink-0 transition-colors",
                            isActive
                              ? "text-indigo-500"
                              : "text-slate-400 group-hover:text-indigo-500/70"
                          )}
                        />
                        <span className="truncate flex-1">{item.label}</span>
                        {isMonthlyReport && reportWarning && (
                          <span className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse flex-shrink-0" />
                        )}
                        {item.badge && !isActive && (
                          <span className="text-[9px] px-1.5 py-0.5 rounded bg-indigo-50 text-indigo-500/60 border border-indigo-200/50 font-semibold tracking-wide flex-shrink-0">
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
          </>)}
        </nav>

        {/* ログアウト */}
        <div className="relative px-3 py-3 border-t border-black/[0.04]">
          <button
            onClick={() => signOut({ callbackUrl: "/login" })}
            className="flex items-center gap-2.5 w-full px-2.5 py-2 rounded-lg text-[13px] text-slate-400 hover:bg-red-50 hover:text-red-500 transition-all"
          >
            <LogOut className="w-4 h-4" />
            <span>ログアウト</span>
          </button>
        </div>
      </aside>
    </>
  );
}
