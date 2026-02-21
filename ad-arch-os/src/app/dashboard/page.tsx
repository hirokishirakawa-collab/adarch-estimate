import { auth } from "@/lib/auth";
import { StatsGrid } from "@/components/dashboard/stats-grid";
import { ModuleGrid } from "@/components/dashboard/module-grid";
import type { UserRole } from "@/types/roles";

// ----------------------------------------------------------------
// 時間帯と権限に応じた挨拶文
// ----------------------------------------------------------------
function getGreeting(
  name: string | null,
  role: UserRole
): { greeting: string; subtext: string } {
  const hour = new Date().getHours();
  const timeGreeting =
    hour < 12 ? "おはようございます" : hour < 18 ? "こんにちは" : "お疲れ様です";

  // Google アカウント名から姓のみを抽出
  const firstName = name?.split(/[\s　]/)[0] ?? null;
  const displayName = firstName ? `${firstName}さん` : "ようこそ";

  const subtexts: Record<UserRole, string> = {
    ADMIN: "全拠点のデータと財務情報へのフルアクセスが有効です",
    MANAGER: "自拠点の財務データと全実務ツールにアクセスできます",
    USER: "担当案件と実務ツールにアクセスできます",
  };

  return {
    greeting: `${timeGreeting}、${displayName}`,
    subtext: subtexts[role],
  };
}

// ----------------------------------------------------------------
// ダッシュボードページ
// ----------------------------------------------------------------
export default async function DashboardPage() {
  const session = await auth();
  const role = (session?.user?.role ?? "USER") as UserRole;
  const name = session?.user?.name ?? null;

  const { greeting, subtext } = getGreeting(name, role);

  return (
    <div className="px-6 py-6 space-y-6 max-w-screen-2xl mx-auto w-full">
      {/* 挨拶ヘッダー */}
      <div className="flex items-end justify-between">
        <div>
          <h2 className="text-xl font-bold text-zinc-900">{greeting}</h2>
          <p className="text-sm text-zinc-500 mt-0.5">{subtext}</p>
        </div>

        {/* ロールバッジ（大）*/}
        <div className="hidden sm:block">
          {role === "ADMIN" && (
            <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold bg-amber-100 text-amber-700 border border-amber-200">
              <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />
              本部 — 全拠点アクセス
            </span>
          )}
          {role === "MANAGER" && (
            <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold bg-blue-100 text-blue-700 border border-blue-200">
              <span className="w-1.5 h-1.5 rounded-full bg-blue-500" />
              代表 — 自拠点データ
            </span>
          )}
          {role === "USER" && (
            <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold bg-zinc-100 text-zinc-600 border border-zinc-200">
              <span className="w-1.5 h-1.5 rounded-full bg-zinc-400" />
              一般社員
            </span>
          )}
        </div>
      </div>

      {/* KPI カード */}
      <StatsGrid role={role} />

      {/* モジュール一覧（13機能）*/}
      <ModuleGrid role={role} />
    </div>
  );
}
