import { auth } from "@/lib/auth";
import { notFound } from "next/navigation";
import Link from "next/link";
import {
  getMockBranchId,
  maskAmount,
  BRANCH_MAP,
} from "@/lib/data/customers";
import { db } from "@/lib/db";
import { cn } from "@/lib/utils";
import type { UserRole } from "@/types/roles";
import {
  CUSTOMER_RANK_OPTIONS,
  CUSTOMER_STATUS_OPTIONS,
  SOURCE_OPTIONS,
} from "@/lib/constants/crm";
import {
  ChevronLeft,
  Phone,
  Mail,
  MapPin,
  Lock,
  TrendingUp,
  Clock,
  Hash,
  Building2,
  Globe,
  User,
  Tag,
  Info,
  ExternalLink,
  Pencil,
  FolderKanban,
  ClipboardList,
  Plus,
  FileCheck,
  Percent,
  Calendar,
} from "lucide-react";
import { DEAL_STATUS_OPTIONS } from "@/lib/constants/deals";
import { DealStatusEditor } from "@/components/customers/deal-status-editor";
import { ActivityForm } from "@/components/customers/activity-form";
import { ActivityTimeline } from "@/components/customers/activity-timeline";
import { LockButton } from "@/components/customers/lock-button";
import { CustomerHearingSection } from "@/components/customers/customer-hearing-section";
import { BranchSelector } from "@/components/customers/branch-selector";

interface PageProps {
  params: Promise<{ id: string }>;
}

// ---------------------------------------------------------------
// ラベル変換ヘルパー
// ---------------------------------------------------------------
function getSourceLabel(source: string | null): string {
  if (!source) return "—";
  return SOURCE_OPTIONS.find((o) => o.value === source)?.label ?? source;
}

