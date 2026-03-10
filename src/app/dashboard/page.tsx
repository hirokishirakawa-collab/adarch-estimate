import { Fragment } from "react";
import { auth } from "@/lib/auth";
import Link from "next/link";
import { db } from "@/lib/db";
import { getMockBranchId } from "@/lib/data/customers";
import { ACTIVITY_TYPE_OPTIONS } from "@/lib/constants/crm";
import { PROJECT_STATUS_OPTIONS } from "@/lib/constants/projects";
import { getOrGenerateDigest } from "@/lib/digest";
import type { UserRole } from "@/types/roles";
import type { ActivityType, ProjectLogType } from "@/generated/prisma/client";
import {
  Users,
  FolderKanban,
  PenLine,
  Clock,
  ArrowRight,
  TrendingUp,
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
              <div className="flex items-center justify-between mb-1">
                <p className="text-[11px] font-semibold text-indigo-600">グループダイジェスト — 直近3日間（AI分析）</p>
                <p className="text-[10px] text-indigo-400">
                  {new Intl.DateTimeFormat("ja-JP", {
                    month: "numeric", day: "numeric", hour: "2-digit", minute: "2-digit",
                    timeZone: "Asia/Tokyo",
                  }).format(digest.updatedAt)}
                  {" 更新"}
                </p>
              </div>
              <p className="text-xs text-zinc-700 leading-relaxed whitespace-pre-line">{digest.content}</p>
            </div>
          </div>
        </div>
      )}

      {/* ── ご利用ガイド ── */}
      <div className="rounded-xl border border-emerald-200 bg-gradient-to-r from-emerald-50 to-teal-50 px-5 py-4">
        <p className="text-[11px] font-semibold text-emerald-700 mb-2.5">ご利用の流れ</p>
        <div className="flex items-center gap-2 flex-wrap">
          <span className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-white rounded-lg border border-emerald-200 text-xs font-medium text-zinc-700">
            <span className="w-5 h-5 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center text-[10px] font-bold">1</span>
            顧客管理に登録
          </span>
          <ArrowRight className="w-3.5 h-3.5 text-emerald-400 flex-shrink-0" />
          <span className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-white rounded-lg border border-emerald-200 text-xs font-medium text-zinc-700">
            <span className="w-5 h-5 rounded-full bg-violet-100 text-violet-600 flex items-center justify-center text-[10px] font-bold">2</span>
            商談管理
          </span>
          <ArrowRight className="w-3.5 h-3.5 text-emerald-400 flex-shrink-0" />
          <span className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-white rounded-lg border border-emerald-200 text-xs font-medium text-zinc-700">
            <span className="w-5 h-5 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center text-[10px] font-bold">3</span>
            プロジェクト一覧からプロジェクト追加
          </span>
        </div>
        <p className="text-[10px] text-zinc-500 mt-2">
          同じ顧客で新しい仕事が始まった場合は、商談管理 または プロジェクト一覧から新規追加してください
        </p>
      </div>

      {/* ── クイックアクション（ご利用の流れに沿った4つ） ── */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <Link
          href="/dashboard/customers/new"
          className="group flex flex-col items-center gap-2 px-4 py-4 bg-white border border-zinc-200 rounded-xl hover:border-blue-300 hover:bg-blue-50 transition-all text-center"
        >
          <div className="w-10 h-10 bg-blue-100 rounded-xl flex items-center justify-center group-hover:bg-blue-200 transition-colors">
            <Users className="w-5 h-5 text-blue-600" />
          </div>
          <div>
            <p className="text-xs font-semibold text-zinc-700 group-hover:text-blue-700">顧客を登録</p>
            <p className="text-[10px] text-zinc-400 mt-0.5">STEP 1</p>
          </div>
        </Link>

        <Link
          href="/dashboard/deals"
          className="group flex flex-col items-center gap-2 px-4 py-4 bg-white border border-zinc-200 rounded-xl hover:border-violet-300 hover:bg-violet-50 transition-all text-center"
        >
          <div className="w-10 h-10 bg-violet-100 rounded-xl flex items-center justify-center group-hover:bg-violet-200 transition-colors">
            <TrendingUp className="w-5 h-5 text-violet-600" />
          </div>
          <div>
            <p className="text-xs font-semibold text-zinc-700 group-hover:text-violet-700">商談管理</p>
            <p className="text-[10px] text-zinc-400 mt-0.5">STEP 2</p>
          </div>
        </Link>

        <Link
          href="/dashboard/projects"
          className="group flex flex-col items-center gap-2 px-4 py-4 bg-white border border-zinc-200 rounded-xl hover:border-emerald-300 hover:bg-emerald-50 transition-all text-center"
        >
          <div className="w-10 h-10 bg-emerald-100 rounded-xl flex items-center justify-center group-hover:bg-emerald-200 transition-colors">
            <FolderKanban className="w-5 h-5 text-emerald-600" />
          </div>
          <div>
            <p className="text-xs font-semibold text-zinc-700 group-hover:text-emerald-700">プロジェクト</p>
            <p className="text-[10px] text-zinc-400 mt-0.5">STEP 3</p>
          </div>
        </Link>

        <Link
          href="/dashboard/customers"
          className="group flex flex-col items-center gap-2 px-4 py-4 bg-white border border-zinc-200 rounded-xl hover:border-amber-300 hover:bg-amber-50 transition-all text-center"
        >
          <div className="w-10 h-10 bg-amber-100 rounded-xl flex items-center justify-center group-hover:bg-amber-200 transition-colors">
            <PenLine className="w-5 h-5 text-amber-600" />
          </div>
          <div>
            <p className="text-xs font-semibold text-zinc-700 group-hover:text-amber-700">活動を記録</p>
            <p className="text-[10px] text-zinc-400 mt-0.5">顧客ページから</p>
          </div>
        </Link>
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
