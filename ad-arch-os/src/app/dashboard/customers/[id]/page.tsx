import { auth } from "@/lib/auth";
import { notFound } from "next/navigation";
import Link from "next/link";
import {
  DUMMY_CUSTOMERS,
  getMockBranchId,
  maskAmount,
} from "@/lib/data/customers";
import { db } from "@/lib/db";
import { cn } from "@/lib/utils";
import type { UserRole } from "@/types/roles";
import {
  ChevronLeft,
  Phone,
  Mail,
  MapPin,
  Lock,
  Building2,
  TrendingUp,
  Clock,
} from "lucide-react";
import { DealStatusEditor } from "@/components/customers/deal-status-editor";
import { ActivityForm } from "@/components/customers/activity-form";
import { ActivityTimeline } from "@/components/customers/activity-timeline";

interface PageProps {
  params: Promise<{ id: string }>;
}

export default async function CustomerDetailPage({ params }: PageProps) {
  const { id } = await params;
  const session = await auth();
  const role = (session?.user?.role ?? "MANAGER") as UserRole;
  const email = session?.user?.email ?? "";
  const userBranchId = getMockBranchId(email, role);

  // モックデータから顧客基本情報を取得
  const customer = DUMMY_CUSTOMERS.find((c) => c.id === id);
  if (!customer) notFound();

  // DB から商談と活動履歴を取得
  const [dbDeals, activities] = await Promise.all([
    db.deal.findMany({
      where: { customerId: id },
      orderBy: { createdAt: "desc" },
    }),
    db.activityLog.findMany({
      where: { customerId: id },
      orderBy: { createdAt: "desc" },
    }),
  ]);

  const isLocked = !!customer.lockedByName && !!customer.lockExpiresAt;
  const lockRemaining = isLocked
    ? Math.max(
        0,
        Math.ceil(
          (customer.lockExpiresAt!.getTime() - Date.now()) / 86400000
        )
      )
    : 0;

  return (
    <div className="px-6 py-6 space-y-5 max-w-4xl mx-auto w-full">
      {/* パンくず */}
      <Link
        href="/dashboard/customers"
        className="inline-flex items-center gap-1 text-xs text-zinc-500 hover:text-zinc-800 transition-colors"
      >
        <ChevronLeft className="w-3.5 h-3.5" />
        顧客一覧に戻る
      </Link>

      {/* ===== 顧客情報カード ===== */}
      <div className="bg-white rounded-xl border border-zinc-200 overflow-hidden">
        {/* ヘッダー */}
        <div className="px-6 py-5 border-b border-zinc-100 flex items-start justify-between">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span
                className={cn(
                  "inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold border",
                  customer.branch.badgeClass
                )}
              >
                {customer.branch.code} · {customer.branch.name}
              </span>
              {isLocked && (
                <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-medium bg-amber-100 text-amber-700 border border-amber-200">
                  <Lock className="w-2.5 h-2.5" />
                  ロック中 あと{lockRemaining}日（{customer.lockedByName}）
                </span>
              )}
            </div>
            <h2 className="text-xl font-bold text-zinc-900">{customer.name}</h2>
            <p className="text-sm text-zinc-500 mt-0.5">{customer.industry}</p>
          </div>
          {/* 活動件数バッジ */}
          <div className="text-right">
            <p className="text-xs text-zinc-400">活動履歴</p>
            <p className="text-2xl font-bold text-blue-600 tabular-nums">
              {activities.length}
              <span className="text-sm font-normal text-zinc-400 ml-1">件</span>
            </p>
          </div>
        </div>

        {/* 連絡先情報 */}
        <div className="px-6 py-5 grid grid-cols-2 gap-4">
          <InfoRow icon={<Building2 className="w-3.5 h-3.5" />} label="担当者">
            {customer.contactName ?? "—"}
          </InfoRow>
          <InfoRow icon={<Phone className="w-3.5 h-3.5" />} label="電話番号">
            {customer.phone ?? "—"}
          </InfoRow>
          <InfoRow icon={<Mail className="w-3.5 h-3.5" />} label="メール">
            {customer.email ?? "—"}
          </InfoRow>
          <InfoRow icon={<MapPin className="w-3.5 h-3.5" />} label="住所">
            {customer.address ?? "—"}
          </InfoRow>
        </div>
      </div>

      {/* ===== 商談（DB・ステータス編集可能）===== */}
      <div className="bg-white rounded-xl border border-zinc-200 overflow-hidden">
        <div className="px-6 py-4 border-b border-zinc-100 flex items-center gap-2">
          <TrendingUp className="w-4 h-4 text-zinc-500" />
          <h3 className="text-sm font-semibold text-zinc-900">
            商談
            <span className="ml-2 text-xs font-normal text-zinc-400">
              {dbDeals.length} 件
            </span>
          </h3>
        </div>

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
                    {/* 左: タイトル + ステータス */}
                    <div className="space-y-2 flex-1 min-w-0">
                      <p className="text-sm font-medium text-zinc-800 leading-snug">
                        {deal.title}
                      </p>
                      <div className="flex flex-wrap items-center gap-3">
                        {/* ステータス編集ドロップダウン */}
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

                    {/* 右: 金額 */}
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
        {/* セクションヘッダー */}
        <div className="px-6 py-4 border-b border-zinc-100 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Clock className="w-4 h-4 text-zinc-500" />
            <h3 className="text-sm font-semibold text-zinc-900">
              活動履歴
              <span className="ml-2 text-xs font-normal text-zinc-400">
                {activities.length} 件
              </span>
            </h3>
          </div>
        </div>

        {/* 活動記録フォーム */}
        <div className="px-6 py-5 border-b border-zinc-100 bg-zinc-50/50">
          <p className="text-xs font-semibold text-zinc-500 uppercase tracking-wide mb-3">
            活動を記録する
          </p>
          <ActivityForm customerId={id} />
        </div>

        {/* タイムライン */}
        <ActivityTimeline activities={activities} />
      </div>
    </div>
  );
}

// ---------------------------------------------------------------
// 情報行コンポーネント
// ---------------------------------------------------------------
function InfoRow({
  icon,
  label,
  children,
}: {
  icon: React.ReactNode;
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex items-start gap-2">
      <span className="mt-0.5 text-zinc-400">{icon}</span>
      <div>
        <p className="text-[10px] text-zinc-400 uppercase tracking-wide">
          {label}
        </p>
        <p className="text-sm text-zinc-700 mt-0.5">{children}</p>
      </div>
    </div>
  );
}
