import { cn } from "@/lib/utils";
import type { UserRole } from "@/types/roles";
import {
  Users,
  TrendingUp,
  BarChart2,
  FolderKanban,
  Target,
  AlertCircle,
  ArrowUpRight,
  ArrowDownRight,
  Minus,
} from "lucide-react";

// ----------------------------------------------------------------
// 型定義
// ----------------------------------------------------------------
interface StatCard {
  label: string;
  value: string;
  subtext: string;
  icon: React.ElementType;
  iconBg: string;
  iconColor: string;
  trend?: { value: string; direction: "up" | "down" | "flat" };
}

// ----------------------------------------------------------------
// ロール別のダミーデータ（Phase 2 以降は DB から取得）
// ----------------------------------------------------------------
function getStats(role: UserRole): StatCard[] {
  if (role === "ADMIN") {
    return [
      {
        label: "総顧客数",
        value: "248",
        subtext: "全拠点合計",
        icon: Users,
        iconBg: "bg-blue-50",
        iconColor: "text-blue-600",
        trend: { value: "+12%", direction: "up" },
      },
      {
        label: "進行中商談",
        value: "32",
        subtext: "受注率 68%",
        icon: TrendingUp,
        iconBg: "bg-emerald-50",
        iconColor: "text-emerald-600",
        trend: { value: "+5%", direction: "up" },
      },
      {
        label: "今月売上",
        value: "¥12,400,000",
        subtext: "目標比 103%",
        icon: BarChart2,
        iconBg: "bg-amber-50",
        iconColor: "text-amber-600",
        trend: { value: "+8%", direction: "up" },
      },
      {
        label: "進行中 PJ",
        value: "18",
        subtext: "全社",
        icon: FolderKanban,
        iconBg: "bg-violet-50",
        iconColor: "text-violet-600",
        trend: { value: "±0", direction: "flat" },
      },
    ];
  }

  if (role === "MANAGER") {
    // 代表：自拠点のデータのみ（Phase 2でbranchIdによるDBフィルタリング実装）
    return [
      {
        label: "自拠点 顧客数",
        value: "48",
        subtext: "自拠点合計",
        icon: Users,
        iconBg: "bg-blue-50",
        iconColor: "text-blue-600",
        trend: { value: "+8%", direction: "up" },
      },
      {
        label: "自拠点 商談数",
        value: "8",
        subtext: "進行中",
        icon: TrendingUp,
        iconBg: "bg-emerald-50",
        iconColor: "text-emerald-600",
        trend: { value: "+2件", direction: "up" },
      },
      {
        label: "自拠点 今月売上",
        value: "¥4,200,000",
        subtext: "目標比 87%",
        icon: BarChart2,
        iconBg: "bg-amber-50",
        iconColor: "text-amber-600",
        trend: { value: "+5%", direction: "up" },
      },
      {
        label: "自拠点 PJ",
        value: "5",
        subtext: "進行中",
        icon: FolderKanban,
        iconBg: "bg-violet-50",
        iconColor: "text-violet-600",
        trend: { value: "±0", direction: "flat" },
      },
    ];
  }

  // USER
  return [
    {
      label: "担当顧客",
      value: "12",
      subtext: "自分の担当",
      icon: Users,
      iconBg: "bg-blue-50",
      iconColor: "text-blue-600",
      trend: { value: "+2件", direction: "up" },
    },
    {
      label: "進行中商談",
      value: "3",
      subtext: "対応中",
      icon: TrendingUp,
      iconBg: "bg-emerald-50",
      iconColor: "text-emerald-600",
      trend: { value: "±0", direction: "flat" },
    },
    {
      label: "参加中 PJ",
      value: "2",
      subtext: "進行中",
      icon: FolderKanban,
      iconBg: "bg-violet-50",
      iconColor: "text-violet-600",
      trend: { value: "±0", direction: "flat" },
    },
    {
      label: "未対応タスク",
      value: "5",
      subtext: "要アクション",
      icon: AlertCircle,
      iconBg: "bg-rose-50",
      iconColor: "text-rose-600",
      trend: { value: "2件新着", direction: "down" },
    },
  ];
}

const TrendIcon = {
  up: ArrowUpRight,
  down: ArrowDownRight,
  flat: Minus,
};

const TrendColor = {
  up: "text-emerald-600",
  down: "text-rose-600",
  flat: "text-zinc-400",
};

// ----------------------------------------------------------------
// StatsGrid コンポーネント
// ----------------------------------------------------------------
export function StatsGrid({ role }: { role: UserRole }) {
  const stats = getStats(role);

  return (
    <div className="grid grid-cols-2 xl:grid-cols-4 gap-4">
      {stats.map((stat) => {
        const Icon = stat.icon;
        const TIcon = stat.trend ? TrendIcon[stat.trend.direction] : null;
        const trendColor = stat.trend ? TrendColor[stat.trend.direction] : "";

        return (
          <div
            key={stat.label}
            className="bg-white rounded-xl border border-zinc-200 p-5 flex flex-col gap-3 hover:shadow-sm transition-shadow"
          >
            <div className="flex items-center justify-between">
              <p className="text-xs font-medium text-zinc-500">{stat.label}</p>
              <div
                className={cn(
                  "w-8 h-8 rounded-lg flex items-center justify-center",
                  stat.iconBg
                )}
              >
                <Icon className={cn("w-4 h-4", stat.iconColor)} />
              </div>
            </div>

            <div>
              <p className="text-2xl font-bold text-zinc-900 tabular-nums">
                {stat.value}
              </p>
              <p className="text-xs text-zinc-400 mt-0.5">{stat.subtext}</p>
            </div>

            {stat.trend && TIcon && (
              <div className={cn("flex items-center gap-1 text-xs font-medium", trendColor)}>
                <TIcon className="w-3.5 h-3.5" />
                <span>{stat.trend.value} 先月比</span>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
