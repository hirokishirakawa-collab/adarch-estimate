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
} from "lucide-react";
import { DealStatusEditor } from "@/components/customers/deal-status-editor";
import { ActivityForm } from "@/components/customers/activity-form";
import { ActivityTimeline } from "@/components/customers/activity-timeline";
import { LockButton } from "@/components/customers/lock-button";

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
  const [dbCustomer, dbDeals, activities, sessionUser] = await Promise.all([
    db.customer.findUnique({
      where: { id },
      include: { lockedBy: { select: { id: true, name: true } } },
    }),
    db.deal.findMany({
      where: { customerId: id },
      orderBy: { createdAt: "desc" },
    }),
    db.activityLog.findMany({
      where: { customerId: id },
      orderBy: { createdAt: "desc" },
    }),
    db.user.findUnique({ where: { email }, select: { id: true } }),
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
                {branchDisplay && (
                  <span
                    className={cn(
                      "inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold border",
                      branchDisplay.badgeClass
                    )}
                  >
                    {branchDisplay.code} · {branchDisplay.name}
                  </span>
                )}

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
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium border border-zinc-200 rounded-lg bg-white hover:bg-zinc-50 hover:border-zinc-300 text-zinc-600 transition-colors"
                >
                  <Pencil className="w-3.5 h-3.5" />
                  編集
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

      {/* ===== 基本情報 + 担当・連絡先（2カラム）===== */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* 基本情報 */}
        <div className="bg-white rounded-xl border border-zinc-200 overflow-hidden">
          <SectionHeader icon={<Info className="w-3.5 h-3.5" />} title="基本情報" />
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
          <SectionHeader
            icon={<User className="w-3.5 h-3.5" />}
            title="担当・連絡先"
          />
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

      {/* ===== 商談（DB・ステータス編集可能）===== */}
      <div className="bg-white rounded-xl border border-zinc-200 overflow-hidden">
        <SectionHeader
          icon={<TrendingUp className="w-3.5 h-3.5" />}
          title={`商談 ${dbDeals.length} 件`}
        />

        {dbDeals.length === 0 ? (
          <div className="px-6 py-10 text-center text-sm text-zinc-400">
            商談データがありません
          </div>
        ) : (
          <div className="divide-y divide-zinc-100">
            {dbDeals.map((deal) => {
              const { display, masked } = maskAmount(
                deal.amount ? Number(deal.amount) : null,
                userBranchId,
                deal.branchId
              );

              return (
                <div key={deal.id} className="px-6 py-4">
                  <div className="flex items-start justify-between gap-4">
                    <div className="space-y-2 flex-1 min-w-0">
                      <p className="text-sm font-medium text-zinc-800 leading-snug">
                        {deal.title}
                      </p>
                      <div className="flex flex-wrap items-center gap-3">
                        <DealStatusEditor
                          dealId={deal.id}
                          customerId={id}
                          currentStatus={deal.status}
                        />
                        {deal.expectedCloseDate && (
                          <span className="text-[11px] text-zinc-400">
                            予定:{" "}
                            {deal.expectedCloseDate
                              .toISOString()
                              .split("T")[0]}
                          </span>
                        )}
                      </div>
                    </div>
                    <div className="text-right flex-shrink-0">
                      <p
                        className={cn(
                          "text-base font-bold tabular-nums",
                          masked
                            ? "text-zinc-300 tracking-widest"
                            : "text-zinc-900"
                        )}
                      >
                        {display}
                      </p>
                      {masked && (
                        <p className="text-[10px] text-zinc-400">
                          他拠点 非表示
                        </p>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
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
