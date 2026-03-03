import { Fragment } from "react";
import { auth } from "@/lib/auth";
import Link from "next/link";
import { db } from "@/lib/db";
import { getMockBranchId } from "@/lib/data/customers";
import { ACTIVITY_TYPE_OPTIONS } from "@/lib/constants/crm";
import { PROJECT_STATUS_OPTIONS } from "@/lib/constants/projects";
import { DEAL_STATUS_OPTIONS } from "@/lib/constants/deals";
import { getOrGenerateDigest } from "@/lib/digest";
import type { UserRole } from "@/types/roles";
import type { ActivityType, ProjectLogType } from "@/generated/prisma/client";
import {
  Plus,
  Users,
  FolderKanban,
  PenLine,
  Clock,
  ArrowRight,
  TrendingUp,
  LayoutGrid,
  List,
  User,
  Award,
  CalendarCheck,
  Sparkles,
} from "lucide-react";

// ----------------------------------------------------------------
// ユーティリティ
// ----------------------------------------------------------------
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
// ページ本体
// ----------------------------------------------------------------
export default async function DashboardPage() {
  const session = await auth();
  const role = (session?.user?.role ?? "USER") as UserRole;
  const name = session?.user?.name ?? null;
  const email = session?.user?.email ?? "";
  const userBranchId = getMockBranchId(email, role);

  const now = new Date();
  const sevenDaysOut = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);

  // 拠点フィルタ
  const branchFilter = userBranchId ? { branchId: userBranchId } : {};

  // ── 0. アクティブ商談 & KPI用クローズ商談（並列取得） ──
  const [activeDeals, closedDeals] = await Promise.all([
    db.deal.findMany({
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
    }).catch(() => []),
    db.deal.findMany({
      where: { ...branchFilter, status: { in: ["CLOSED_WON", "CLOSED_LOST"] } },
      select: { status: true, updatedAt: true },
    }).catch(() => []),
  ]);

  // KPI 計算
  const thisMonthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const wonTotal = closedDeals.filter((d) => d.status === "CLOSED_WON").length;
  const lostTotal = closedDeals.filter((d) => d.status === "CLOSED_LOST").length;
  const winRate =
    wonTotal + lostTotal > 0 ? Math.round((wonTotal / (wonTotal + lostTotal)) * 100) : null;
  const thisMonthWon = closedDeals.filter(
    (d) => d.status === "CLOSED_WON" && new Date(d.updatedAt) >= thisMonthStart
  ).length;

  // ステージ分布（アクティブ商談のみ）
  const stageCounts = [
    { label: "初期声掛け", count: activeDeals.filter((d) => d.status === "PROSPECTING").length, color: "bg-zinc-200 text-zinc-600" },
    { label: "初回商談",   count: activeDeals.filter((d) => d.status === "QUALIFYING").length,  color: "bg-blue-100 text-blue-700" },
    { label: "提案中",     count: activeDeals.filter((d) => d.status === "PROPOSAL").length,    color: "bg-violet-100 text-violet-700" },
    { label: "休眠/先送り", count: activeDeals.filter((d) => d.status === "NEGOTIATION").length, color: "bg-amber-100 text-amber-700" },
  ].filter((s) => s.count > 0);

  // ── 1. 至急納期プロジェクト（7日以内・未完了） ──
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

  // ── 至急納期確認 — 顧客ごとにグループ化 ──
  type UrgentProject = (typeof urgentProjects)[number];
  type UrgentGroup = { customerId: string | null; customerName: string | null; projects: UrgentProject[] };
  const urgentGroupMap = new Map<string, UrgentGroup>();
  for (const p of urgentProjects) {
    const key = p.customer?.id ?? "__none__";
    if (!urgentGroupMap.has(key)) {
      urgentGroupMap.set(key, { customerId: p.customer?.id ?? null, customerName: p.customer?.name ?? null, projects: [] });
    }
    urgentGroupMap.get(key)!.projects.push(p);
  }
  const urgentGroups = Array.from(urgentGroupMap.values());

  // ── ダイジェスト ──
  const digest = await getOrGenerateDigest();

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

      {/* ── グループダイジェスト ── */}
      {digest && (
        <div className="relative overflow-hidden rounded-xl border border-blue-200 bg-gradient-to-br from-blue-50 via-indigo-50 to-violet-50 px-5 py-4">
          <div className="flex items-start gap-3">
            <span className="mt-0.5 flex-shrink-0 w-7 h-7 bg-white/70 rounded-lg flex items-center justify-center">
              <Sparkles className="w-4 h-4 text-indigo-500" />
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-[11px] font-semibold text-indigo-600 mb-1">グループダイジェスト — 直近3日間</p>
              <p className="text-xs text-zinc-700 leading-relaxed whitespace-pre-line">{digest}</p>
            </div>
          </div>
        </div>
      )}

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

        {/* ── KPI バー ── */}
        <div className="grid grid-cols-3 divide-x divide-zinc-100 border-b border-zinc-100">
          {/* 受注率 */}
          <div className="px-4 py-3 flex items-center gap-2.5">
            <span className="flex-shrink-0 w-7 h-7 bg-emerald-100 rounded-lg flex items-center justify-center">
              <Award className="w-3.5 h-3.5 text-emerald-600" />
            </span>
            <div>
              <p className="text-[10px] text-zinc-400">受注率（累計）</p>
              <p className="text-sm font-bold text-zinc-800">
                {winRate !== null ? `${winRate}%` : "—"}
              </p>
            </div>
          </div>

          {/* 今月受注 */}
          <div className="px-4 py-3 flex items-center gap-2.5">
            <span className="flex-shrink-0 w-7 h-7 bg-blue-100 rounded-lg flex items-center justify-center">
              <CalendarCheck className="w-3.5 h-3.5 text-blue-600" />
            </span>
            <div>
              <p className="text-[10px] text-zinc-400">今月の受注</p>
              <p className="text-sm font-bold text-zinc-800">
                {thisMonthWon}
                <span className="text-xs font-normal text-zinc-400 ml-0.5">件</span>
              </p>
            </div>
          </div>

          {/* ステージ分布 */}
          <div className="px-4 py-3">
            <p className="text-[10px] text-zinc-400 mb-1.5">ステージ分布</p>
            <div className="flex items-center gap-1 flex-wrap">
              {stageCounts.length > 0 ? stageCounts.map((s) => (
                <span
                  key={s.label}
                  className={`text-[10px] px-1.5 py-0.5 rounded-full font-semibold ${s.color}`}
                >
                  {s.label} {s.count}
                </span>
              )) : (
                <span className="text-[10px] text-zinc-300">なし</span>
              )}
            </div>
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

      {/* ── 至急納期確認 ── */}
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
            <ul className="divide-y divide-zinc-100">
              {urgentGroups.map((group) => (
                <Fragment key={group.customerId ?? "__none__"}>
                  {/* 顧客ヘッダー */}
                  <li className="px-4 py-1.5 bg-zinc-50 border-b border-zinc-100">
                    <p className="text-[10px] font-semibold text-zinc-500 tracking-wide">
                      {group.customerName ?? "顧客未設定"}
                      {group.projects.length > 1 && (
                        <span className="ml-1.5 text-zinc-400 font-normal">
                          {group.projects.length}件
                        </span>
                      )}
                    </p>
                  </li>
                  {/* プロジェクト行 */}
                  {group.projects.map((p) => {
                    const statusOpt = PROJECT_STATUS_OPTIONS.find((o) => o.value === p.status);
                    const remaining = p.deadline ? daysUntil(new Date(p.deadline)) : null;
                    return (
                      <li key={p.id}>
                        <Link
                          href={`/dashboard/projects/${p.id}`}
                          className="flex items-center gap-3 pl-6 pr-4 py-2.5 hover:bg-zinc-50 transition-colors group"
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
                            <p className="text-[11px] text-zinc-400 mt-0.5">
                              納期:{" "}
                              <span className="text-zinc-600 font-medium">
                                {p.deadline ? formatDate(new Date(p.deadline)) : "—"}
                              </span>
                            </p>
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
                </Fragment>
              ))}
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
