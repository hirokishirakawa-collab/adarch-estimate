import Link from "next/link";
import { cn } from "@/lib/utils";
import {
  maskAmount,
  DEAL_STATUS_LABELS,
  type DummyCustomer,
  type DealStatus,
} from "@/lib/data/customers";
import type { UserRole } from "@/types/roles";
import { Lock, ChevronRight, Phone, Mail } from "lucide-react";

interface CustomerTableProps {
  customers: DummyCustomer[];
  userRole: UserRole;
  userBranchId: string | null;
}

// ---------------------------------------------------------------
// 先着ロックの残り時間表示
// ---------------------------------------------------------------
function LockBadge({ expiresAt }: { expiresAt: Date }) {
  const remainingDays = Math.max(
    0,
    Math.ceil((expiresAt.getTime() - Date.now()) / 86400000)
  );
  return (
    <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-medium bg-amber-100 text-amber-700 border border-amber-200">
      <Lock className="w-2.5 h-2.5" />
      あと{remainingDays}日
    </span>
  );
}

// ---------------------------------------------------------------
// 商談ステータスバッジ
// ---------------------------------------------------------------
function StatusBadge({ status }: { status: DealStatus }) {
  const { label, className } = DEAL_STATUS_LABELS[status];
  return (
    <span className={cn("px-1.5 py-0.5 rounded text-[10px] font-medium", className)}>
      {label}
    </span>
  );
}

// ---------------------------------------------------------------
// 拠点バッジ
// ---------------------------------------------------------------
function BranchBadge({ branch }: { branch: DummyCustomer["branch"] }) {
  return (
    <span
      className={cn(
        "inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold border",
        branch.badgeClass
      )}
    >
      {branch.code} · {branch.name}
    </span>
  );
}

// ---------------------------------------------------------------
// CustomerTable
// ---------------------------------------------------------------
export function CustomerTable({
  customers,
  userRole,
  userBranchId,
}: CustomerTableProps) {
  if (customers.length === 0) {
    return (
      <div className="bg-white rounded-xl border border-zinc-200 py-16 text-center">
        <p className="text-sm text-zinc-500">条件に一致する顧客が見つかりません</p>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-xl border border-zinc-200 overflow-hidden">
      {/* テーブル */}
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-zinc-100 bg-zinc-50">
              <th className="text-left px-4 py-3 text-xs font-semibold text-zinc-500 w-48">
                顧客名
              </th>
              <th className="text-left px-4 py-3 text-xs font-semibold text-zinc-500 w-32">
                担当者
              </th>
              <th className="text-left px-4 py-3 text-xs font-semibold text-zinc-500 w-28">
                業種
              </th>
              <th className="text-left px-4 py-3 text-xs font-semibold text-zinc-500 w-36">
                登録拠点
              </th>
              <th className="text-left px-4 py-3 text-xs font-semibold text-zinc-500 w-24">
                ロック
              </th>
              <th className="text-left px-4 py-3 text-xs font-semibold text-zinc-500 w-20">
                商談数
              </th>
              <th className="text-left px-4 py-3 text-xs font-semibold text-zinc-500 w-40">
                最新商談 / 金額
              </th>
              <th className="w-10" />
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-100">
            {customers.map((customer) => {
              // 最新商談（配列の先頭）
              const latestDeal = customer.deals[0] ?? null;
              const amountResult = latestDeal
                ? maskAmount(latestDeal.amount, userBranchId, latestDeal.branchId)
                : null;

              return (
                <tr
                  key={customer.id}
                  className="hover:bg-zinc-50 transition-colors"
                >
                  {/* 顧客名 */}
                  <td className="px-4 py-3">
                    <div>
                      <p className="font-medium text-zinc-900 leading-snug">
                        {customer.name}
                      </p>
                      <div className="flex items-center gap-2 mt-0.5">
                        {customer.phone && (
                          <span className="flex items-center gap-0.5 text-[11px] text-zinc-400">
                            <Phone className="w-2.5 h-2.5" />
                            {customer.phone}
                          </span>
                        )}
                      </div>
                    </div>
                  </td>

                  {/* 担当者 */}
                  <td className="px-4 py-3">
                    <div>
                      <p className="text-zinc-700 text-xs">
                        {customer.contactName ?? "—"}
                      </p>
                      {customer.email && (
                        <p className="flex items-center gap-0.5 text-[11px] text-zinc-400 mt-0.5">
                          <Mail className="w-2.5 h-2.5" />
                          <span className="truncate max-w-[100px]">
                            {customer.email}
                          </span>
                        </p>
                      )}
                    </div>
                  </td>

                  {/* 業種 */}
                  <td className="px-4 py-3">
                    <p className="text-xs text-zinc-600">
                      {customer.industry ?? "—"}
                    </p>
                  </td>

                  {/* 拠点 */}
                  <td className="px-4 py-3">
                    <BranchBadge branch={customer.branch} />
                  </td>

                  {/* 先着ロック */}
                  <td className="px-4 py-3">
                    {customer.lockedByName && customer.lockExpiresAt ? (
                      <div className="space-y-1">
                        <LockBadge expiresAt={customer.lockExpiresAt} />
                        <p className="text-[10px] text-zinc-400">
                          {customer.lockedByName}
                        </p>
                      </div>
                    ) : (
                      <span className="text-[11px] text-zinc-300">なし</span>
                    )}
                  </td>

                  {/* 商談数 */}
                  <td className="px-4 py-3">
                    <span
                      className={cn(
                        "inline-flex items-center justify-center w-7 h-7 rounded-full text-xs font-bold",
                        customer.deals.length > 0
                          ? "bg-blue-50 text-blue-600"
                          : "bg-zinc-50 text-zinc-400"
                      )}
                    >
                      {customer.deals.length}
                    </span>
                  </td>

                  {/* 最新商談 / 金額 */}
                  <td className="px-4 py-3">
                    {latestDeal ? (
                      <div className="space-y-1">
                        <p className="text-xs text-zinc-700 leading-snug line-clamp-1">
                          {latestDeal.title}
                        </p>
                        <div className="flex items-center gap-1.5">
                          <StatusBadge status={latestDeal.status} />
                          {amountResult && (
                            <span
                              className={cn(
                                "text-xs font-semibold tabular-nums",
                                amountResult.masked
                                  ? "text-zinc-300 tracking-widest"
                                  : "text-zinc-800"
                              )}
                            >
                              {amountResult.display}
                            </span>
                          )}
                        </div>
                      </div>
                    ) : (
                      <span className="text-[11px] text-zinc-300">商談なし</span>
                    )}
                  </td>

                  {/* 詳細リンク */}
                  <td className="px-4 py-3">
                    <Link
                      href={`/dashboard/customers/${customer.id}`}
                      className="flex items-center justify-center w-7 h-7 rounded-lg hover:bg-zinc-100 text-zinc-400 hover:text-zinc-700 transition-colors"
                    >
                      <ChevronRight className="w-4 h-4" />
                    </Link>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* フッター */}
      <div className="px-4 py-3 border-t border-zinc-100 bg-zinc-50">
        <p className="text-xs text-zinc-500">
          {customers.length} 件表示
          {userRole !== "ADMIN" && (
            <span className="ml-2 text-zinc-400">
              ※ 他拠点の商談金額は非表示（
              <span className="tracking-widest">***</span>）
            </span>
          )}
        </p>
      </div>
    </div>
  );
}
