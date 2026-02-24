"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { maskAmount, BRANCH_MAP } from "@/lib/data/customers";
import {
  CUSTOMER_RANK_OPTIONS,
  CUSTOMER_STATUS_OPTIONS,
  DEAL_STATUS_OPTIONS,
} from "@/lib/constants/crm";
import type { UserRole } from "@/types/roles";
import { Lock, ChevronRight, Phone, Mail, Trash2 } from "lucide-react";
import { deleteCustomers } from "@/lib/actions/customer";
import {
  AlertDialogRoot,
  AlertDialogTrigger,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogCancel,
  AlertDialogAction,
} from "@/components/ui/alert-dialog";

// ---------------------------------------------------------------
// 型定義（Prisma の findMany + include の戻り値に合わせる）
// ---------------------------------------------------------------
export type CustomerRow = {
  id: string;
  name: string;
  nameKana: string | null;
  contactName: string | null;
  email: string | null;
  phone: string | null;
  industry: string | null;
  rank: string;
  status: string;
  branchId: string;
  lockExpiresAt: Date | null;
  lockedBy: { name: string | null } | null;
  deals: Array<{
    id: string;
    title: string;
    status: string;
    amount: number | null;
    branchId: string;
  }>;
  _count: { deals: number };
};

interface Props {
  customers: CustomerRow[];
  userRole: UserRole;
  userBranchId: string | null;
}

// ---------------------------------------------------------------
// サブコンポーネント
// ---------------------------------------------------------------
function LockBadge({
  expiresAt,
  lockedByName,
}: {
  expiresAt: Date;
  lockedByName?: string | null;
}) {
  const days = Math.max(
    0,
    Math.ceil((expiresAt.getTime() - Date.now()) / 86400000)
  );
  return (
    <div className="space-y-0.5">
      <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-medium bg-amber-100 text-amber-700 border border-amber-200">
        <Lock className="w-2.5 h-2.5" />
        あと{days}日
      </span>
      {lockedByName && (
        <p className="text-[10px] text-zinc-400">{lockedByName}</p>
      )}
    </div>
  );
}

function RankBadge({ rank }: { rank: string }) {
  const opt = CUSTOMER_RANK_OPTIONS.find((o) => o.value === rank);
  if (!opt) return null;
  return (
    <span
      className={cn(
        "inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-bold border",
        opt.className
      )}
    >
      {opt.label}
    </span>
  );
}

function StatusBadge({ status }: { status: string }) {
  const opt = CUSTOMER_STATUS_OPTIONS.find((o) => o.value === status);
  if (!opt) return null;
  return (
    <span
      className={cn(
        "inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-semibold border",
        opt.className
      )}
    >
      {opt.label}
    </span>
  );
}

function DealStatusBadge({ status }: { status: string }) {
  const opt = DEAL_STATUS_OPTIONS.find((o) => o.value === status);
  return (
    <span
      className={cn(
        "px-1.5 py-0.5 rounded text-[10px] font-medium",
        opt?.className ?? "bg-zinc-100 text-zinc-500"
      )}
    >
      {opt?.label ?? status}
    </span>
  );
}

