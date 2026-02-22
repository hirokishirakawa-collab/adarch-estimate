import Link from "next/link";
import { cn } from "@/lib/utils";
import { hasMinRole } from "@/types/roles";
import type { UserRole } from "@/types/roles";
import {
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
  Lock,
} from "lucide-react";

// ----------------------------------------------------------------
// モジュール定義（全13）
// ----------------------------------------------------------------
interface Module {
  id: string;
  href: string;
  label: string;
  description: string;
  icon: React.ElementType;
  iconBg: string;
  iconColor: string;
  minRole: UserRole;
  badge?: { label: string; className: string };
}

const MODULES: Module[] = [
  {
    id: "crm",
    href: "/customers",
    label: "顧客管理 (CRM)",
    description: "先着優先ロック付き顧客情報管理",
    icon: Users,
    iconBg: "bg-blue-50",
    iconColor: "text-blue-600",
    minRole: "USER",
  },
  {
    id: "sfa",
    href: "/deals",
    label: "商談管理 (SFA)",
    description: "進捗・勝率・パイプライン管理",
    icon: TrendingUp,
    iconBg: "bg-emerald-50",
    iconColor: "text-emerald-600",
    minRole: "USER",
  },
  {
    id: "pm",
    href: "/projects",
    label: "プロジェクト管理",
    description: "Drive フォルダ自動生成・同期",
    icon: FolderKanban,
    iconBg: "bg-violet-50",
    iconColor: "text-violet-600",
    minRole: "USER",
  },
  {
    id: "estimate",
    href: "/estimates",
    label: "公式見積もり",
    description: "PDF 自動生成・単価分析",
    icon: FileText,
    iconBg: "bg-amber-50",
    iconColor: "text-amber-600",
    minRole: "USER",
  },
  {
    id: "group",
    href: "/group-sync",
    label: "グループ連携履歴",
    description: "拠点間シナジーの可視化",
    icon: Network,
    iconBg: "bg-sky-50",
    iconColor: "text-sky-600",
    minRole: "USER",
  },
  {
    id: "billing",
    href: "/billing",
    label: "請求依頼",
    description: "本部宛承認ワークフロー",
    icon: Receipt,
    iconBg: "bg-orange-50",
    iconColor: "text-orange-600",
    minRole: "USER",
  },
  {
    id: "sales",
    href: "/sales-report",
    label: "売上報告",
    description: "実績集計・管理者分析ダッシュボード",
    icon: BarChart2,
    iconBg: "bg-rose-50",
    iconColor: "text-rose-600",
    // MANAGER以上（代表=自拠点のみ、ADMIN=全拠点）
    minRole: "MANAGER",
    badge: {
      label: "MANAGER+",
      className: "bg-blue-100 text-blue-700",
    },
  },
  {
    id: "legal",
    href: "/legal",
    label: "契約法務依頼",
    description: "NDA・契約書の作成・チェック依頼",
    icon: Scale,
    iconBg: "bg-zinc-100",
    iconColor: "text-zinc-600",
    minRole: "USER",
  },
  {
    id: "training",
    href: "/training",
    label: "研修",
    description: "Learning Box SSO 連携",
    icon: GraduationCap,
    iconBg: "bg-teal-50",
    iconColor: "text-teal-600",
    minRole: "USER",
  },
  {
    id: "bizcard",
    href: "/business-cards",
    label: "名刺管理",
    description: "OCR + AI 自動登録",
    icon: CreditCard,
    iconBg: "bg-indigo-50",
    iconColor: "text-indigo-600",
    minRole: "USER",
  },
  {
    id: "media",
    href: "/media",
    label: "媒体依頼",
    description: "外部発注・進捗管理",
    icon: Megaphone,
    iconBg: "bg-pink-50",
    iconColor: "text-pink-600",
    minRole: "USER",
  },
  {
    id: "gemini",
    href: "/gemini",
    label: "自社 GEMINI",
    description: "Chat / Drive 学習 RAG 基盤",
    icon: Bot,
    iconBg: "bg-blue-950",
    iconColor: "text-blue-300",
    minRole: "USER",
    badge: {
      label: "AI",
      className: "bg-blue-100 text-blue-700",
    },
  },
  {
    id: "salestool",
    href: "/sales-tools",
    label: "営業ツール",
    description: "勝因分析・AI 提案資料作成支援",
    icon: Briefcase,
    iconBg: "bg-lime-50",
    iconColor: "text-lime-700",
    minRole: "USER",
  },
];

// ----------------------------------------------------------------
// ModuleGrid コンポーネント
// ----------------------------------------------------------------
export function ModuleGrid({ role }: { role: UserRole }) {
  const accessible = MODULES.filter((m) => hasMinRole(role, m.minRole));
  const locked = MODULES.filter((m) => !hasMinRole(role, m.minRole));

  return (
    <section>
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-sm font-semibold text-zinc-700">
          モジュール一覧
          <span className="ml-2 text-xs font-normal text-zinc-400">
            ({accessible.length} / {MODULES.length})
          </span>
        </h2>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 gap-3">
        {/* アクセス可能なモジュール */}
        {accessible.map((mod) => (
          <Link key={mod.id} href={mod.href}>
            <div className="bg-white rounded-xl border border-zinc-200 p-4 h-full transition-all duration-150 hover:border-blue-300 hover:shadow-md hover:-translate-y-0.5 cursor-pointer group">
              <div className="flex items-start justify-between mb-3">
                <div
                  className={cn(
                    "w-9 h-9 rounded-xl flex items-center justify-center",
                    mod.iconBg
                  )}
                >
                  <mod.icon className={cn("w-4.5 h-4.5", mod.iconColor)} style={{ width: "1.125rem", height: "1.125rem" }} />
                </div>
                {mod.badge && (
                  <span
                    className={cn(
                      "text-[10px] px-1.5 py-0.5 rounded font-semibold",
                      mod.badge.className
                    )}
                  >
                    {mod.badge.label}
                  </span>
                )}
              </div>
              <p className="text-xs font-semibold text-zinc-800 leading-snug group-hover:text-blue-700 transition-colors">
                {mod.label}
              </p>
              <p className="text-[11px] text-zinc-500 mt-1 leading-relaxed">
                {mod.description}
              </p>
            </div>
          </Link>
        ))}

        {/* アクセス不可モジュール（ロック表示） */}
        {locked.map((mod) => (
          <div key={mod.id}>
            <div className="bg-zinc-50 rounded-xl border border-zinc-100 p-4 h-full opacity-50">
              <div className="flex items-start justify-between mb-3">
                <div
                  className={cn(
                    "w-9 h-9 rounded-xl flex items-center justify-center",
                    mod.iconBg
                  )}
                >
                  <mod.icon className={cn("w-4.5 h-4.5", mod.iconColor)} style={{ width: "1.125rem", height: "1.125rem" }} />
                </div>
                <Lock className="w-3.5 h-3.5 text-zinc-400" />
              </div>
              <p className="text-xs font-semibold text-zinc-500 leading-snug">
                {mod.label}
              </p>
              <p className="text-[11px] text-zinc-400 mt-1 leading-relaxed">
                {mod.description}
              </p>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
