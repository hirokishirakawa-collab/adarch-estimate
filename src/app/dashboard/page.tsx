import { auth } from "@/lib/auth";
import Link from "next/link";
import { getOrGenerateDigest } from "@/lib/digest";
import { db } from "@/lib/db";
import { hasMinRole, type UserRole } from "@/types/roles";
import { ForcedInactiveModal } from "@/components/partner-status/forced-inactive-modal";
import { ActivityKpiBar } from "@/components/dashboard/activity-kpi-bar";
import { getActivityKpi } from "@/lib/kpis/activity";
import { MySalesPanel } from "@/components/dashboard/my-sales-panel";
import { AnniversaryCard } from "@/components/dashboard/anniversary-card";
import { GroupThreadCard } from "@/components/dashboard/group-thread-card";
import { SalesBoost } from "@/components/dashboard/sales-boost";
import { getMyGroupThread } from "@/lib/actions/group-support";
import { LiveBoard } from "@/components/live/live-board";
import { DashboardChatCard } from "@/components/office/dashboard-chat-card";
import {
  Users,
  FolderKanban,
  PenLine,
  ArrowRight,
  TrendingUp,
  Sparkles,
  Search,
  Activity,
  Zap,
  ExternalLink,
  FileText,
  Crosshair,
  Tv2,
  CreditCard,
  BookOpen,
  ContactRound,
  Handshake,
  Megaphone,
  CalendarCheck,
  Target,
  Film,
  BarChart2,
  HardDrive,
  FolderOpen,
  Upload,
  Download,
  ListChecks,
 MessageCircle } from "lucide-react";

