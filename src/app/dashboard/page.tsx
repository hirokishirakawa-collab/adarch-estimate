import { auth } from "@/lib/auth";
import Link from "next/link";
import { db } from "@/lib/db";
import { getMockBranchId } from "@/lib/data/customers";
import { ACTIVITY_TYPE_OPTIONS } from "@/lib/constants/crm";
import { PROJECT_STATUS_OPTIONS } from "@/lib/constants/projects";
import { DEAL_STATUS_OPTIONS } from "@/lib/constants/deals";
import type { UserRole } from "@/types/roles";
import type { ActivityType, ProjectLogType } from "@/generated/prisma/client";
import {
  Plus,
  Users,
  FolderKanban,
  PenLine,
  AlertTriangle,
  Clock,
  ArrowRight,
  TrendingUp,
  LayoutGrid,
  List,
  User,
} from "lucide-react";

// ----------------------------------------------------------------
// ユーティリティ
// ----------------------------------------------------------------
function daysBetween(a: Date, b: Date): number {
  return Math.floor(Math.abs(b.getTime() - a.getTime()) / (1000 * 60 * 60 * 24));
}

function daysUntil(date: Date): number {
  return Math.ceil((date.getTime() - Date.now()) / (1000 * 60 * 60 * 24));
}

function formatDate(date: Date): string {
  return new Intl.DateTimeFormat("ja-JP", {
    month: "numeric",
    day: "numeric",
  }).format(new Date(date));
}

