import { auth } from "@/lib/auth";
import { Suspense } from "react";
import { ListChecks, Upload, Download, PenLine, MessagesSquare, Clapperboard, ArrowRight, UserCheck, MailQuestion } from "lucide-react";
import Link from "next/link";
import { db } from "@/lib/db";
import type { LeadStatus, LeadSource, DealStatus, ProjectStatus } from "@/generated/prisma/client";
import { LeadListTable } from "@/components/leads/lead-list-table";
import { LeadListFilters } from "@/components/leads/lead-list-filters";
import { LeadActivityFeed } from "@/components/leads/lead-activity-feed";
import { CustomerPagination } from "@/components/customers/customer-pagination";
import { LeadDeleteAllButton } from "@/components/leads/lead-delete-all-button";
import { LeadExportButtons } from "@/components/leads/lead-export-buttons";
import { LeadCsvImport } from "@/components/leads/lead-csv-import";
import type { UserRole } from "@/types/roles";
import { FavoriteButton } from "@/components/layout/favorite-button";
import { ActivityKpiBar } from "@/components/dashboard/activity-kpi-bar";
import { getActivityKpi } from "@/lib/kpis/activity";
import { releaseStaleAssignedLeads, RELEASE_AFTER_DAYS, RELEASE_UNTOUCHED_AFTER_DAYS } from "@/lib/leads/release-stale";

const PER_PAGE = 20;

interface PageProps {
  searchParams: Promise<{
    q?: string;
    status?: string;
    assigneeId?: string;
    industry?: string;
    area?: string;
    source?: string;
    sort?: string;
    page?: string;
  }>;
}