export default async function CustomerDetailPage({ params }: PageProps) {
  const { id } = await params;
  const session = await auth();
  const role = (session?.user?.role ?? "MANAGER") as UserRole;
  const email = session?.user?.email ?? "";
  const userBranchId = getMockBranchId(email, role);
  const staffName = session?.user?.name ?? session?.user?.email ?? "不明";

  // DB からすべて取得（顧客・商談・活動履歴・セッションユーザー）
  const [dbCustomer, dbDeals, activities, sessionUser, hearingSheets, allBranches] = await Promise.all([
    db.customer.findUnique({
      where: { id },
      include: { lockedBy: { select: { id: true, name: true } } },
    }),
    db.deal.findMany({
      where: { customerId: id },
      orderBy: { createdAt: "desc" },
      include: {
        assignedTo: { select: { name: true } },
        hearingSheet: { select: { id: true, hearingRound: true, temperature: true } },
        decisionSheet: { select: { id: true, clientApproval: true, internalApproval: true } },
        _count: { select: { dealLogs: true } },
      },
    }),
    db.activityLog.findMany({
      where: { customerId: id },
      orderBy: { createdAt: "desc" },
    }),
    db.user.findUnique({ where: { email }, select: { id: true } }),
    db.hearingSheet.findMany({
      where: { customerId: id },
      orderBy: { updatedAt: "desc" },
    }),
    role === "ADMIN"
      ? db.branch.findMany({ where: { isActive: true }, select: { id: true, name: true }, orderBy: { name: "asc" } })
      : Promise.resolve([]),
  ]);

  if (!dbCustomer) notFound();

  // 拠点表示情報（BRANCH_MAP から）
  const branchDisplay =
    BRANCH_MAP[dbCustomer.branchId as keyof typeof BRANCH_MAP] ?? null;

  // ランク・ステータスバッジ
  const rankOption = CUSTOMER_RANK_OPTIONS.find(
    (o) => o.value === dbCustomer.rank
  );
  const statusOption = CUSTOMER_STATUS_OPTIONS.find(
    (o) => o.value === dbCustomer.status
  );

  // 先着ロック
  const isLocked =
    !!dbCustomer.lockExpiresAt && dbCustomer.lockExpiresAt > new Date();
  const lockRemaining = isLocked
    ? Math.max(
        0,
        Math.ceil(
          (dbCustomer.lockExpiresAt!.getTime() - Date.now()) / 86400000
        )
      )
    : 0;
  const lockedByName = dbCustomer.lockedBy?.name ?? null;
  const isMyLock = !!sessionUser && dbCustomer.lockedByUserId === sessionUser.id;

  return (
    <div className="px-6 py-6 space-y-4 max-w-4xl mx-auto w-full">
      {/* パンくず */}
      <Link
        href="/dashboard/customers"
        className="inline-flex items-center gap-1 text-xs text-zinc-500 hover:text-zinc-800 transition-colors"
      >
        <ChevronLeft className="w-3.5 h-3.5" />
        顧客一覧に戻る
      </Link>

      {/* ===== ヘッダーカード ===== */}
      <div className="bg-white rounded-xl border border-zinc-200 overflow-hidden">
        <div className="px-6 py-5">
          <div className="flex items-start justify-between gap-4">
            {/* 左: バッジ群 + 会社名 */}
            <div className="flex-1 min-w-0">
              {/* バッジ行 */}
              <div className="flex flex-wrap items-center gap-1.5 mb-2">
                {/* 拠点 */}
                {role === "ADMIN" && allBranches.length > 0 ? (
                  <BranchSelector
                    customerId={id}
                    currentBranchId={dbCustomer.branchId}
                    branches={allBranches}
                  />
                ) : branchDisplay ? (
                  <span
                    className={cn(
                      "inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold border",
                      branchDisplay.badgeClass
                    )}
                  >
                    {branchDisplay.code} · {branchDisplay.name}
                  </span>
                ) : null}

                {/* 顧客ランク */}
                {rankOption && (
                  <span
                    className={cn(
                      "inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold border",
                      rankOption.className
                    )}
                  >
                    ランク {rankOption.label}
                    <span className="font-normal">({rankOption.desc})</span>
                  </span>
                )}

                {/* 取引ステータス */}
                {statusOption && (
                  <span
                    className={cn(
                      "inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold border",
                      statusOption.className
                    )}
                  >
                    {statusOption.label}
                  </span>
                )}

                {/* 先着ロック */}
                {isLocked && (
                  <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-medium bg-amber-100 text-amber-700 border border-amber-200">
                    <Lock className="w-2.5 h-2.5" />
                    ロック中 あと{lockRemaining}日
                    {lockedByName && `（${lockedByName}）`}
                  </span>
                )}
              </div>

              {/* 会社名 */}
              <h2 className="text-xl font-bold text-zinc-900 leading-tight">
                {dbCustomer.name}
              </h2>

              {/* フリガナ */}
              {dbCustomer.nameKana && (
                <p className="text-xs text-zinc-400 mt-0.5 tracking-wide">
                  {dbCustomer.nameKana}
                </p>
              )}
            </div>

            {/* 右: アクションボタン群 + 活動件数 */}
            <div className="text-right flex-shrink-0 flex flex-col items-end gap-3">
              <div className="flex items-center gap-2">
                <LockButton
                  customerId={id}
                  isLocked={isLocked}
                  isMyLock={isMyLock}
                  isAdmin={role === "ADMIN"}
                />
                <Link
                  href={`/dashboard/projects/new?customerId=${id}`}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium border border-violet-200 rounded-lg bg-violet-50 hover:bg-violet-100 text-violet-700 transition-colors"
                >
                  <FolderKanban className="w-3.5 h-3.5" />
                  プロジェクト作成
                </Link>
                <Link
                  href={`/dashboard/customers/${id}/edit`}
                  className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-bold border-2 border-blue-500 rounded-lg bg-blue-600 hover:bg-blue-700 text-white shadow-sm transition-colors"
                >
                  <Pencil className="w-4 h-4" />
                  顧客情報を編集
                </Link>
              </div>
              <div>
                <p className="text-[10px] text-zinc-400 uppercase tracking-wide">
                  活動履歴
                </p>
                <p className="text-2xl font-bold text-blue-600 tabular-nums">
                  {activities.length}
                  <span className="text-sm font-normal text-zinc-400 ml-1">
                    件
                  </span>
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ===== クイック入力 ===== */}
      <div className="bg-white rounded-xl border border-zinc-200 overflow-hidden">
        <div className="px-5 py-3 border-b border-zinc-100 flex items-center gap-2 bg-gradient-to-r from-blue-50 to-white">
          <span className="text-base">✏️</span>
          <h3 className="text-xs font-semibold text-blue-700">活動を記録する</h3>
          <span className="ml-auto text-[10px] text-zinc-400">
            記録はすぐにタイムラインに反映されます
          </span>
        </div>
        <div className="px-5 py-4">
          <ActivityForm customerId={id} staffName={staffName} />
        </div>
      </div>

      {/* ===== ヒアリングシート ===== */}
      <div className="bg-white rounded-xl border border-zinc-200 overflow-hidden">
        <SectionHeader
          icon={<ClipboardList className="w-3.5 h-3.5" />}
          title={`ヒアリング ${hearingSheets.length} 件`}
        />
        <div className="px-5 py-4">
          <CustomerHearingSection
            customerId={id}
            customerName={dbCustomer.name}
            hearingSheets={hearingSheets}
          />
        </div>
      </div>

      {/* ===== 基本情報 + 担当・連絡先（2カラム）===== */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* 基本情報 */}
        <div className="bg-white rounded-xl border border-zinc-200 overflow-hidden">
          <div className="px-5 py-3 border-b border-zinc-100 flex items-center gap-2 bg-zinc-50/60">
            <span className="text-zinc-400"><Info className="w-3.5 h-3.5" /></span>
            <h3 className="text-xs font-semibold text-zinc-600">基本情報</h3>
            <Link
              href={`/dashboard/customers/${id}/edit`}
              className="ml-auto inline-flex items-center gap-1 text-[10px] font-medium text-blue-600 hover:text-blue-800 hover:underline transition-colors"
            >
              <Pencil className="w-3 h-3" />
              編集する
            </Link>
          </div>
          <div className="px-5 py-4 space-y-3">
            <InfoItem label="レコード番号">
              <span className="font-mono text-sm text-zinc-700">
                #{dbCustomer.recordNumber}
              </span>
            </InfoItem>
            <InfoItem label="法人番号">
              {dbCustomer.corporateNumber ?? "—"}
            </InfoItem>
            <InfoItem label="業種">
              {dbCustomer.industry ?? "—"}
            </InfoItem>
            <InfoItem label="流入経路">
              {getSourceLabel(dbCustomer.source)}
            </InfoItem>
            <InfoItem label="企業URL">
              {dbCustomer.website ? (
                <a
                  href={dbCustomer.website}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 text-sm text-blue-600 hover:underline"
                >
                  <Globe className="w-3 h-3" />
                  {dbCustomer.website.replace(/^https?:\/\//, "")}
                  <ExternalLink className="w-2.5 h-2.5" />
                </a>
              ) : (
                "—"
              )}
            </InfoItem>
          </div>
        </div>

        {/* 担当・連絡先 */}
        <div className="bg-white rounded-xl border border-zinc-200 overflow-hidden">
          <div className="px-5 py-3 border-b border-zinc-100 flex items-center gap-2 bg-zinc-50/60">
            <span className="text-zinc-400"><User className="w-3.5 h-3.5" /></span>
            <h3 className="text-xs font-semibold text-zinc-600">担当・連絡先</h3>
            <Link
              href={`/dashboard/customers/${id}/edit`}
              className="ml-auto inline-flex items-center gap-1 text-[10px] font-medium text-blue-600 hover:text-blue-800 hover:underline transition-colors"
            >
              <Pencil className="w-3 h-3" />
              編集する
            </Link>
          </div>
          <div className="px-5 py-4 space-y-3">
            <InfoItem label="社内担当者">
              {dbCustomer.staffName ? (
                <span className="inline-flex items-center gap-1.5">
                  <span className="w-5 h-5 bg-blue-100 rounded-full inline-flex items-center justify-center text-[10px] font-bold text-blue-600">
                    {dbCustomer.staffName.charAt(0)}
                  </span>
                  <span className="text-sm text-zinc-700">
                    {dbCustomer.staffName}
                  </span>
                </span>
              ) : (
                "—"
              )}
            </InfoItem>
            <InfoItem label="先方担当者">
              {dbCustomer.contactName ?? "—"}
            </InfoItem>
            <InfoItem label="電話番号">
              {dbCustomer.phone ? (
                <a
                  href={`tel:${dbCustomer.phone}`}
                  className="text-sm text-zinc-700 hover:text-blue-600 transition-colors"
                >
                  {dbCustomer.phone}
                </a>
              ) : (
                "—"
              )}
            </InfoItem>
            <InfoItem label="メール">
              {dbCustomer.email ? (
                <a
                  href={`mailto:${dbCustomer.email}`}
                  className="text-sm text-blue-600 hover:underline"
                >
                  {dbCustomer.email}
                </a>
              ) : (
                "—"
              )}
            </InfoItem>
          </div>
        </div>
      </div>

      {/* ===== 住所 ===== */}
      {(dbCustomer.postalCode ||
        dbCustomer.prefecture ||
        dbCustomer.address ||
        dbCustomer.building) && (
        <div className="bg-white rounded-xl border border-zinc-200 overflow-hidden">
          <SectionHeader
            icon={<MapPin className="w-3.5 h-3.5" />}
            title="住所"
          />
          <div className="px-5 py-4">
            <div className="text-sm text-zinc-700 leading-relaxed">
              {dbCustomer.postalCode && (
                <span className="text-zinc-500 mr-2">
                  〒{dbCustomer.postalCode}
                </span>
              )}
              {dbCustomer.prefecture}
              {dbCustomer.address && (
                <span className="ml-1">{dbCustomer.address}</span>
              )}
              {dbCustomer.building && (
                <span className="block text-zinc-500 text-xs mt-0.5">
                  {dbCustomer.building}
                </span>
              )}
              {!dbCustomer.postalCode &&
                !dbCustomer.prefecture &&
                !dbCustomer.address &&
                !dbCustomer.building && (
                  <span className="text-zinc-400">—</span>
                )}
            </div>
          </div>
        </div>
      )}

      {/* ===== 商談（プロジェクト統括）===== */}
      <div className="bg-white rounded-xl border border-zinc-200 overflow-hidden">
        <div className="px-5 py-3 border-b border-zinc-100 flex items-center justify-between bg-zinc-50/60">
          <div className="flex items-center gap-2">
            <span className="text-zinc-400"><TrendingUp className="w-3.5 h-3.5" /></span>
            <h3 className="text-xs font-semibold text-zinc-600">商談・プロジェクト {dbDeals.length} 件</h3>
          </div>
          <Link
            href={`/dashboard/deals/new?customerId=${id}`}
            className="inline-flex items-center gap-1 px-2.5 py-1 text-[11px] font-medium text-blue-600 border border-blue-200 rounded-lg bg-blue-50 hover:bg-blue-100 transition-colors"
          >
            <Plus className="w-3 h-3" />
            新規商談
          </Link>
        </div>

        {dbDeals.length === 0 ? (
          <div className="px-6 py-10 text-center">
            <p className="text-sm text-zinc-400 mb-2">商談データがありません</p>
            <Link
              href={`/dashboard/deals/new?customerId=${id}`}
              className="inline-flex items-center gap-1 text-xs text-blue-600 hover:underline"
            >
              <Plus className="w-3 h-3" /> 最初の商談を作成する
            </Link>
          </div>
        ) : (
          <>
            {/* サマリー */}
            {(() => {
              const active = dbDeals.filter((d) => d.status !== "CLOSED_WON" && d.status !== "CLOSED_LOST");
              const won = dbDeals.filter((d) => d.status === "CLOSED_WON");
              const lost = dbDeals.filter((d) => d.status === "CLOSED_LOST");
              const totalAmount = dbDeals.reduce((sum, d) => {
                if (!d.amount) return sum;
                const { masked: m } = maskAmount(Number(d.amount), userBranchId, d.branchId);
                return m ? sum : sum + Number(d.amount);
              }, 0);

              return (
                <div className="px-5 py-3 border-b border-zinc-100 flex flex-wrap gap-4">
                  <div className="flex items-center gap-1.5">
                    <span className="text-[10px] text-zinc-400">進行中</span>
                    <span className="text-sm font-bold text-blue-600">{active.length}</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span className="text-[10px] text-zinc-400">受注</span>
                    <span className="text-sm font-bold text-emerald-600">{won.length}</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span className="text-[10px] text-zinc-400">失注</span>
                    <span className="text-sm font-bold text-red-500">{lost.length}</span>
                  </div>
                  {totalAmount > 0 && (
                    <div className="flex items-center gap-1.5 ml-auto">
                      <span className="text-[10px] text-zinc-400">合計金額</span>
                      <span className="text-sm font-bold text-zinc-900">¥{totalAmount.toLocaleString("ja-JP")}</span>
                    </div>
                  )}
                </div>
              );
            })()}

            {/* 商談カード一覧 */}
            <div className="p-4 space-y-3">
              {dbDeals.map((deal) => {
                const { display, masked } = maskAmount(
                  deal.amount ? Number(deal.amount) : null,
                  userBranchId,
                  deal.branchId
                );
                const statusOpt = DEAL_STATUS_OPTIONS.find((o) => o.value === deal.status);
                const hasHearing = !!deal.hearingSheet;
                const hasDecision = !!deal.decisionSheet;
                const isApproved = deal.decisionSheet?.clientApproval && deal.decisionSheet?.internalApproval;

                return (
                  <div key={deal.id} className="rounded-lg border border-zinc-200 hover:border-zinc-300 hover:shadow-sm transition-all overflow-hidden">
                    {/* カードヘッダー */}
                    <div className="px-4 py-3 flex items-start justify-between gap-3">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1.5">
                          {statusOpt && (
                            <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold border ${statusOpt.color}`}>
                              {statusOpt.label}
                            </span>
                          )}
                          <DealStatusEditor
                            dealId={deal.id}
                            customerId={id}
                            currentStatus={deal.status}
                          />
                        </div>
                        <Link
                          href={`/dashboard/deals/${deal.id}`}
                          className="text-sm font-semibold text-zinc-900 hover:text-blue-600 transition-colors leading-snug"
                        >
                          {deal.title}
                        </Link>
                      </div>
                      <div className="text-right flex-shrink-0">
                        <p className={cn(
                          "text-base font-bold tabular-nums",
                          masked ? "text-zinc-300 tracking-widest" : "text-zinc-900"
                        )}>
                          {display}
                        </p>
                        {masked && <p className="text-[10px] text-zinc-400">他拠点 非表示</p>}
                      </div>
                    </div>

                    {/* カードフッター */}
                    <div className="px-4 py-2 bg-zinc-50/50 border-t border-zinc-100 flex flex-wrap items-center gap-x-4 gap-y-1">
                      {deal.assignedTo?.name && (
                        <span className="inline-flex items-center gap-1 text-[10px] text-zinc-400">
                          <User className="w-2.5 h-2.5" />
                          {deal.assignedTo.name}
                        </span>
                      )}
                      {deal.probability !== null && (
                        <span className="inline-flex items-center gap-1 text-[10px] text-zinc-400">
                          <Percent className="w-2.5 h-2.5" />
                          {deal.probability}%
                        </span>
                      )}
                      {deal.expectedCloseDate && (
                        <span className="inline-flex items-center gap-1 text-[10px] text-zinc-400">
                          <Calendar className="w-2.5 h-2.5" />
                          {deal.expectedCloseDate.toISOString().split("T")[0]}
                        </span>
                      )}
                      <span className="inline-flex items-center gap-1 text-[10px] text-zinc-400">
                        <Clock className="w-2.5 h-2.5" />
                        活動 {deal._count.dealLogs}件
                      </span>

                      {/* 進捗バッジ */}
                      <div className="flex items-center gap-1.5 ml-auto">
                        <span className={`inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[9px] font-medium border ${
                          hasHearing
                            ? "bg-amber-50 text-amber-600 border-amber-200"
                            : "bg-zinc-50 text-zinc-300 border-zinc-200"
                        }`}>
                          <ClipboardList className="w-2.5 h-2.5" />
                          ヒアリング{hasHearing && deal.hearingSheet?.hearingRound ? ` ${deal.hearingSheet.hearingRound}回` : ""}
                        </span>
                        <span className={`inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[9px] font-medium border ${
                          hasDecision
                            ? isApproved
                              ? "bg-emerald-50 text-emerald-600 border-emerald-200"
                              : "bg-blue-50 text-blue-600 border-blue-200"
                            : "bg-zinc-50 text-zinc-300 border-zinc-200"
                        }`}>
                          <FileCheck className="w-2.5 h-2.5" />
                          決定シート{isApproved ? " 承認済" : ""}
                        </span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </>
        )}
      </div>

      {/* ===== 活動履歴 ===== */}
      <div className="bg-white rounded-xl border border-zinc-200 overflow-hidden">
        <SectionHeader
          icon={<Clock className="w-3.5 h-3.5" />}
          title={`活動履歴 ${activities.length} 件`}
        />

        {/* タイムライン */}
        <ActivityTimeline activities={activities} />
      </div>
    </div>
  );
}

// ---------------------------------------------------------------
// セクションヘッダー
// ---------------------------------------------------------------
function SectionHeader({
  icon,
  title,
}: {
  icon: React.ReactNode;
  title: string;
}) {
  return (
    <div className="px-5 py-3 border-b border-zinc-100 flex items-center gap-2 bg-zinc-50/60">
      <span className="text-zinc-400">{icon}</span>
      <h3 className="text-xs font-semibold text-zinc-600">{title}</h3>
    </div>
  );
}

// ---------------------------------------------------------------
// 情報アイテム（ラベル + 値）
// ---------------------------------------------------------------
function InfoItem({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex items-start justify-between gap-3 min-h-[1.5rem]">
      <span className="text-[11px] text-zinc-400 flex-shrink-0 pt-0.5 w-24">
        {label}
      </span>
      <span className="text-sm text-zinc-700 text-right">{children}</span>
    </div>
  );
}