// ----------------------------------------------------------------
// ページ本体
// ----------------------------------------------------------------
export default async function DashboardPage() {
  const session = await auth();
  const role = (session?.user?.role ?? "USER") as UserRole;
  const name = session?.user?.name ?? null;

  const now = new Date();

  // ── ダイジェスト ──
  const digest = await getOrGenerateDigest();

  // ── 営業インサイト サマリー ──
  const [insightTotals, recentInsights] = await Promise.all([
    db.salesInsight.aggregate({
      _sum: { totalSent: true, totalReplied: true },
      _count: true,
    }),
    db.salesInsight.findMany({
      orderBy: { createdAt: "desc" },
      take: 3,
      include: {
        groupCompany: { select: { name: true, emoji: true } },
      },
    }),
  ]);

  const insightSummary = {
    totalReports: insightTotals._count,
    totalSent: insightTotals._sum.totalSent ?? 0,
    totalReplied: insightTotals._sum.totalReplied ?? 0,
    replyRate:
      insightTotals._sum.totalSent && insightTotals._sum.totalSent > 0
        ? Math.round(
            ((insightTotals._sum.totalReplied ?? 0) /
              insightTotals._sum.totalSent) *
              100
          )
        : 0,
  };

  // 直近のhotな業種を抽出
  type InsightJson = { industry: string; temperature: string; replied: number };
  const hotIndustries: string[] = [];
  for (const r of recentInsights) {
    const items = (r.insights as InsightJson[]) ?? [];
    for (const item of items) {
      if (item.temperature === "hot" && !hotIndustries.includes(item.industry)) {
        hotIndustries.push(item.industry);
      }
    }
    if (hotIndustries.length >= 3) break;
  }

  // ── 実績フォルダ更新 ──
  const recentPortfolio = await db.portfolioItem.findMany({
    where: { itemType: "file" },
    orderBy: { lastUpdated: "desc" },
    take: 5,
    select: { name: true, parentName: true, lastUpdated: true, driveUrl: true, path: true },
  });

  // ── パートナー稼働ステータスサマリー（ADMIN向け） ──
  let adminStatusCounts: { active: number; inactive: number; notSelected: number; total: number } | null = null;
  if (role === "ADMIN") {
    const year = now.getFullYear();
    const month = now.getMonth() + 1;
    const [activeCount, inactiveCount, notSelectedCount, totalCount] = await Promise.all([
      db.partnerStatus.count({ where: { year, month, status: "ACTIVE" } }),
      db.partnerStatus.count({ where: { year, month, status: { in: ["INACTIVE", "FORCED_INACTIVE"] } } }),
      db.partnerStatus.count({ where: { year, month, status: "NOT_SELECTED" } }),
      db.groupCompany.count({ where: { isActive: true } }),
    ]);
    adminStatusCounts = { active: activeCount, inactive: inactiveCount, notSelected: notSelectedCount, total: totalCount };
  }

  // ── パートナー稼働ステータスチェック（ADMIN以外） ──
  let partnerStatus: { status: string; selectedAt: string | null; note: string | null } | null = null;
  let partnerCompanyName = "";
  if (role !== "ADMIN") {
    try {
      const psUser = await db.user.findUnique({
        where: { email: session?.user?.email ?? "" },
        select: { groupCompanyId: true, groupCompany: { select: { name: true } } },
      });
      if (psUser?.groupCompanyId) {
        partnerCompanyName = psUser.groupCompany?.name ?? "";
        const year = now.getFullYear();
        const month = now.getMonth() + 1;
        const ps = await db.partnerStatus.findUnique({
          where: { groupCompanyId_year_month: { groupCompanyId: psUser.groupCompanyId, year, month } },
          select: { status: true, selectedAt: true, note: true },
        });
        partnerStatus = ps ? { status: ps.status, selectedAt: ps.selectedAt?.toISOString() ?? null, note: ps.note } : { status: "NOT_SELECTED", selectedAt: null, note: null };
      }
    } catch (e) {
      console.error("[dashboard] Partner status check failed:", e instanceof Error ? e.message : e);
    }
  }

  // ── 月次報告チェック（ADMIN以外） ──
  let reportWarning: string | null = null;
  let reportUrgent = false;
  if (role !== "ADMIN") {
    const user = await db.user.findUnique({
      where: { email: session?.user?.email ?? "" },
      select: { id: true },
    });
    if (user) {
      const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
      const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 1);
      const report = await db.revenueReport.findFirst({
        where: { createdById: user.id, targetMonth: { gte: monthStart, lt: monthEnd } },
      });
      if (!report) {
        const day = now.getDate();
        if (day >= 28) {
          reportWarning = `${now.getMonth() + 1}月の月次報告が未提出です。月次未報告の場合、翌月1日にOSアクセスが停止されます。`;
          reportUrgent = true;
        } else if (day >= 25) {
          reportWarning = `${now.getMonth() + 1}月の月次報告が未提出です。月末までに提出してください。`;
        }
      }
    }
  }

  // ── 本部とのやり取り（ADMIN以外・加盟企業に紐づくユーザーのみ） ──
  let groupThread: Awaited<ReturnType<typeof getMyGroupThread>> = null;
  if (role !== "ADMIN") {
    try {
      groupThread = await getMyGroupThread();
    } catch (e) {
      console.error("[dashboard] Group thread fetch failed:", e instanceof Error ? e.message : e);
    }
  }

  // ── 挨拶 ──
  const hour = now.getHours();
  const timeGreeting =
    hour < 12 ? "おはようございます" : hour < 18 ? "こんにちは" : "お疲れ様です";
  const firstName = name?.split(/[\s　]/)[0] ?? null;

  // 今月の活動KPI（声かけ→商談→受注）
  const activityKpi = await getActivityKpi();

  return (
    <>
      {/* FORCED_INACTIVE モーダル */}
      {partnerStatus && partnerStatus.status === "FORCED_INACTIVE" && (
        <ForcedInactiveModal
          companyName={partnerCompanyName}
          year={now.getFullYear()}
          month={now.getMonth() + 1}
        />
      )}
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

      {/* ── みんなのチャット（一番上・投稿0件でも常に出す。本部は投稿を消せる） ── */}
      {session?.user?.email !== "demo@adarch.co.jp" && session?.user?.isActive !== false && (
        <DashboardChatCard />
      )}

      <ActivityKpiBar kpi={activityKpi} />

      {/* ── グループライブ（コンパクト版・全画面は /dashboard/live） ── */}
      {session?.user?.email !== "demo@adarch.co.jp" && session?.user?.isActive !== false && (
        <LiveBoard compact />
      )}

      {/* ── LINE公式アカウント（MANAGER以上） ── */}
      {role !== "USER" && (
        <Link
          href="/dashboard/line"
          className="flex items-center gap-4 rounded-xl border border-emerald-200 bg-white px-5 py-3.5 transition group hover:border-emerald-300 hover:shadow-sm"
        >
          <div className="w-9 h-9 rounded-xl bg-emerald-50 flex items-center justify-center flex-shrink-0">
            <MessageCircle className="w-[18px] h-[18px] text-emerald-700" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-bold text-zinc-800">LINE公式アカウント</p>
            <p className="text-xs text-zinc-500 mt-0.5">友だち・チャット・ステップ配信・一斉配信・セミナー枠（QR）</p>
          </div>
          <span className="text-xs text-emerald-700 font-medium">開く →</span>
        </Link>
      )}

      {/* ── あなたの営業数値（本人のみ・営業フローへ誘導） ── */}
      <MySalesPanel showLink />

      {/* ── 今年これから周年を迎える会社（担当エリア優先） ── */}
      <AnniversaryCard userEmail={session?.user?.email} />

      {/* ── パートナー稼働ステータス（ADMIN） ── */}
      {role === "ADMIN" && adminStatusCounts && (
        <Link
          href="/dashboard/admin/partner-status"
          className="flex items-center gap-4 rounded-xl border border-zinc-200 bg-white px-5 py-3.5 transition group hover:border-zinc-300 hover:shadow-sm"
        >
          <div className="w-9 h-9 rounded-xl bg-zinc-100 flex items-center justify-center flex-shrink-0">
            <Activity className="w-[18px] h-[18px] text-zinc-600" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-bold text-zinc-800">パートナー稼働ステータス</p>
            <div className="flex items-center gap-3 mt-1">
              <span className="inline-flex items-center gap-1 text-xs">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                <span className="text-zinc-600">稼働 <span className="font-semibold text-emerald-700">{adminStatusCounts.active}</span></span>
              </span>
              <span className="inline-flex items-center gap-1 text-xs">
                <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />
                <span className="text-zinc-600">休止 <span className="font-semibold text-amber-700">{adminStatusCounts.inactive}</span></span>
              </span>
              <span className="inline-flex items-center gap-1 text-xs">
                <span className="w-1.5 h-1.5 rounded-full bg-red-500" />
                <span className="text-zinc-600">未選択 <span className="font-semibold text-red-700">{adminStatusCounts.notSelected}</span></span>
              </span>
              <span className="text-[11px] text-zinc-400">/ 全{adminStatusCounts.total}社</span>
            </div>
          </div>
          <ArrowRight className="w-4 h-4 text-zinc-300 group-hover:text-zinc-500 group-hover:translate-x-0.5 transition-all flex-shrink-0" />
        </Link>
      )}

      {/* ── 加盟リード獲得（ADMIN専用） ── */}
      {role === "ADMIN" && (
        <Link
          href="/dashboard/franchise-leads"
          className="flex items-center gap-4 rounded-xl border border-red-200 bg-gradient-to-r from-red-50 via-rose-50 to-pink-50 px-5 py-3.5 transition group hover:border-red-300 hover:shadow-sm"
        >
          <div className="w-9 h-9 rounded-xl bg-red-100 flex items-center justify-center flex-shrink-0">
            <Target className="w-[18px] h-[18px] text-red-600" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-bold text-zinc-800">加盟リード獲得AI</p>
            <p className="text-[11px] text-zinc-500 mt-0.5">
              加盟候補の自動検索・AIスコアリング・パイプライン管理
            </p>
          </div>
          <ArrowRight className="w-4 h-4 text-red-300 group-hover:text-red-500 group-hover:translate-x-0.5 transition-all flex-shrink-0" />
        </Link>
      )}

      {/* ── 月次報告 未提出警告 ── */}
      {reportWarning && (
        <Link
          href="/dashboard/sales-report/new"
          className={`flex items-center gap-3 rounded-xl border px-5 py-3 transition group ${
            reportUrgent
              ? "border-red-300 bg-red-50 hover:bg-red-100"
              : "border-amber-300 bg-amber-50 hover:bg-amber-100"
          }`}
        >
          <div className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 ${reportUrgent ? "bg-red-100" : "bg-amber-100"}`}>
            <svg className={`w-4 h-4 ${reportUrgent ? "text-red-600" : "text-amber-600"}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4.5c-.77-.833-2.694-.833-3.464 0L3.34 16.5c-.77.833.192 2.5 1.732 2.5z" />
            </svg>
          </div>
          <div className="flex-1 min-w-0">
            <p className={`text-sm font-bold ${reportUrgent ? "text-red-800" : "text-amber-800"}`}>{reportWarning}</p>
            <p className={`text-xs mt-0.5 ${reportUrgent ? "text-red-600" : "text-amber-600"}`}>
              {reportUrgent ? "翌月1日に自動でアカウントが停止されます" : "未提出が続くとアカウントが一時停止されます"}
            </p>
          </div>
          <span className={`text-xs font-semibold group-hover:translate-x-0.5 transition-transform flex-shrink-0 ${reportUrgent ? "text-red-600" : "text-amber-600"}`}>提出する →</span>
        </Link>
      )}

      {/* ── 本部とのやり取り（週次共有への返信） ── */}
      {groupThread && (
        <GroupThreadCard
          messages={groupThread.messages.map((m) => ({
            id: m.id,
            type: m.type as "CEO_COMMENT" | "PARTNER_REPLY",
            content: m.content,
            actorName: m.actorName,
            createdAt: m.createdAt.toISOString(),
          }))}
          unreadCount={groupThread.unreadCount}
        />
      )}

      {/* ── 稼働ステータス申告（ADMIN以外、未選択時に表示） ── */}
      {partnerStatus && partnerStatus.status === "NOT_SELECTED" && (
        <Link
          href="/dashboard/partner-status"
          className="flex items-center gap-3 rounded-xl border-2 border-blue-300 bg-blue-50 px-5 py-4 transition group hover:bg-blue-100"
        >
          <div className="w-10 h-10 rounded-xl bg-blue-100 flex items-center justify-center flex-shrink-0">
            <Activity className="w-5 h-5 text-blue-600" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-bold text-blue-900">
              {now.getMonth() + 1}月の稼働ステータスが未選択です
            </p>
            <p className="text-xs text-blue-600 mt-0.5">
              {partnerCompanyName ? `${partnerCompanyName} — ` : ""}稼働ステータスを選択してください。未選択の場合、報告義務違反（第9条）として精算保留の対象となります。
            </p>
          </div>
          <span className="text-xs font-semibold text-blue-600 group-hover:translate-x-0.5 transition-transform flex-shrink-0">選択する →</span>
        </Link>
      )}
      {partnerStatus && partnerStatus.status !== "NOT_SELECTED" && (
        <Link
          href="/dashboard/partner-status"
          className={`flex items-center gap-3 rounded-xl border px-5 py-3 transition group ${
            partnerStatus.status === "ACTIVE"
              ? "border-emerald-200 bg-emerald-50/50 hover:bg-emerald-50"
              : "border-amber-200 bg-amber-50/50 hover:bg-amber-50"
          }`}
        >
          <div className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 ${
            partnerStatus.status === "ACTIVE" ? "bg-emerald-100" : "bg-amber-100"
          }`}>
            <Activity className={`w-4 h-4 ${
              partnerStatus.status === "ACTIVE" ? "text-emerald-600" : "text-amber-600"
            }`} />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <p className="text-sm font-semibold text-zinc-700">
                {now.getMonth() + 1}月 稼働ステータス
              </p>
              <span className={`inline-flex items-center px-2 py-0.5 text-[10px] font-semibold rounded-full ${
                partnerStatus.status === "ACTIVE"
                  ? "bg-emerald-100 text-emerald-700"
                  : "bg-amber-100 text-amber-700"
              }`}>
                {partnerStatus.status === "ACTIVE" ? "稼働中" : "活動休止中"}
              </span>
            </div>
          </div>
          <span className="text-xs text-zinc-400 group-hover:text-zinc-600 flex-shrink-0">変更 →</span>
        </Link>
      )}

      {/* ── 営業報告・リード管理カード ── */}
      {(
        <div className="bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-200 rounded-xl px-5 py-5">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-10 h-10 bg-blue-100 rounded-xl flex items-center justify-center flex-shrink-0">
              <Crosshair className="w-5 h-5 text-blue-600" />
            </div>
            <div>
              <p className="text-base font-bold text-zinc-900">リード管理・営業報告</p>
              <p className="text-xs text-zinc-500 mt-0.5">
                営業活動の記録・リードの管理はこちらから
              </p>
            </div>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
            <Link
              href="/dashboard/leads/list"
              className="flex items-center gap-2 px-4 py-3 bg-white rounded-lg border border-zinc-200 hover:border-blue-300 hover:bg-blue-50/30 transition group"
            >
              <ListChecks className="w-4 h-4 text-blue-600 flex-shrink-0" />
              <div className="min-w-0">
                <p className="text-sm font-semibold text-zinc-800">リード一覧</p>
                <p className="text-[11px] text-zinc-500">ステータス管理・進捗確認</p>
              </div>
              <ArrowRight className="w-3.5 h-3.5 text-zinc-300 group-hover:text-blue-500 ml-auto flex-shrink-0" />
            </Link>
            <Link
              href="/dashboard/leads/list"
              className="flex items-center gap-2 px-4 py-3 bg-white rounded-lg border border-zinc-200 hover:border-blue-300 hover:bg-blue-50/30 transition group"
            >
              <Upload className="w-4 h-4 text-indigo-600 flex-shrink-0" />
              <div className="min-w-0">
                <p className="text-sm font-semibold text-zinc-800">CSVインポート</p>
                <p className="text-[11px] text-zinc-500">OS外の営業をまとめて報告</p>
              </div>
              <ArrowRight className="w-3.5 h-3.5 text-zinc-300 group-hover:text-blue-500 ml-auto flex-shrink-0" />
            </Link>
            <a
              href="/api/leads/import/template"
              download
              className="flex items-center gap-2 px-4 py-3 bg-white rounded-lg border border-zinc-200 hover:border-blue-300 hover:bg-blue-50/30 transition group"
            >
              <Download className="w-4 h-4 text-emerald-600 flex-shrink-0" />
              <div className="min-w-0">
                <p className="text-sm font-semibold text-zinc-800">テンプレート</p>
                <p className="text-[11px] text-zinc-500">定型フォーマットを取得</p>
              </div>
              <ArrowRight className="w-3.5 h-3.5 text-zinc-300 group-hover:text-emerald-500 ml-auto flex-shrink-0" />
            </a>
          </div>
        </div>
      )}

      {/* ── グループダイジェスト ── */}
      {digest && (
        <div data-tour="digest" className="relative overflow-hidden rounded-xl border border-blue-200 bg-gradient-to-br from-blue-50 via-indigo-50 to-violet-50 px-5 py-4">
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

      {/* ── 営業インサイト サマリー ── */}
      {insightSummary.totalReports > 0 && (
        <Link
          href="/dashboard/sales-insights"
          className="group block rounded-xl border border-violet-200 bg-gradient-to-r from-violet-50 via-purple-50 to-fuchsia-50 px-5 py-4 hover:border-violet-300 hover:shadow-md transition-all"
        >
          <div className="flex items-center gap-3 mb-3">
            <div className="w-9 h-9 bg-gradient-to-br from-violet-400 to-purple-500 rounded-lg flex items-center justify-center flex-shrink-0 shadow-sm group-hover:scale-105 transition-transform">
              <Activity className="w-5 h-5 text-white" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-bold text-zinc-800 group-hover:text-violet-700 transition-colors">
                営業インサイト共有
              </p>
              <p className="text-[11px] text-zinc-500">
                グループ全体の営業分析レポート
              </p>
            </div>
            <ArrowRight className="w-5 h-5 text-violet-300 group-hover:text-violet-500 group-hover:translate-x-1 transition-all flex-shrink-0" />
          </div>
          <div className="grid grid-cols-4 gap-3">
            <div className="bg-white/70 rounded-lg px-3 py-2 border border-violet-100">
              <p className="text-[10px] text-zinc-400">レポート数</p>
              <p className="text-lg font-bold text-zinc-800">{insightSummary.totalReports}</p>
            </div>
            <div className="bg-white/70 rounded-lg px-3 py-2 border border-violet-100">
              <p className="text-[10px] text-zinc-400">総送信数</p>
              <p className="text-lg font-bold text-zinc-800">{insightSummary.totalSent}</p>
            </div>
            <div className="bg-white/70 rounded-lg px-3 py-2 border border-violet-100">
              <p className="text-[10px] text-zinc-400">総返信数</p>
              <p className="text-lg font-bold text-zinc-800">{insightSummary.totalReplied}</p>
            </div>
            <div className="bg-white/70 rounded-lg px-3 py-2 border border-violet-100">
              <p className="text-[10px] text-zinc-400">返信率</p>
              <p className="text-lg font-bold text-violet-600">{insightSummary.replyRate}%</p>
            </div>
          </div>
          {hotIndustries.length > 0 && (
            <div className="mt-2.5 flex items-center gap-2 flex-wrap">
              <span className="text-[10px] text-zinc-400">HOT業種:</span>
              {hotIndustries.map((ind) => (
                <span
                  key={ind}
                  className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold bg-red-100 text-red-600 border border-red-200"
                >
                  {ind}
                </span>
              ))}
            </div>
          )}
        </Link>
      )}

      {/* ── ご利用ガイド ── */}
      <div data-tour="guide-flow" className="rounded-xl border border-emerald-200 bg-gradient-to-r from-emerald-50 to-teal-50 px-5 py-4">
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
      <div data-tour="quick-actions" className="grid grid-cols-2 sm:grid-cols-4 gap-3">
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

      {/* ── リード獲得AI ── */}
      <div data-tour="lead-ai" className="relative overflow-hidden rounded-xl border border-orange-200 bg-gradient-to-r from-orange-50 via-amber-50 to-yellow-50 px-6 py-5">
        <Link href="/dashboard/leads" className="group flex items-center gap-4">
          <div className="w-12 h-12 bg-gradient-to-br from-orange-400 to-amber-500 rounded-xl flex items-center justify-center flex-shrink-0 shadow-sm group-hover:scale-105 transition-transform">
            <Search className="w-6 h-6 text-white" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-bold text-zinc-800 group-hover:text-orange-700 transition-colors">
              リード獲得AI
            </p>
            <p className="text-xs text-zinc-500 mt-0.5">
              AIがエリア・業種から見込み顧客を自動検索・スコアリング
            </p>
          </div>
          <ArrowRight className="w-5 h-5 text-orange-300 group-hover:text-orange-500 group-hover:translate-x-1 transition-all flex-shrink-0" />
        </Link>
        <div className="flex items-center gap-2 mt-3 pt-3 border-t border-orange-200/60">
          <span className="text-[10px] text-zinc-400 mr-1">検索タイプ:</span>
          <Link href="/dashboard/leads" className="text-[11px] font-semibold text-orange-600 bg-orange-100 hover:bg-orange-200 px-2.5 py-1 rounded-full border border-orange-200 transition-colors">
            BtoC
          </Link>
          <Link href="/dashboard/leads/btob" className="text-[11px] font-semibold text-blue-600 bg-blue-100 hover:bg-blue-200 px-2.5 py-1 rounded-full border border-blue-200 transition-colors">
            BtoB
          </Link>
          <Link href="/dashboard/leads/cinema" className="text-[11px] font-semibold text-purple-600 bg-purple-100 hover:bg-purple-200 px-2.5 py-1 rounded-full border border-purple-200 transition-colors">
            シネアド
          </Link>
          <Link href="/dashboard/leads/tvcm-pool" className="text-[11px] font-semibold text-rose-600 bg-rose-100 hover:bg-rose-200 px-2.5 py-1 rounded-full border border-rose-200 transition-colors">
            TVer広告 案件プール
          </Link>
        </div>
      </div>

      {/* ── グループ共有への依頼 ── */}
      <div className="rounded-xl border border-teal-200 bg-gradient-to-r from-teal-50 via-emerald-50 to-cyan-50 px-5 py-4">
        <div className="flex items-center gap-2 mb-3">
          <div className="w-7 h-7 bg-gradient-to-br from-teal-400 to-emerald-500 rounded-lg flex items-center justify-center flex-shrink-0">
            <Activity className="w-4 h-4 text-white" />
          </div>
          <div>
            <p className="text-sm font-bold text-zinc-800">グループに共有しましょう</p>
            <p className="text-[10px] text-zinc-500">あなたの経験がグループ全体の力になります</p>
          </div>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <Link
            href="/dashboard/sales-insights"
            className="group flex items-start gap-3 p-3 bg-white/70 rounded-lg border border-teal-100 hover:border-teal-300 hover:shadow-sm transition-all"
          >
            <div className="w-8 h-8 bg-violet-100 rounded-lg flex items-center justify-center flex-shrink-0 mt-0.5">
              <Activity className="w-4 h-4 text-violet-600" />
            </div>
            <div>
              <p className="text-xs font-bold text-zinc-800 group-hover:text-teal-700">営業分析レポート</p>
              <p className="text-[10px] text-zinc-500 mt-0.5 leading-relaxed">
                今月の送信数・返信率・反応が良かった業種をAI分析で共有
              </p>
            </div>
          </Link>
          <Link
            href="/dashboard/sales-approaches/new"
            className="group flex items-start gap-3 p-3 bg-white/70 rounded-lg border border-teal-100 hover:border-teal-300 hover:shadow-sm transition-all"
          >
            <div className="w-8 h-8 bg-teal-100 rounded-lg flex items-center justify-center flex-shrink-0 mt-0.5">
              <Search className="w-4 h-4 text-teal-600" />
            </div>
            <div>
              <p className="text-xs font-bold text-zinc-800 group-hover:text-teal-700">アプローチ事例を投稿</p>
              <p className="text-[10px] text-zinc-500 mt-0.5 leading-relaxed">
                どんな文面でどこに送ったか — 成功も失敗もグループの資産に
              </p>
            </div>
          </Link>
        </div>
      </div>

      {/* ── 今週の当たり先＋グループの受注・反応（匿名） ── */}
      {session?.user?.email && <SalesBoost userEmail={session.user.email} />}

      {/* ── 実績フォルダ 更新情報 ── */}
      <div className="rounded-xl border-2 border-amber-300 bg-gradient-to-r from-amber-50 via-yellow-50 to-orange-50 overflow-hidden ring-1 ring-amber-200/50">
        <div className="px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-gradient-to-br from-amber-400 to-yellow-500 rounded-xl flex items-center justify-center flex-shrink-0 shadow-sm">
              <FolderOpen className="w-5 h-5 text-white" />
            </div>
            <div>
              <p className="text-sm font-bold text-zinc-800">実績フォルダ — 最近の更新</p>
              <p className="text-[10px] text-zinc-500 mt-0.5">制作物の追加・更新を自動検知</p>
            </div>
          </div>
          <a
            href="https://drive.google.com/drive/folders/11CJPv-D_37Vn1zntRzI9Qqc2SV89fKPT?usp=drive_link"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-amber-500 text-white text-[11px]
                       font-semibold rounded-lg hover:bg-amber-600 transition-colors"
          >
            <FolderOpen className="w-3.5 h-3.5" />
            フォルダを開く
          </a>
        </div>

        {recentPortfolio.length > 0 ? (
          <div className="border-t border-amber-200/60 divide-y divide-amber-100/80">
            {recentPortfolio.map((item, i) => (
              <a
                key={i}
                href={item.driveUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-2.5 px-6 py-2 hover:bg-amber-100/40 transition-colors group"
              >
                <Film className="w-3.5 h-3.5 text-amber-400 flex-shrink-0" />
                <p className="text-[11px] font-semibold text-zinc-800 truncate group-hover:text-amber-700 min-w-0 flex-1">
                  {item.name}
                </p>
                <p className="text-[10px] text-zinc-400 truncate max-w-[120px] flex-shrink-0 hidden sm:block">
                  {item.parentName ?? ""}
                </p>
                <p className="text-[10px] text-zinc-400 whitespace-nowrap flex-shrink-0">
                  {new Intl.DateTimeFormat("ja-JP", {
                    month: "numeric", day: "numeric", timeZone: "Asia/Tokyo",
                  }).format(new Date(item.lastUpdated))}
                </p>
                <ExternalLink className="w-3 h-3 text-zinc-300 group-hover:text-amber-500 flex-shrink-0" />
              </a>
            ))}
          </div>
        ) : (
          <div className="border-t border-amber-200/60 px-6 py-8 text-center">
            <p className="text-xs text-zinc-400">更新情報はまだありません</p>
          </div>
        )}
      </div>

      {/* ── OS更新情報 ── */}
      <div className="rounded-xl border border-sky-200 bg-gradient-to-br from-sky-50 via-blue-50 to-indigo-50 px-5 py-4">
        <div className="flex items-center gap-2 mb-3">
          <div className="w-7 h-7 bg-gradient-to-br from-sky-400 to-blue-500 rounded-lg flex items-center justify-center flex-shrink-0">
            <Zap className="w-4 h-4 text-white" />
          </div>
          <p className="text-sm font-bold text-zinc-800">OS 更新情報</p>
        </div>
        <div className="space-y-2.5">
          {[
            {
              date: "2026.08.26",
              title: "取引先マップ",
              desc: "グループ全体の取引先・制作実績あり企業を、写真つきのカードと地図で眺められます（営業タブ）。地域・業種・会社の規模・Google の口コミ★で絞り込むと、その集合の傾向が数字で出ます。旧サイトの制作実績98本のサムネイルも会社ごとに紐づけました。社内構成（従業員数・資本金・代表者・設立）は会社サイトから自動で読み取った値なので、出典リンクで原文を確認してから使ってください",
              tag: "NEW",
            },
            {
              date: "2026.08.26",
              title: "広告賞ファインダー",
              desc: "全国・地方・国際の広告賞174件の応募時期・応募料を、あなたの県と制作物の種類から探せます（営業タブ）。制作前・制作中・完了後のどの段階でも「せっかくなので◯◯賞に出しませんか」をクライアントとの会話のきっかけに。地元の賞は応募料が無料〜数千円のものが多く、「案内文をコピー」で1行をそのまま連絡に貼れます。使い方はWikiに1本（アーチくんに聞いてもOK）",
              tag: "NEW",
            },
            {
              date: "2026.08.24",
              title: "「今週の当たり先」とグループの受注フィード",
              desc: "ダッシュボードに、あなたの県の周年・入札・補助金・シグナル新着の件数がまとまって出ます。あわせてグループ全体の受注・前向き返信が匿名で流れます。新機能の使い方はWikiに5本追加（アーチくんに聞いてもOK）",
              tag: "NEW",
            },
            {
              date: "2026.08.24",
              title: "リード管理から「メール送付」へ直行できるように",
              desc: "リード管理で会社を選択すると「メール送付：アウトリーチへ」ボタンが出ます。メールアドレス取得済みの会社だけをアウトリーチ画面に送り、件名・本文入りのメール下書きをワンクリックで開けます",
              tag: "NEW",
            },
            {
              date: "2026.08.24",
              title: "OSのAIを最新モデルに更新",
              desc: "アーチくんをはじめ、リードのスコアリング・営業文面の作成・戦略アドバイザーなどOS内のAI機能の頭脳を最新のClaude Sonnet 5に更新しました。精度が上がっています。使い方はこれまで通りです",
              tag: "機能追加",
            },
            {
              date: "2026.08.24",
              title: "グループライブ（全国の動きがリアルタイムに）",
              desc: "誰がどの業界のどの会社に当たっているかが地図とフィードで流れます。商談・週次共有などから自動生成＝入力は不要です",
              tag: "NEW",
            },
            {
              date: "2026.08.23",
              title: "周年リストにチェック選択とCSV書き出し",
              desc: "周年ファインダーで当たりたい会社にチェックを入れ、そのままCSVに書き出せます。DMやリスト作成にそのまま使えます",
              tag: "機能追加",
            },
            {
              date: "2026.08.22",
              title: "請求申請に「媒体請求」／今年の周年企業をダッシュボードに",
              desc: "TVer等の媒体を複数行で申請でき、媒体費の実費を行ごとに入れられます。ダッシュボードには今年これから周年を迎える会社が県名つきで並びます",
              tag: "リリース",
            },
            {
              date: "2026.08.24",
              title: "結果ボタンに「受注」／受注は月次報告に1クリックで取り込み",
              desc: "送った先の結果に「受注 🎉」が加わりました。受注にしたリードは月次報告の作成画面に候補として出るので、クリックで明細に1行入ります（金額は入力）。月次報告の上に「今月の動き（送付→返信→受注）」も出ます",
              tag: "NEW",
            },
            {
              date: "2026.08.21",
              title: "周年ファインダー／送付結果の1クリック登録",
              desc: "5年刻みの周年を迎える会社を出典つきで一覧化（営業タブ）。送った先の結果は「返信あり／NG／無反応／断り」の4ボタンで戻せ、グループの事例DBに自動で溜まります",
              tag: "NEW",
            },
            {
              date: "2026.08.19",
              title: "入札ファインダー・補助金ファインダー",
              desc: "全国の自治体・官公庁の入札案件と、クライアントの広告費の財源になる補助金を営業タブから探せます。週次共有にはOS内でそのまま返信できるようになりました",
              tag: "NEW",
            },
            {
              date: "2026.08.18",
              title: "リード管理が「シグナル順」に",
              desc: "補助金の採択・CM発表・求人など「その会社が動いている合図」が新しい順に並びます。◎14日以内の目印がついたリードから順に当たれます",
              tag: "NEW",
            },
          ].map((item) => (
            <div
              key={item.date + item.title}
              className="flex items-start gap-3 bg-white/60 rounded-lg px-3 py-2.5 border border-sky-100"
            >
              <p className="text-[10px] text-zinc-400 font-mono whitespace-nowrap mt-0.5">
                {item.date}
              </p>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <p className="text-xs font-semibold text-zinc-800 truncate">
                    {item.title}
                  </p>
                  <span
                    className={`flex-shrink-0 text-[9px] px-1.5 py-0.5 rounded-full font-semibold ${
                      item.tag === "NEW"
                        ? "bg-sky-100 text-sky-600 border border-sky-200"
                        : item.tag === "リリース"
                          ? "bg-emerald-100 text-emerald-600 border border-emerald-200"
                          : "bg-violet-100 text-violet-600 border border-violet-200"
                    }`}
                  >
                    {item.tag}
                  </span>
                </div>
                <p className="text-[11px] text-zinc-500 mt-0.5">{item.desc}</p>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* ── リンクツリー ── */}
      <div className="space-y-4">
        <p className="text-sm font-bold text-zinc-800">クイックリンク</p>

        {/* 営業 */}
        <div>
          <p className="text-[10px] font-semibold text-blue-500 uppercase tracking-widest mb-2">営業</p>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2">
            {([
              { href: "/dashboard/customers", label: "顧客管理", icon: Users, iconClass: "text-blue-500", minRole: "USER" as UserRole },
              { href: "/dashboard/deals", label: "商談管理（SFA）", icon: TrendingUp, iconClass: "text-blue-500", minRole: "USER" as UserRole },
              { href: "/dashboard/estimates", label: "公式見積もり", icon: FileText, iconClass: "text-blue-500", minRole: "USER" as UserRole },
              { href: "/dashboard/leads", label: "リード獲得AI", icon: Crosshair, iconClass: "text-orange-500", minRole: "USER" as UserRole },
              { href: "/dashboard/leads/tvcm-pool", label: "TVer広告 案件プール", icon: Film, iconClass: "text-rose-500", minRole: "USER" as UserRole },
              { href: "/dashboard/leads/tvcm", label: "TVer広告 案件クロール（本部）", icon: Film, iconClass: "text-rose-500", minRole: "ADMIN" as UserRole },
              { href: "/dashboard/leads/tvcm-history", label: "TVer広告 案件履歴（本部）", icon: Film, iconClass: "text-rose-500", minRole: "ADMIN" as UserRole },
              { href: "/dashboard/sales-insights", label: "営業分析レポート", icon: Activity, iconClass: "text-violet-500", minRole: "USER" as UserRole },
              { href: "/dashboard/sales-approaches", label: "アプローチ事例集", icon: Search, iconClass: "text-teal-500", minRole: "USER" as UserRole },
              { href: "/dashboard/video-achievements", label: "競合実績スクレイピング", icon: Target, iconClass: "text-rose-500", minRole: "USER" as UserRole },
            ])
              .filter((link) => hasMinRole(role, link.minRole))
              .map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className="group flex items-center gap-2.5 px-3 py-2.5 bg-white border border-zinc-200 rounded-lg hover:border-blue-300 hover:bg-blue-50/50 transition-all"
              >
                <link.icon className={`w-4 h-4 flex-shrink-0 ${link.iconClass}`} />
                <span className="text-[11px] font-medium text-zinc-700 group-hover:text-zinc-900 truncate">{link.label}</span>
              </Link>
            ))}
          </div>
        </div>

        {/* 広告媒体シミュレーター */}
        <div>
          <p className="text-[10px] font-semibold text-indigo-500 uppercase tracking-widest mb-2">広告媒体シミュレーター</p>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2">
            {[
              { href: "/dashboard/strategy-advisor", label: "提案戦略アドバイザー（AI）", icon: Sparkles },
              { href: "/dashboard/tver-simulator", label: "TVer広告", icon: Tv2 },
              { href: "/dashboard/taxi-ads-simulator", label: "タクシー広告", icon: Tv2 },
              { href: "/dashboard/skylark-simulator", label: "すかいらーく", icon: Tv2 },
              { href: "/dashboard/aeon-cinema-simulator", label: "イオンシネマ", icon: Tv2 },
              { href: "/dashboard/golfcart-simulator", label: "ゴルフカート", icon: Tv2 },
              { href: "/dashboard/omochannel-simulator", label: "おもチャンネル", icon: Tv2 },
              { href: "/dashboard/univ-coop-simulator", label: "大学生協広告", icon: Tv2 },
            ].map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className="group flex items-center gap-2.5 px-3 py-2.5 bg-white border border-zinc-200 rounded-lg hover:border-indigo-300 hover:bg-indigo-50/50 transition-all"
              >
                <link.icon className="w-4 h-4 flex-shrink-0 text-indigo-500" />
                <span className="text-[11px] font-medium text-zinc-700 group-hover:text-zinc-900 truncate">{link.label}</span>
              </Link>
            ))}
          </div>
        </div>

        {/* 制作・プロジェクト */}
        <div>
          <p className="text-[10px] font-semibold text-violet-500 uppercase tracking-widest mb-2">制作・プロジェクト</p>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2">
            {[
              { href: "/dashboard/projects", label: "プロジェクト一覧", icon: FolderKanban },
              { href: "/dashboard/project-matching", label: "案件マッチング", icon: Handshake },
              { href: "/dashboard/group-profiles", label: "メンバー紹介", icon: Users },
            ].map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className="group flex items-center gap-2.5 px-3 py-2.5 bg-white border border-zinc-200 rounded-lg hover:border-violet-300 hover:bg-violet-50/50 transition-all"
              >
                <link.icon className="w-4 h-4 flex-shrink-0 text-violet-500" />
                <span className="text-[11px] font-medium text-zinc-700 group-hover:text-zinc-900 truncate">{link.label}</span>
              </Link>
            ))}
          </div>
        </div>

        {/* 経理・データベース・サポート */}
        <div>
          <p className="text-[10px] font-semibold text-teal-500 uppercase tracking-widest mb-2">経理・データベース・サポート</p>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2">
            {[
              { href: "/dashboard/billing", label: "請求依頼", icon: CreditCard, iconClass: "text-amber-500" },
              { href: "/dashboard/sales-report", label: "月次報告", icon: BarChart2, iconClass: "text-amber-500" },
              { href: "/dashboard/business-cards", label: "名刺管理", icon: ContactRound, iconClass: "text-teal-500" },
              { href: "/dashboard/wiki", label: "社内Wiki", icon: BookOpen, iconClass: "text-teal-500" },
              { href: "/dashboard/portfolio", label: "実績フォルダ検索", icon: HardDrive, iconClass: "text-teal-500" },
            ].map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className="group flex items-center gap-2.5 px-3 py-2.5 bg-white border border-zinc-200 rounded-lg hover:border-teal-300 hover:bg-teal-50/50 transition-all"
              >
                <link.icon className={`w-4 h-4 flex-shrink-0 ${link.iconClass}`} />
                <span className="text-[11px] font-medium text-zinc-700 group-hover:text-zinc-900 truncate">{link.label}</span>
              </Link>
            ))}
          </div>
        </div>

        {/* 広告申請 */}
        <div>
          <p className="text-[10px] font-semibold text-blue-500 uppercase tracking-widest mb-2">広告申請</p>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2">
            {[
              { href: "/dashboard/tver-review", label: "TVer業態考査申請", icon: Tv2 },
              { href: "/dashboard/tver-campaign", label: "TVer配信申請", icon: Tv2 },
              { href: "/dashboard/tver-creative-review", label: "TVer クリエイティブ考査", icon: Tv2 },
              { href: "/dashboard/media", label: "媒体依頼", icon: Megaphone },
            ].map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className="group flex items-center gap-2.5 px-3 py-2.5 bg-white border border-zinc-200 rounded-lg hover:border-blue-300 hover:bg-blue-50/50 transition-all"
              >
                <link.icon className="w-4 h-4 flex-shrink-0 text-blue-500" />
                <span className="text-[11px] font-medium text-zinc-700 group-hover:text-zinc-900 truncate">{link.label}</span>
              </Link>
            ))}
          </div>
        </div>

        {/* 外部リンク */}
        <div>
          <p className="text-[10px] font-semibold text-zinc-500 uppercase tracking-widest mb-2">外部リンク</p>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2">
            {[
              { href: "https://calendar.app.google/pfFBZxmHbNFFp6cs5", label: "本部打ち合わせ予約" },
              { href: "https://drive.google.com/drive/folders/11CJPv-D_37Vn1zntRzI9Qqc2SV89fKPT?usp=drive_link", label: "実績フォルダ（Drive）" },
              { href: "https://drive.google.com/drive/folders/1p9QtqSbPrBAkof5-10jeusyG6T2y7cB8?usp=drive_link", label: "グループ運用データ（Drive）" },
            ].map((link) => (
              <a
                key={link.href}
                href={link.href}
                target="_blank"
                rel="noopener noreferrer"
                className="group flex items-center gap-2.5 px-3 py-2.5 bg-white border border-zinc-200 rounded-lg hover:border-zinc-400 hover:bg-zinc-50 transition-all"
              >
                <ExternalLink className="w-4 h-4 flex-shrink-0 text-zinc-400" />
                <span className="text-[11px] font-medium text-zinc-700 group-hover:text-zinc-900 truncate">{link.label}</span>
              </a>
            ))}
          </div>
        </div>
      </div>

    </div>
    </>
  );
}