export default async function LeadListPage({ searchParams }: PageProps) {
  const session = await auth();
  if (!session?.user) return null;

  const role = (session.user.role ?? "USER") as UserRole;
  const isAdmin = role === "ADMIN";
  const canSelect = true;

  const params = await searchParams;
  const q = params.q?.trim() ?? "";
  const statusParam = params.status ?? "";
  const assigneeIdParam = params.assigneeId ?? "";
  const industryParam = params.industry ?? "";
  const areaParam = params.area ?? "";
  const sourceParam = params.source ?? "";
  const sortParam = params.sort ?? "";
  const page = Math.max(1, parseInt(params.page ?? "1") || 1);

  // 「自分のリード」ボタン用: 自分のユーザーIDを解決
  const me = await db.user.findUnique({
    where: { email: session.user.email ?? "" },
    select: { id: true },
  });
  const isMine = !!me && assigneeIdParam === me.id;

  // ---------------------------------------------------------------
  // WHERE 条件を構築
  // ---------------------------------------------------------------
  // リード管理のベース除外条件:
  // - SKIPPED（=TVerプールの「却下」含む）は不可視化（feedback_tver_rejected_hidden）
  // - 未claimのTVerプール案件はプール画面のみ表示。リード管理に出てくる
  //   TVer案件は「claim済み＝担当者付き」だけが自然な状態
  type WhereInput = {
    OR?: Array<{
      name?: { contains: string; mode: "insensitive" };
      address?: { contains: string; mode: "insensitive" };
      memo?: { contains: string; mode: "insensitive" };
    }>;
    status?: LeadStatus | { not: LeadStatus } | { notIn: LeadStatus[] };
    assigneeId?: string | null;
    industry?: string;
    area?: { contains: string; mode: "insensitive" };
    source?: LeadSource;
    NOT?: { source: LeadSource; assigneeId: null };
  };

  const baseExclude = {
    status: { notIn: ["SKIPPED", "ARCHIVED"] as LeadStatus[] },
    NOT: { source: "PR_TIMES_TVCM" as LeadSource, assigneeId: null },
  };

  const where: WhereInput = { ...baseExclude };
  if (q) {
    where.OR = [
      { name: { contains: q, mode: "insensitive" } },
      { address: { contains: q, mode: "insensitive" } },
      { memo: { contains: q, mode: "insensitive" } },
    ];
  }
  if (statusParam && statusParam !== "SKIPPED") {
    where.status = statusParam as LeadStatus;
  }
  if (assigneeIdParam) {
    where.assigneeId = assigneeIdParam === "unassigned" ? null : assigneeIdParam;
  }
  if (industryParam) where.industry = industryParam;
  if (areaParam) where.area = { contains: areaParam, mode: "insensitive" };
  if (sourceParam) where.source = sourceParam as LeadSource;

  // ソート
  // 既定は「シグナル順」。買う気配が立った日が新しいものから当たる。
  // 鮮度が同じなら既存のAIスコア（質の判定）で並べる＝2軸。
  type OrderByItem = {
    createdAt?: "asc" | "desc";
    scoreTotal?: "asc" | "desc";
    area?: "asc" | "desc";
    industry?: "asc" | "desc";
    signalAt?: { sort: "asc" | "desc"; nulls: "first" | "last" };
  };
  const SIGNAL_ORDER: OrderByItem[] = [
    { signalAt: { sort: "desc", nulls: "last" } },
    { scoreTotal: "desc" },
  ];
  let orderBy: OrderByItem | OrderByItem[] = SIGNAL_ORDER;
  if (sortParam === "score_desc") orderBy = { scoreTotal: "desc" };
  if (sortParam === "score_asc") orderBy = { scoreTotal: "asc" };
  if (sortParam === "area") orderBy = { area: "asc" };
  if (sortParam === "industry") orderBy = { industry: "asc" };
  if (sortParam === "newest") orderBy = { createdAt: "desc" };
  if (sortParam === "oldest") orderBy = { createdAt: "asc" };

  // 声かけ解放: 連絡済みのまま動きのないリードの担当を自動で外し、
  // 別の代表が声かけできる状態に戻す（一覧表示のたびにルールを適用）。
  await releaseStaleAssignedLeads();

  // ---------------------------------------------------------------
  // 顧客側（商談・制作）の進行中件数のスコープ
  // ADMIN は全拠点、それ以外は自拠点のみ。表示は件数のみで個人名は出さない。
  // ---------------------------------------------------------------
  const currentUser = isAdmin
    ? null
    : await db.user.findUnique({
        where: { email: session.user.email ?? "" },
        select: { branchId: true },
      });
  // 非ADMINで拠点未設定の場合は誤って全件カウントしないようダミーIDで0件に倒す
  const branchScope = isAdmin
    ? {}
    : { branchId: currentUser?.branchId ?? "__no_branch__" };
  // 商談「進行中」= 実商談ステージのみ（初期声掛け/初回商談/提案中）。
  // NEGOTIATION はこのアプリでは「休眠/先送り」列のため、停滞を休眠へ送ると
  // この数が実態どおり減るよう、進行中からは除外する。
  const DEAL_OPEN: DealStatus[] = ["PROSPECTING", "QUALIFYING", "PROPOSAL"];
  // 制作「進行中」= 受注済み・進行中
  const PROJECT_ACTIVE: ProjectStatus[] = ["ORDERED", "IN_PROGRESS"];

  // ---------------------------------------------------------------
  // データ取得
  // ---------------------------------------------------------------
  const [
    leads,
    total,
    totalAll,
    untouchedCount,
    calledCount,
    calledCsvCount,
    appointmentCount,
    dealConvertedCount,
    activeDealCount,
    activeProjectCount,
    archivedCount,
    awaitingCount,
    users,
    recentLogs,
    industries,
    areas,
  ] = await Promise.all([
    db.lead.findMany({
      where,
      include: {
        assignee: { select: { id: true, name: true, email: true } },
        convertedCustomer: { select: { id: true, name: true } },
      },
      orderBy,
      skip: (page - 1) * PER_PAGE,
      take: PER_PAGE,
    }),
    db.lead.count({ where }),
    db.lead.count({ where: baseExclude }),
    db.lead.count({ where: { ...baseExclude, status: "UNTOUCHED" } }),
    db.lead.count({ where: { ...baseExclude, status: "CALLED" } }),
    // 「連絡済み」のうちCSV一括取込分（外部営業の報告。その後の前進が紐づかず分母を膨らませる）
    db.lead.count({ where: { ...baseExclude, status: "CALLED", source: "CSV_IMPORT" } }),
    db.lead.count({ where: { ...baseExclude, status: "APPOINTMENT" } }),
    db.lead.count({ where: { ...baseExclude, status: "DEAL_CONVERTED" } }),
    // 顧客側: 進行中の商談・制作（拠点スコープ済み・件数のみ）
    db.deal.count({ where: { ...branchScope, status: { in: DEAL_OPEN } } }),
    db.project.count({ where: { ...branchScope, status: { in: PROJECT_ACTIVE } } }),
    db.lead.count({ where: { status: "ARCHIVED" } }),
    // 送ったが結果を入れていない件数（＝返事待ち）
    db.lead.count({ where: { sentAt: { not: null }, outreachResult: null } }),
    db.user.findMany({
      where: { isActive: true },
      select: { id: true, name: true, email: true },
      orderBy: { name: "asc" },
    }),
    db.leadLog.findMany({
      include: {
        lead: { select: { name: true } },
      },
      orderBy: { createdAt: "desc" },
      take: 20,
    }),
    // 業種・エリアの選択肢を取得
    db.lead.findMany({ select: { industry: true }, distinct: ["industry"], where: { industry: { not: null } }, orderBy: { industry: "asc" } }),
    db.lead.findMany({ select: { area: true }, distinct: ["area"], where: { area: { not: null } }, orderBy: { area: "asc" } }),
  ]);

  const totalPages = Math.ceil(total / PER_PAGE);
  const hasFilter = !!(q || statusParam || assigneeIdParam);

  // 「連絡済み」の内訳: CSV一括取込 と 自社接触（OS上での架電・接触）
  const calledOwnCount = Math.max(0, calledCount - calledCsvCount);

  // 今月の活動KPI（声かけ→商談→受注）
  const activityKpi = await getActivityKpi();

  // 稼働中の人の数（担当付きリードを持つユーザー別件数）
  const activeAssigneeGroups = await db.lead.groupBy({
    by: ["assigneeId"],
    where: { ...baseExclude, assigneeId: { not: null } },
    _count: { _all: true },
    orderBy: { _count: { assigneeId: "desc" } },
  });
  // 稼働ユーザーに該当しない担当（退会・非アクティブ等＝「不明」）は除外する
  const activeAssigneeDetails = activeAssigneeGroups
    .map((g) => {
      const user = users.find((u) => u.id === g.assigneeId);
      return user ? { userId: g.assigneeId!, count: g._count._all, name: user.name ?? user.email ?? "" } : null;
    })
    .filter((d): d is { userId: string; count: number; name: string } => d !== null);
  const activeAssigneeCount = activeAssigneeDetails.length;

  // 営業フォームへ現在の絞り込みを引き継ぐ
  const outreachQuery = [
    statusParam ? `status=${statusParam}` : "",
    industryParam ? `industry=${encodeURIComponent(industryParam)}` : "",
    areaParam ? `area=${encodeURIComponent(areaParam)}` : "",
    q ? `q=${encodeURIComponent(q)}` : "",
  ]
    .filter(Boolean)
    .join("&");
  const outreachHref = `/dashboard/leads/outreach${outreachQuery ? `?${outreachQuery}` : ""}`;

  return (
    <div className="px-6 py-6 space-y-5 max-w-screen-2xl mx-auto w-full">
      {/* ===== ヘッダー ===== */}
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 bg-blue-50 rounded-xl flex items-center justify-center">
            <ListChecks
              className="text-blue-600"
              style={{ width: "1.125rem", height: "1.125rem" }}
            />
          </div>
          <div>
            <div className="flex items-center gap-1.5">
              <h2 className="text-lg font-bold text-zinc-900">リード管理</h2>
              <FavoriteButton path="/dashboard/leads/list" label="リード管理" />
            </div>
            <p className="text-xs text-zinc-500 mt-0.5">
              新規開拓リードの管理。商談化した本命案件は
              <Link
                href="/dashboard/customers"
                className="text-blue-600 hover:underline font-medium mx-0.5"
              >
                顧客管理
              </Link>
              で進行します
            </p>
          </div>
        </div>
        <div data-tour="lead-list-import" className="flex items-center gap-3">
          {me && (
            <Link
              href={isMine ? "/dashboard/leads/list" : `/dashboard/leads/list?assigneeId=${me.id}`}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold rounded-lg transition-colors border ${
                isMine
                  ? "bg-blue-600 text-white border-blue-600 hover:bg-blue-700"
                  : "bg-white text-zinc-700 border-zinc-300 hover:bg-zinc-50"
              }`}
            >
              <UserCheck className="w-3.5 h-3.5" />
              {isMine ? "自分のリードのみ" : "自分のリード"}
            </Link>
          )}
          <Link
            href="/dashboard/leads/awaiting"
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold text-blue-700 bg-white border border-blue-300 rounded-lg hover:bg-blue-50 transition-colors"
            title="送ったが結果を入れていない先。結果を押すとグループ事例に残ります"
          >
            <MailQuestion className="w-3.5 h-3.5" />
            返事待ち
            {awaitingCount > 0 && (
              <span className="inline-flex items-center justify-center min-w-[18px] px-1 h-[18px] rounded-full bg-blue-600 text-white text-[10px] font-black">
                {awaitingCount}
              </span>
            )}
          </Link>
          <Link
            href={outreachHref}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold text-white bg-[#1F3A5F] rounded-lg hover:bg-[#16304f] transition-colors"
          >
            <PenLine className="w-3.5 h-3.5" />
            営業フォーム
          </Link>
          <LeadExportButtons />
          {isAdmin && <LeadDeleteAllButton totalCount={totalAll} />}
        </div>
      </div>

      <ActivityKpiBar kpi={activityKpi} />

      {/* ===== 営業報告インポートバナー ===== */}
      <div className="bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-200 rounded-xl px-5 py-4">
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-10 h-10 bg-blue-100 rounded-xl flex items-center justify-center flex-shrink-0">
              <Upload className="w-5 h-5 text-blue-600" />
            </div>
            <div className="min-w-0">
              <p className="text-sm font-bold text-blue-900">
                ツールを使わずに営業した場合の報告はこちら
              </p>
              <p className="text-xs text-blue-600 mt-0.5">
                訪問営業・電話営業・紹介営業など、OS外で獲得したリードをCSVで一括インポートできます
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 flex-shrink-0">
            <a
              href="/api/leads/import/template"
              download
              className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-medium text-blue-700 bg-white border border-blue-200 rounded-lg hover:bg-blue-50 transition-colors"
            >
              <Download className="w-3.5 h-3.5" />
              テンプレート
            </a>
            <LeadCsvImport />
          </div>
        </div>
      </div>

      {/* ===== サマリー ===== */}
      {/* 在庫（総リード数）は“倉庫”の数字。主役は「今動かすべき2バケツ」。
          成果（アポ・商談化）は前向きに、総リード数は控えめに添える。 */}
      <div data-tour="lead-list-summary" className="space-y-3">
        {/* 主役: いま動かすべき2バケツ */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <Link
            href="/dashboard/leads/list?status=UNTOUCHED"
            className={`rounded-xl border px-5 py-4 transition-all hover:shadow-md ${
              statusParam === "UNTOUCHED"
                ? "bg-amber-50 border-amber-400 ring-2 ring-amber-200"
                : "bg-white border-amber-200 hover:border-amber-300"
            }`}
          >
            <div className="flex items-center justify-between gap-3">
              <div className="min-w-0">
                <p className="text-xs font-semibold text-amber-700">⚪ 今やるべき（未対応）</p>
                <p className="text-[11px] text-zinc-400 mt-0.5">まだ一度も接触していないリード</p>
              </div>
              <p className="text-3xl font-black text-amber-600 leading-none flex-shrink-0">
                {untouchedCount.toLocaleString()}
              </p>
            </div>
          </Link>
          <Link
            href="/dashboard/leads/list?status=CALLED"
            className={`rounded-xl border px-5 py-4 transition-all hover:shadow-md ${
              statusParam === "CALLED"
                ? "bg-blue-50 border-blue-400 ring-2 ring-blue-200"
                : "bg-white border-blue-200 hover:border-blue-300"
            }`}
          >
            <div className="flex items-center justify-between gap-3">
              <div className="min-w-0">
                <p className="text-xs font-semibold text-blue-700">📞 フォロー待ち（連絡済み）</p>
                <p className="text-[11px] text-zinc-400 mt-0.5">接触済み。次の一手でアポへ</p>
              </div>
              <p className="text-3xl font-black text-blue-600 leading-none flex-shrink-0">
                {calledCount.toLocaleString()}
              </p>
            </div>
            {calledCsvCount > 0 && (
              <div className="mt-2 pt-2 border-t border-blue-100 flex items-center gap-3 text-[11px] text-zinc-400">
                <span>うちCSV取込 {calledCsvCount.toLocaleString()}件</span>
                <span className="text-zinc-300">/</span>
                <span>自社接触 {calledOwnCount.toLocaleString()}件</span>
              </div>
            )}
          </Link>
        </div>

        {/* 成果（アポ・商談化）＋ 在庫（控えめ） */}
        <div className="grid grid-cols-3 gap-3">
          <Link
            href="/dashboard/leads/list?status=APPOINTMENT"
            className={`rounded-lg border px-4 py-3 transition-all hover:shadow-sm ${
              statusParam === "APPOINTMENT"
                ? "bg-yellow-50 border-yellow-400 ring-2 ring-yellow-200"
                : "bg-white border-zinc-200 hover:border-zinc-300"
            }`}
          >
            <p className="text-[11px] text-zinc-500">📅 アポ獲得</p>
            <p className="text-xl font-bold text-yellow-700 mt-0.5">{appointmentCount}</p>
          </Link>
          <Link
            href="/dashboard/leads/list?status=DEAL_CONVERTED"
            className={`rounded-lg border px-4 py-3 transition-all hover:shadow-sm ${
              statusParam === "DEAL_CONVERTED"
                ? "bg-emerald-50 border-emerald-400 ring-2 ring-emerald-200"
                : "bg-white border-zinc-200 hover:border-zinc-300"
            }`}
          >
            <p className="text-[11px] text-zinc-500">🎉 商談化（成果）</p>
            <p className="text-xl font-bold text-emerald-700 mt-0.5">{dealConvertedCount}</p>
          </Link>
          <Link
            href="/dashboard/leads/list"
            className={`rounded-lg border px-4 py-3 transition-all hover:shadow-sm flex flex-col justify-center ${
              !statusParam
                ? "bg-zinc-50 border-zinc-300 ring-1 ring-zinc-200"
                : "bg-zinc-50/60 border-zinc-200 hover:border-zinc-300"
            }`}
          >
            <p className="text-[11px] text-zinc-400">総リード数（在庫）</p>
            <p className="text-sm font-semibold text-zinc-500 mt-0.5">
              {totalAll.toLocaleString()}件
            </p>
          </Link>
        </div>

        {/* 稼働中の人数 */}
        {activeAssigneeCount > 0 && (
          <details className="group rounded-lg border border-zinc-200 bg-white overflow-hidden">
            <summary className="flex items-center justify-between px-4 py-3 cursor-pointer hover:bg-zinc-50 transition-colors select-none list-none">
              <div className="flex items-center gap-2">
                <span className="text-[11px] text-zinc-500">👤 稼働中の人数（担当付きリード保有）</span>
                <span className="text-xs font-bold text-blue-700 bg-blue-50 border border-blue-200 px-2 py-0.5 rounded-full">
                  {activeAssigneeCount}名
                </span>
              </div>
              <span className="text-[10px] text-zinc-400 group-open:hidden">▼ 内訳を見る</span>
              <span className="text-[10px] text-zinc-400 hidden group-open:block">▲ 閉じる</span>
            </summary>
            <div className="border-t border-zinc-100 divide-y divide-zinc-100">
              {activeAssigneeDetails.map((d) => (
                <Link
                  key={d.userId}
                  href={`/dashboard/leads/list?assigneeId=${d.userId}`}
                  className="flex items-center justify-between px-4 py-2.5 hover:bg-zinc-50 transition-colors"
                >
                  <span className="text-xs text-zinc-700">{d.name}</span>
                  <span className="text-xs font-bold text-zinc-900">{d.count}件</span>
                </Link>
              ))}
            </div>
          </details>
        )}

        {/* アーカイブ（30日以上動きなしのフォロー待ちを自動移動） */}
        {archivedCount > 0 && (
          <Link
            href="/dashboard/leads/list?status=ARCHIVED"
            className={`rounded-lg border px-4 py-3 transition-all hover:shadow-sm flex items-center justify-between ${
              statusParam === "ARCHIVED"
                ? "bg-zinc-100 border-zinc-400 ring-1 ring-zinc-300"
                : "bg-zinc-50/60 border-zinc-200 hover:border-zinc-300"
            }`}
          >
            <p className="text-[11px] text-zinc-400">🗂 アーカイブ（30日以上動きなし）</p>
            <p className="text-sm font-semibold text-zinc-400">{archivedCount.toLocaleString()}件</p>
          </Link>
        )}

        {/* この先の本命パイプライン（顧客側）。件数のみ・担当者名は出さない。 */}
        <div className="rounded-xl border border-zinc-200 bg-zinc-50/60 px-4 py-3">
          <div className="flex items-center gap-1.5 mb-2">
            <ArrowRight className="w-3 h-3 text-zinc-400" />
            <p className="text-[11px] font-semibold text-zinc-500">
              この先の進行（顧客側）
            </p>
            <span className="text-[10px] text-zinc-400">
              {isAdmin ? "全拠点・件数のみ" : "自拠点・件数のみ"}
            </span>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Link
              href="/dashboard/deals"
              className="group flex items-center justify-between rounded-lg border border-zinc-200 bg-white px-4 py-3 transition-all hover:shadow-sm hover:border-indigo-300"
            >
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-indigo-50 flex items-center justify-center flex-shrink-0">
                  <MessagesSquare className="w-4 h-4 text-indigo-600" />
                </div>
                <div>
                  <p className="text-xs font-semibold text-zinc-700">商談中</p>
                  <p className="text-[10px] text-zinc-400">提案〜交渉中の進行案件</p>
                </div>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="text-xl font-bold text-indigo-600">{activeDealCount}</span>
                <ArrowRight className="w-3.5 h-3.5 text-zinc-300 group-hover:text-indigo-500 group-hover:translate-x-0.5 transition-all" />
              </div>
            </Link>
            <Link
              href="/dashboard/projects"
              className="group flex items-center justify-between rounded-lg border border-zinc-200 bg-white px-4 py-3 transition-all hover:shadow-sm hover:border-rose-300"
            >
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-rose-50 flex items-center justify-center flex-shrink-0">
                  <Clapperboard className="w-4 h-4 text-rose-600" />
                </div>
                <div>
                  <p className="text-xs font-semibold text-zinc-700">制作中</p>
                  <p className="text-[10px] text-zinc-400">受注済み・制作進行中の案件</p>
                </div>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="text-xl font-bold text-rose-600">{activeProjectCount}</span>
                <ArrowRight className="w-3.5 h-3.5 text-zinc-300 group-hover:text-rose-500 group-hover:translate-x-0.5 transition-all" />
              </div>
            </Link>
          </div>
        </div>
      </div>

      {/* ===== フィルター ===== */}
      <div data-tour="lead-list-filters" className="bg-white rounded-xl border border-zinc-200 px-5 py-4">
        <Suspense>
          <LeadListFilters
            users={users}
            industries={industries.map((i) => i.industry!).filter(Boolean)}
            areas={areas.map((a) => a.area!).filter(Boolean)}
          />
        </Suspense>
      </div>

      {/* 声かけ解放ルールの注釈 */}
      <p className="text-[11px] text-zinc-400 px-1">
        ※ 担当を取って{RELEASE_UNTOUCHED_AFTER_DAYS}日 声かけがない、または声かけ（連絡済み）後{RELEASE_AFTER_DAYS}日 動きがないリードは自動で解放され、担当が外れて別の代表が声かけ可能になります（直前の担当は「過去:◯◯」タグで表示）。
      </p>

      {/* ===== テーブル ===== */}
      <div data-tour="lead-list-table">
        <LeadListTable
          leads={leads.map((l) => ({
            ...l,
            scoreBreakdown: l.scoreBreakdown as Record<string, number> | null,
          }))}
          users={users}
          isAdmin={isAdmin}
          canSelect={canSelect}
        />
      </div>

      {/* ===== ページネーション ===== */}
      {totalPages > 0 && (
        <Suspense>
          <CustomerPagination
            currentPage={page}
            totalPages={totalPages}
            total={total}
            perPage={PER_PAGE}
          />
        </Suspense>
      )}

      {/* ===== アクティビティフィード ===== */}
      {recentLogs.length > 0 && (
        <LeadActivityFeed logs={recentLogs} />
      )}
    </div>
  );
}