function formatDateTime(date: Date): string {
  return new Intl.DateTimeFormat("ja-JP", {
    month: "numeric",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(date));
}

// ----------------------------------------------------------------
// 活動タイプ設定（アイコン + 色）
// ----------------------------------------------------------------
const ACTIVITY_ICON: Record<
  ActivityType,
  { icon: string; bg: string; text: string }
> = {
  CALL:    { icon: "📞", bg: "bg-blue-100",   text: "text-blue-700" },
  EMAIL:   { icon: "✉️",  bg: "bg-violet-100", text: "text-violet-700" },
  VISIT:   { icon: "🤝", bg: "bg-emerald-100",text: "text-emerald-700" },
  MEETING: { icon: "🖥", bg: "bg-orange-100", text: "text-orange-700" },
  OTHER:   { icon: "📝", bg: "bg-zinc-100",   text: "text-zinc-600" },
  SYSTEM:  { icon: "⚙️", bg: "bg-slate-100",  text: "text-slate-500" },
};

const PROJECT_LOG_ICON: Record<
  ProjectLogType,
  { icon: string; bg: string; text: string; label: string }
> = {
  SYSTEM:          { icon: "⚙️", bg: "bg-slate-100",   text: "text-slate-500",   label: "PJ更新" },
  NOTE:            { icon: "📝", bg: "bg-zinc-100",    text: "text-zinc-600",    label: "メモ" },
  EXPENSE_ADDED:   { icon: "💴", bg: "bg-emerald-100", text: "text-emerald-700", label: "経費追加" },
  EXPENSE_DELETED: { icon: "🗑", bg: "bg-red-100",     text: "text-red-600",     label: "経費削除" },
};

// ----------------------------------------------------------------
// 商談ステータス → ドット色マッピング
// ----------------------------------------------------------------
const DEAL_STATUS_DOT: Record<string, string> = {
  PROSPECTING: "bg-zinc-400",
  QUALIFYING:  "bg-blue-500",
  PROPOSAL:    "bg-violet-500",
  NEGOTIATION: "bg-amber-500",
  CLOSED_WON:  "bg-emerald-500",
  CLOSED_LOST: "bg-red-400",
};

// ----------------------------------------------------------------
// 顧客ランクバッジ
// ----------------------------------------------------------------
function RankBadge({ rank }: { rank: string }) {
  const styles: Record<string, string> = {
    A: "bg-red-100 text-red-700 border-red-200",
    B: "bg-blue-100 text-blue-700 border-blue-200",
    C: "bg-yellow-100 text-yellow-700 border-yellow-200",
    D: "bg-zinc-100 text-zinc-500 border-zinc-200",
  };
  return (
    <span
      className={`inline-flex items-center px-1.5 py-0.5 text-[10px] font-bold rounded border ${styles[rank] ?? styles.D}`}
    >
      {rank}
    </span>
  );
}

// ----------------------------------------------------------------
// ページ本体
// ----------------------------------------------------------------
export default async function DashboardPage() {
  const session = await auth();
  const role = (session?.user?.role ?? "USER") as UserRole;
  const name = session?.user?.name ?? null;
  const email = session?.user?.email ?? "";
  const userBranchId = getMockBranchId(email, role);

  const now = new Date();
  const tenDaysAgo  = new Date(now.getTime() - 10 * 24 * 60 * 60 * 1000);
  const sevenDaysOut = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);

  // 拠点フィルタ
  const branchFilter = userBranchId ? { branchId: userBranchId } : {};

  // ── KPI: 当月の始まり / 現在 ──
  const thisMonthStart = new Date(now.getFullYear(), now.getMonth(), 1);

  // KPI データ並列取得
  const [overdueCount, draftBillingCount, thisMonthRevenue] = await Promise.all([
    db.project.count({
      where: {
        ...branchFilter,
        deadline: { lt: now },
        status: { notIn: ["COMPLETED", "CANCELLED"] },
      },
    }).catch(() => 0),
    db.invoiceRequest.count({
      where: { ...branchFilter, status: "DRAFT" },
    }).catch(() => 0),
    role !== "USER"
      ? db.revenueReport.aggregate({
          where: { ...branchFilter, targetMonth: { gte: thisMonthStart } },
          _sum: { amount: true },
        }).catch(() => ({ _sum: { amount: null } }))
      : Promise.resolve({ _sum: { amount: null } }),
  ]);
  const thisMonthRevenueAmount = Number(thisMonthRevenue._sum.amount ?? 0);

  // ── 0. アクティブ商談（CLOSED 以外・最新更新順・最大10件） ──
  const activeDeals = await db.deal.findMany({
    where: {
      ...branchFilter,
      status: { notIn: ["CLOSED_WON", "CLOSED_LOST"] },
    },
    include: {
      customer: { select: { id: true, name: true, prefecture: true } },
      assignedTo: { select: { name: true } },
    },
    orderBy: { updatedAt: "desc" },
    take: 10,
  }).catch(() => []);

  // ── 1. フォローアップ対象顧客（ランクA/B × 10日以上未接触） ──
  const staleCustomerCandidates = await db.customer.findMany({
    where: {
      rank: { in: ["A", "B"] },
      ...branchFilter,
    },
    include: {
      activityLogs: {
        where: { type: { not: "SYSTEM" } },
        orderBy: { createdAt: "desc" },
        take: 1,
      },
    },
    orderBy: { name: "asc" },
  }).catch(() => []);

  const followUpCustomers = staleCustomerCandidates
    .filter((c) => {
      if (c.activityLogs.length === 0) return true;
      return c.activityLogs[0].createdAt < tenDaysAgo;
    })
    .sort((a, b) => {
      const dateA = a.activityLogs[0]?.createdAt.getTime() ?? 0;
      const dateB = b.activityLogs[0]?.createdAt.getTime() ?? 0;
      return dateA - dateB; // 最も古いものを上に
    });

  // ── 2. 至急納期プロジェクト（7日以内・未完了） ──
  const urgentProjects = await db.project.findMany({
    where: {
      status: { notIn: ["COMPLETED", "CANCELLED"] },
      deadline: { gte: now, lte: sevenDaysOut },
      ...branchFilter,
    },
    include: {
      customer: { select: { id: true, name: true } },
    },
    orderBy: { deadline: "asc" },
  }).catch(() => []);

  // ── 3. 活動フィード（ActivityLog + ProjectLog を統合・最新15件） ──
  const actLogWhere = userBranchId
    ? { customer: { branchId: userBranchId } }
    : {};
  const projLogWhere = userBranchId
    ? { project: { branchId: userBranchId } }
    : {};

  const [actLogs, projLogs] = await Promise.all([
    db.activityLog.findMany({
      where: actLogWhere,
      orderBy: { createdAt: "desc" },
      take: 15,
      include: { customer: { select: { id: true, name: true } } },
    }).catch(() => []),
    db.projectLog.findMany({
      where: projLogWhere,
      orderBy: { createdAt: "desc" },
      take: 15,
      include: { project: { select: { id: true, title: true } } },
    }).catch(() => []),
  ]);

  type FeedItem =
    | { kind: "activity"; data: (typeof actLogs)[number]; createdAt: Date }
    | { kind: "project";  data: (typeof projLogs)[number]; createdAt: Date };

  const feed: FeedItem[] = [
    ...actLogs.map((d) => ({ kind: "activity" as const, data: d, createdAt: d.createdAt })),
    ...projLogs.map((d) => ({ kind: "project" as const, data: d, createdAt: d.createdAt })),
  ]
    .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
    .slice(0, 15);

  // ── 挨拶 ──
  const hour = now.getHours();
  const timeGreeting =
    hour < 12 ? "おはようございます" : hour < 18 ? "こんにちは" : "お疲れ様です";
  const firstName = name?.split(/[\s　]/)[0] ?? null;

  return (
    <div className="px-6 py-6 space-y-5 max-w-screen-2xl mx-auto w-full">

      {/* ── ヘッダー ── */}
      <div className="flex items-center justify-between">
        <div>
          <p className="text-lg font-bold text-zinc-900">
            {timeGreeting}、{firstName ?? "ようこそ"}
          </p>
          <p className="text-xs text-zinc-400 mt-0.5">
            {new Intl.DateTimeFormat("ja-JP", {
              year: "numeric", month: "long", day: "numeric", weekday: "long",
            }).format(now)}
          </p>
        </div>
        {role === "ADMIN" && (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-amber-100 text-amber-700 border border-amber-200">
            <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />
            本部 — 全拠点表示
          </span>
        )}
      </div>

      {/* ── KPI カード ── */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        {/* 期限超過プロジェクト */}
        <div className={`rounded-xl border px-4 py-3 ${overdueCount > 0 ? "bg-red-50 border-red-200" : "bg-white border-zinc-200"}`}>
          <p className={`text-[11px] font-semibold mb-1 ${overdueCount > 0 ? "text-red-500" : "text-zinc-500"}`}>
            🔴 期限超過 PJ
          </p>
          <p className={`text-2xl font-bold ${overdueCount > 0 ? "text-red-700" : "text-zinc-800"}`}>
            {overdueCount}<span className="text-sm font-normal ml-1">件</span>
          </p>
        </div>
        {/* 未提出請求依頼 */}
        <div className={`rounded-xl border px-4 py-3 ${draftBillingCount > 0 ? "bg-amber-50 border-amber-200" : "bg-white border-zinc-200"}`}>
          <p className={`text-[11px] font-semibold mb-1 ${draftBillingCount > 0 ? "text-amber-600" : "text-zinc-500"}`}>
            📋 未提出請求依頼
          </p>
          <p className={`text-2xl font-bold ${draftBillingCount > 0 ? "text-amber-700" : "text-zinc-800"}`}>
            {draftBillingCount}<span className="text-sm font-normal ml-1">件</span>
          </p>
        </div>
        {/* 今月売上（MANAGER 以上のみ） */}
        {role !== "USER" && (
          <div className="bg-white border border-zinc-200 rounded-xl px-4 py-3 col-span-2 sm:col-span-1">
            <p className="text-[11px] font-semibold text-zinc-500 mb-1">💰 今月売上（税抜）</p>
            <p className="text-2xl font-bold text-zinc-800 tabular-nums">
              ¥{thisMonthRevenueAmount.toLocaleString("ja-JP")}
            </p>
          </div>
        )}
      </div>

      {/* ── クイックアクション ── */}
      <div className="grid grid-cols-3 gap-3">
        <Link
          href="/dashboard/customers/new"
          className="group flex items-center gap-3 px-4 py-3 bg-white border border-zinc-200 rounded-xl hover:border-blue-300 hover:bg-blue-50 transition-all"
        >
          <div className="w-8 h-8 bg-blue-100 rounded-lg flex items-center justify-center flex-shrink-0 group-hover:bg-blue-200 transition-colors">
            <Users className="w-4 h-4 text-blue-600" />
          </div>
          <div className="min-w-0">
            <p className="text-xs font-semibold text-zinc-700 group-hover:text-blue-700">顧客を登録</p>
            <p className="text-[10px] text-zinc-400">新規顧客情報を入力</p>
          </div>
          <Plus className="w-3.5 h-3.5 text-zinc-300 group-hover:text-blue-400 ml-auto flex-shrink-0" />
        </Link>

        <Link
          href="/dashboard/projects/new"
          className="group flex items-center gap-3 px-4 py-3 bg-white border border-zinc-200 rounded-xl hover:border-violet-300 hover:bg-violet-50 transition-all"
        >
          <div className="w-8 h-8 bg-violet-100 rounded-lg flex items-center justify-center flex-shrink-0 group-hover:bg-violet-200 transition-colors">
            <FolderKanban className="w-4 h-4 text-violet-600" />
          </div>
          <div className="min-w-0">
            <p className="text-xs font-semibold text-zinc-700 group-hover:text-violet-700">プロジェクト登録</p>
            <p className="text-[10px] text-zinc-400">新規案件を作成</p>
          </div>
          <Plus className="w-3.5 h-3.5 text-zinc-300 group-hover:text-violet-400 ml-auto flex-shrink-0" />
        </Link>

        <Link
          href="/dashboard/customers"
          className="group flex items-center gap-3 px-4 py-3 bg-white border border-zinc-200 rounded-xl hover:border-emerald-300 hover:bg-emerald-50 transition-all"
        >
          <div className="w-8 h-8 bg-emerald-100 rounded-lg flex items-center justify-center flex-shrink-0 group-hover:bg-emerald-200 transition-colors">
            <PenLine className="w-4 h-4 text-emerald-600" />
          </div>
          <div className="min-w-0">
            <p className="text-xs font-semibold text-zinc-700 group-hover:text-emerald-700">活動を記録</p>
            <p className="text-[10px] text-zinc-400">顧客ページから入力</p>
          </div>
          <ArrowRight className="w-3.5 h-3.5 text-zinc-300 group-hover:text-emerald-400 ml-auto flex-shrink-0" />
        </Link>
      </div>

      {/* ── 商談管理 (SFA) ── */}
      <div className="bg-white rounded-xl border border-zinc-200">
        {/* ヘッダー */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-zinc-100">
          <div className="flex items-center gap-2">
            <span className="inline-flex items-center justify-center w-5 h-5 rounded bg-blue-100">
              <TrendingUp className="w-3 h-3 text-blue-600" />
            </span>
            <p className="text-xs font-bold text-zinc-800">商談管理 (SFA)</p>
            <span className="text-[10px] px-1.5 py-0.5 bg-zinc-100 text-zinc-500 rounded-full font-medium">
              アクティブ {activeDeals.length}件
            </span>
          </div>
          {/* ビュー切り替えボタン */}
          <div className="flex items-center gap-1">
            <Link
              href="/dashboard/deals"
              className="inline-flex items-center gap-1 px-2.5 py-1 text-[11px] font-medium
                         bg-zinc-100 text-zinc-600 hover:bg-blue-100 hover:text-blue-700
                         rounded-lg transition-colors"
            >
              <LayoutGrid className="w-3 h-3" />
              ボード
            </Link>
            <Link
              href="/dashboard/deals/list"
              className="inline-flex items-center gap-1 px-2.5 py-1 text-[11px] font-medium
                         bg-zinc-100 text-zinc-600 hover:bg-blue-100 hover:text-blue-700
                         rounded-lg transition-colors"
            >
              <List className="w-3 h-3" />
              リスト
            </Link>
          </div>
        </div>

        {/* 案件リスト */}
        {activeDeals.length === 0 ? (
          <div className="px-4 py-8 text-center">
            <p className="text-xs text-zinc-400">アクティブな商談はありません</p>
            <Link
              href="/dashboard/deals/new"
              className="mt-2 inline-flex items-center gap-1 text-xs text-blue-600 hover:underline"
            >
              <Plus className="w-3 h-3" /> 商談を作成する
            </Link>
          </div>
        ) : (
          <ul className="divide-y divide-zinc-50">
            {activeDeals.map((deal) => {
              const statusOpt = DEAL_STATUS_OPTIONS.find((o) => o.value === deal.status);
              const dotColor  = DEAL_STATUS_DOT[deal.status] ?? "bg-zinc-400";

              // 備考スニペット: Markdownの記号を除去して最初の1行をトリミング
              const notesSnippet = deal.notes
                ? deal.notes
                    .replace(/[#*`>_~[\]]/g, "")
                    .trim()
                    .split("\n")[0]
                    .slice(0, 64)
                : null;

              return (
                <li key={deal.id}>
                  <Link
                    href={`/dashboard/deals/${deal.id}`}
                    className="flex items-center gap-3 px-4 py-2.5 hover:bg-zinc-50 transition-colors group"
                  >
                    {/* ステータスドット */}
                    <span className={`flex-shrink-0 w-2 h-2 rounded-full ${dotColor}`} />

                    {/* 主情報 */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        {/* 会社名（最優先） */}
                        <p className="text-xs font-semibold text-zinc-800 group-hover:text-blue-600 transition-colors truncate">
                          {deal.customer.name}
                        </p>
                        {/* 都道府県 */}
                        {deal.customer.prefecture && (
                          <span className="text-[10px] text-zinc-400 whitespace-nowrap">
                            📍{deal.customer.prefecture}
                          </span>
                        )}
                        {/* 担当者 */}
                        {deal.assignedTo?.name && (
                          <span className="inline-flex items-center gap-0.5 text-[10px] text-zinc-400 whitespace-nowrap">
                            <User className="w-2.5 h-2.5" />
                            {deal.assignedTo.name}
                          </span>
                        )}
                      </div>
                      {/* 備考プレビュー */}
                      {notesSnippet && (
                        <p className="text-[11px] text-zinc-400 mt-0.5 truncate">
                          <span className="text-zinc-300 mr-1">···</span>
                          {notesSnippet}
                          {(deal.notes?.length ?? 0) > 64 && "…"}
                        </p>
                      )}
                    </div>

                    {/* ステータスタグ（右端） */}
                    {statusOpt && (
                      <span
                        className={`flex-shrink-0 text-[10px] px-1.5 py-0.5 rounded-full border font-semibold ${statusOpt.color}`}
                      >
                        {statusOpt.label}
                      </span>
                    )}
                  </Link>
                </li>
              );
            })}
          </ul>
        )}

        {/* フッター */}
        <div className="px-4 py-2 border-t border-zinc-100 flex items-center justify-between">
          <Link
            href="/dashboard/deals/list"
            className="text-[11px] text-zinc-400 hover:text-blue-600 transition-colors"
          >
            すべての商談を確認 →
          </Link>
          <Link
            href="/dashboard/deals/new"
            className="text-[11px] text-blue-600 hover:underline"
          >
            + 新規商談
          </Link>
        </div>
      </div>

      {/* ── 2カラム: フォローアップ × 納期確認 ── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">

        {/* フォローアップ */}
        <div className="bg-white rounded-xl border border-zinc-200">
          <div className="flex items-center justify-between px-4 py-3 border-b border-zinc-100">
            <div className="flex items-center gap-2">
              <span className="inline-flex items-center justify-center w-5 h-5 rounded bg-amber-100">
                <AlertTriangle className="w-3 h-3 text-amber-600" />
              </span>
              <p className="text-xs font-bold text-zinc-800">要注意 — フォローアップ</p>
              <span className="text-[10px] px-1.5 py-0.5 bg-amber-100 text-amber-700 rounded-full font-semibold">
                ランクA/B × 10日以上未接触
              </span>
            </div>
            {followUpCustomers.length > 0 && (
              <span className="text-xs font-bold text-amber-600 tabular-nums">
                {followUpCustomers.length}件
              </span>
            )}
          </div>

          {followUpCustomers.length === 0 ? (
            <div className="px-4 py-8 text-center">
              <p className="text-2xl mb-2">✅</p>
              <p className="text-xs text-zinc-400">フォローアップが必要な顧客はいません</p>
            </div>
          ) : (
            <ul className="divide-y divide-zinc-50">
              {followUpCustomers.map((c) => {
                const lastLog = c.activityLogs[0] ?? null;
                const daysSince = lastLog
                  ? daysBetween(lastLog.createdAt, now)
                  : null;

                return (
                  <li key={c.id}>
                    <Link
                      href={`/dashboard/customers/${c.id}`}
                      className="flex items-center gap-3 px-4 py-2.5 hover:bg-zinc-50 transition-colors group"
                    >
                      <RankBadge rank={c.rank} />
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-semibold text-zinc-800 truncate group-hover:text-blue-600 transition-colors">
                          {c.name}
                        </p>
                        {lastLog ? (
                          <p className="text-[11px] text-zinc-400 mt-0.5">
                            最後に:{" "}
                            <span className="text-zinc-600">{formatDate(lastLog.createdAt)}</span>
                            {lastLog.staffName && (
                              <span className="text-zinc-400">（{lastLog.staffName}）</span>
                            )}
                          </p>
                        ) : (
                          <p className="text-[11px] text-zinc-400 mt-0.5">記録なし</p>
                        )}
                      </div>
                      {daysSince !== null ? (
                        <span
                          className={`flex-shrink-0 text-[11px] font-bold px-2 py-0.5 rounded-full ${
                            daysSince >= 30
                              ? "bg-red-100 text-red-600"
                              : daysSince >= 14
                              ? "bg-amber-100 text-amber-700"
                              : "bg-yellow-100 text-yellow-700"
                          }`}
                        >
                          {daysSince}日前
                        </span>
                      ) : (
                        <span className="flex-shrink-0 text-[11px] font-bold px-2 py-0.5 rounded-full bg-red-100 text-red-600">
                          未接触
                        </span>
                      )}
                    </Link>
                  </li>
                );
              })}
            </ul>
          )}

          <div className="px-4 py-2 border-t border-zinc-100">
            <Link
              href="/dashboard/customers"
              className="text-[11px] text-zinc-400 hover:text-blue-600 transition-colors"
            >
              顧客一覧を見る →
            </Link>
          </div>
        </div>

        {/* 納期確認 */}
        <div className="bg-white rounded-xl border border-zinc-200">
          <div className="flex items-center justify-between px-4 py-3 border-b border-zinc-100">
            <div className="flex items-center gap-2">
              <span className="inline-flex items-center justify-center w-5 h-5 rounded bg-red-100">
                <Clock className="w-3 h-3 text-red-600" />
              </span>
              <p className="text-xs font-bold text-zinc-800">至急 — 納期確認</p>
              <span className="text-[10px] px-1.5 py-0.5 bg-red-100 text-red-600 rounded-full font-semibold">
                7日以内・未完了
              </span>
            </div>
            {urgentProjects.length > 0 && (
              <span className="text-xs font-bold text-red-600 tabular-nums">
                {urgentProjects.length}件
              </span>
            )}
          </div>

          {urgentProjects.length === 0 ? (
            <div className="px-4 py-8 text-center">
              <p className="text-2xl mb-2">✅</p>
              <p className="text-xs text-zinc-400">7日以内に納期を迎えるプロジェクトはありません</p>
            </div>
          ) : (
            <ul className="divide-y divide-zinc-50">
              {urgentProjects.map((p) => {
                const statusOpt = PROJECT_STATUS_OPTIONS.find((o) => o.value === p.status);
                const remaining = p.deadline ? daysUntil(new Date(p.deadline)) : null;

                return (
                  <li key={p.id}>
                    <Link
                      href={`/dashboard/projects/${p.id}`}
                      className="flex items-center gap-3 px-4 py-2.5 hover:bg-zinc-50 transition-colors group"
                    >
                      {statusOpt && (
                        <span className={`flex-shrink-0 text-[10px] px-1.5 py-0.5 rounded-full border font-semibold ${statusOpt.className}`}>
                          {statusOpt.icon}
                        </span>
                      )}
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-semibold text-zinc-800 truncate group-hover:text-blue-600 transition-colors">
                          {p.title}
                        </p>
                        <div className="flex items-center gap-2 mt-0.5">
                          <p className="text-[11px] text-zinc-400">
                            納期:{" "}
                            <span className="text-zinc-600 font-medium">
                              {p.deadline ? formatDate(new Date(p.deadline)) : "—"}
                            </span>
                          </p>
                          {p.customer && (
                            <span className="text-[10px] text-zinc-400">· {p.customer.name}</span>
                          )}
                        </div>
                      </div>
                      {remaining !== null && (
                        <span
                          className={`flex-shrink-0 text-[11px] font-bold px-2 py-0.5 rounded-full ${
                            remaining <= 1
                              ? "bg-red-100 text-red-600"
                              : remaining <= 3
                              ? "bg-orange-100 text-orange-700"
                              : "bg-amber-100 text-amber-700"
                          }`}
                        >
                          {remaining <= 0 ? "本日" : `あと${remaining}日`}
                        </span>
                      )}
                    </Link>
                  </li>
                );
              })}
            </ul>
          )}

          <div className="px-4 py-2 border-t border-zinc-100">
            <Link
              href="/dashboard/projects"
              className="text-[11px] text-zinc-400 hover:text-blue-600 transition-colors"
            >
              プロジェクト一覧を見る →
            </Link>
          </div>
        </div>
      </div>

      {/* ── 活動フィード ── */}
      <div className="bg-white rounded-xl border border-zinc-200">
        <div className="flex items-center justify-between px-4 py-3 border-b border-zinc-100">
          <p className="text-xs font-bold text-zinc-800">会社全体の動き</p>
          <p className="text-[10px] text-zinc-400">最新{feed.length}件</p>
        </div>

        {feed.length === 0 ? (
          <div className="px-4 py-10 text-center">
            <p className="text-xs text-zinc-400">活動の記録がまだありません</p>
          </div>
        ) : (
          <ul className="divide-y divide-zinc-50">
            {feed.map((item, idx) => {
              if (item.kind === "activity") {
                const log = item.data;
                const cfg = ACTIVITY_ICON[log.type as ActivityType];
                const typeOpt = ACTIVITY_TYPE_OPTIONS.find((o) => o.value === log.type);
                return (
                  <li key={`act-${log.id}`}>
                    <Link
                      href={`/dashboard/customers/${log.customer.id}`}
                      className="flex items-start gap-3 px-4 py-2.5 hover:bg-zinc-50 transition-colors group"
                    >
                      {/* アイコン */}
                      <span
                        className={`mt-0.5 flex-shrink-0 w-6 h-6 rounded-full flex items-center justify-center text-[11px] ${cfg.bg}`}
                      >
                        {cfg.icon}
                      </span>

                      {/* 内容 */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span className="text-xs font-semibold text-zinc-600">
                            {log.staffName}
                          </span>
                          <span className={`text-[10px] px-1.5 py-0.5 rounded ${cfg.bg} ${cfg.text} font-medium`}>
                            {typeOpt?.label ?? log.type}
                          </span>
                          <span className="text-[11px] text-zinc-400">—</span>
                          <span className="text-xs font-medium text-blue-600 group-hover:underline truncate">
                            {log.customer.name}
                          </span>
                        </div>
                        <p className="text-[11px] text-zinc-500 mt-0.5 truncate leading-relaxed">
                          {log.content}
                        </p>
                      </div>

                      {/* 日時 */}
                      <span className="flex-shrink-0 text-[10px] text-zinc-400 mt-0.5 whitespace-nowrap">
                        {formatDateTime(log.createdAt)}
                      </span>
                    </Link>
                  </li>
                );
              } else {
                const log = item.data;
                const cfg = PROJECT_LOG_ICON[log.type as ProjectLogType];
                return (
                  <li key={`proj-${log.id}`}>
                    <Link
                      href={`/dashboard/projects/${log.project.id}`}
                      className="flex items-start gap-3 px-4 py-2.5 hover:bg-zinc-50 transition-colors group"
                    >
                      {/* アイコン */}
                      <span
                        className={`mt-0.5 flex-shrink-0 w-6 h-6 rounded-full flex items-center justify-center text-[11px] ${cfg.bg}`}
                      >
                        {cfg.icon}
                      </span>

                      {/* 内容 */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span className="text-xs font-semibold text-zinc-600">
                            {log.staffName}
                          </span>
                          <span className={`text-[10px] px-1.5 py-0.5 rounded ${cfg.bg} ${cfg.text} font-medium`}>
                            {cfg.label}
                          </span>
                          <span className="text-[11px] text-zinc-400">—</span>
                          <span className="text-xs font-medium text-violet-600 group-hover:underline truncate">
                            {log.project.title}
                          </span>
                        </div>
                        <p className="text-[11px] text-zinc-500 mt-0.5 truncate leading-relaxed">
                          {log.content}
                        </p>
                      </div>

                      {/* 日時 */}
                      <span className="flex-shrink-0 text-[10px] text-zinc-400 mt-0.5 whitespace-nowrap">
                        {formatDateTime(log.createdAt)}
                      </span>
                    </Link>
                  </li>
                );
              }
            })}
          </ul>
        )}
      </div>
    </div>
  );
}