// ---------------------------------------------------------------
// CustomerTable
// ---------------------------------------------------------------
export function CustomerTable({ customers, userRole, userBranchId }: Props) {
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [isPending, startTransition] = useTransition();
  const isAdmin = userRole === "ADMIN";

  const allSelected =
    customers.length > 0 && selectedIds.size === customers.length;
  const someSelected = selectedIds.size > 0 && !allSelected;

  const toggleAll = () => {
    if (allSelected) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(customers.map((c) => c.id)));
    }
  };

  const toggleOne = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const handleDelete = () => {
    const ids = Array.from(selectedIds);
    startTransition(async () => {
      const result = await deleteCustomers(ids);
      if (result.error) {
        toast.error(result.error);
      } else {
        toast.success(`${result.deleted}件のデータを削除しました`);
        setSelectedIds(new Set());
      }
    });
  };

  if (customers.length === 0) {
    return (
      <div className="bg-white rounded-xl border border-zinc-200 py-16 text-center">
        <p className="text-sm text-zinc-500">条件に一致する顧客が見つかりません</p>
        <p className="text-xs text-zinc-400 mt-1">検索条件を変更してください</p>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-xl border border-zinc-200 overflow-hidden">
      {/* ADMIN 用 一括削除ツールバー */}
      {isAdmin && selectedIds.size > 0 && (
        <div className="flex items-center justify-between px-4 py-2.5 bg-red-50 border-b border-red-100">
          <p className="text-sm font-medium text-red-700">
            {selectedIds.size}件を選択中
          </p>
          <AlertDialogRoot>
            <AlertDialogTrigger asChild>
              <button
                disabled={isPending}
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-white bg-red-600 hover:bg-red-700 rounded-lg transition-colors disabled:opacity-50"
              >
                <Trash2 className="w-3.5 h-3.5" />
                {selectedIds.size}件を削除
              </button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle className="text-base font-bold text-zinc-900">
                  顧客データを削除しますか？
                </AlertDialogTitle>
                <AlertDialogDescription className="text-sm text-zinc-500">
                  選択した{" "}
                  <span className="font-semibold text-red-600">
                    {selectedIds.size}件
                  </span>{" "}
                  の顧客データ（商談・活動履歴を含む）を完全に削除します。
                  <br />
                  この操作は取り消せません。
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel asChild>
                  <button className="px-4 py-2 text-sm text-zinc-600 bg-zinc-100 hover:bg-zinc-200 rounded-lg transition-colors">
                    キャンセル
                  </button>
                </AlertDialogCancel>
                <AlertDialogAction asChild>
                  <button
                    onClick={handleDelete}
                    className="px-4 py-2 text-sm font-semibold text-white bg-red-600 hover:bg-red-700 rounded-lg transition-colors"
                  >
                    削除する
                  </button>
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialogRoot>
        </div>
      )}

      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-zinc-100 bg-zinc-50">
              {/* チェックボックス列（ADMIN のみ） */}
              {isAdmin && (
                <th className="px-4 py-3 w-10">
                  <input
                    type="checkbox"
                    checked={allSelected}
                    ref={(el) => {
                      if (el) el.indeterminate = someSelected;
                    }}
                    onChange={toggleAll}
                    className="w-4 h-4 rounded border-zinc-300 text-blue-600 cursor-pointer"
                    aria-label="全選択"
                  />
                </th>
              )}
              <th className="text-left px-4 py-3 text-xs font-semibold text-zinc-500 w-52">
                顧客名
              </th>
              <th className="text-left px-4 py-3 text-xs font-semibold text-zinc-500 w-28">
                ランク / 状態
              </th>
              <th className="text-left px-4 py-3 text-xs font-semibold text-zinc-500 w-32">
                先方担当者
              </th>
              <th className="text-left px-4 py-3 text-xs font-semibold text-zinc-500 w-28">
                業種
              </th>
              <th className="text-left px-4 py-3 text-xs font-semibold text-zinc-500 w-32">
                登録拠点
              </th>
              <th className="text-left px-4 py-3 text-xs font-semibold text-zinc-500 w-20">
                ロック
              </th>
              <th className="text-left px-4 py-3 text-xs font-semibold text-zinc-500 w-16">
                商談
              </th>
              <th className="text-left px-4 py-3 text-xs font-semibold text-zinc-500 w-40">
                最新商談
              </th>
              <th className="w-10" />
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-100">
            {customers.map((customer) => {
              const latestDeal = customer.deals[0] ?? null;
              const amountResult = latestDeal
                ? maskAmount(
                    latestDeal.amount ?? null,
                    userBranchId,
                    latestDeal.branchId
                  )
                : null;
              const isLocked =
                !!customer.lockExpiresAt &&
                customer.lockExpiresAt > new Date();
              const branch =
                BRANCH_MAP[customer.branchId as keyof typeof BRANCH_MAP];
              const isSelected = selectedIds.has(customer.id);

              return (
                <tr
                  key={customer.id}
                  className={cn(
                    "hover:bg-zinc-50 transition-colors",
                    isSelected && "bg-red-50 hover:bg-red-50"
                  )}
                >
                  {/* チェックボックス（ADMIN のみ） */}
                  {isAdmin && (
                    <td className="px-4 py-3">
                      <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={() => toggleOne(customer.id)}
                        className="w-4 h-4 rounded border-zinc-300 text-blue-600 cursor-pointer"
                        aria-label={`${customer.name}を選択`}
                      />
                    </td>
                  )}

                  {/* 顧客名 */}
                  <td className="px-4 py-3">
                    <div>
                      <p className="font-medium text-zinc-900 leading-snug">
                        {customer.name}
                      </p>
                      {customer.nameKana && (
                        <p className="text-[11px] text-zinc-400 mt-0.5">
                          {customer.nameKana}
                        </p>
                      )}
                      {customer.phone && (
                        <span className="flex items-center gap-0.5 text-[11px] text-zinc-400 mt-0.5">
                          <Phone className="w-2.5 h-2.5" />
                          {customer.phone}
                        </span>
                      )}
                    </div>
                  </td>

                  {/* ランク / ステータス */}
                  <td className="px-4 py-3">
                    <div className="flex flex-col gap-1">
                      <RankBadge rank={customer.rank} />
                      <StatusBadge status={customer.status} />
                    </div>
                  </td>

                  {/* 先方担当者 */}
                  <td className="px-4 py-3">
                    <div>
                      <p className="text-xs text-zinc-700">
                        {customer.contactName ?? "—"}
                      </p>
                      {customer.email && (
                        <p className="flex items-center gap-0.5 text-[11px] text-zinc-400 mt-0.5">
                          <Mail className="w-2.5 h-2.5" />
                          <span className="truncate max-w-[110px]">
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
                    {branch ? (
                      <span
                        className={cn(
                          "inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold border",
                          branch.badgeClass
                        )}
                      >
                        {branch.code} · {branch.name}
                      </span>
                    ) : (
                      <span className="text-[11px] text-zinc-400">
                        {customer.branchId}
                      </span>
                    )}
                  </td>

                  {/* 先着ロック */}
                  <td className="px-4 py-3">
                    {isLocked ? (
                      <LockBadge
                        expiresAt={customer.lockExpiresAt!}
                        lockedByName={customer.lockedBy?.name}
                      />
                    ) : (
                      <span className="text-[11px] text-zinc-300">なし</span>
                    )}
                  </td>

                  {/* 商談数 */}
                  <td className="px-4 py-3">
                    <span
                      className={cn(
                        "inline-flex items-center justify-center w-7 h-7 rounded-full text-xs font-bold",
                        customer._count.deals > 0
                          ? "bg-blue-50 text-blue-600"
                          : "bg-zinc-50 text-zinc-400"
                      )}
                    >
                      {customer._count.deals}
                    </span>
                  </td>

                  {/* 最新商談 */}
                  <td className="px-4 py-3">
                    {latestDeal ? (
                      <div className="space-y-1">
                        <p className="text-xs text-zinc-700 leading-snug line-clamp-1">
                          {latestDeal.title}
                        </p>
                        <div className="flex items-center gap-1.5">
                          <DealStatusBadge status={latestDeal.status} />
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
