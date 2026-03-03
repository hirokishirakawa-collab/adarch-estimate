"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { Trash2 } from "lucide-react";
import { REGION_OPTIONS } from "@/lib/constants/business-cards";
import { deleteBusinessCards } from "@/lib/actions/business-card";
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

type CardRow = {
  id: string;
  companyName: string;
  department: string | null;
  title: string | null;
  lastName: string;
  firstName: string | null;
  prefecture: string | null;
  aiIndustry: string | null;
  wantsCollab: boolean;
  isOrdered: boolean;
  isCompetitor: boolean;
  isCreator: boolean;
  exchangeDate: Date | null;
  ownerId: string;
  owner: { name: string | null } | null;
  // region flags
  regionHokkaido: boolean;
  regionTohoku: boolean;
  regionKitakanto: boolean;
  regionSaitama: boolean;
  regionChiba: boolean;
  regionTokyo: boolean;
  regionKanagawa: boolean;
  regionChubu: boolean;
  regionKansai: boolean;
  regionChugoku: boolean;
  regionShikoku: boolean;
  regionKyushu: boolean;
};

function getRegionLabels(card: CardRow): string[] {
  const labels: string[] = [];
  for (const r of REGION_OPTIONS) {
    if (card[r.value as keyof CardRow]) {
      labels.push(r.label);
    }
  }
  return labels;
}

export function CardTable({
  cards,
  page,
  totalPages,
  total,
  baseUrl,
  isAdmin = false,
  currentUserId,
}: {
  cards: CardRow[];
  page: number;
  totalPages: number;
  total: number;
  baseUrl: string;
  isAdmin?: boolean;
  currentUserId: string;
}) {
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [isPending, startTransition] = useTransition();

  const allSelected =
    cards.length > 0 && selectedIds.size === cards.length;
  const someSelected = selectedIds.size > 0 && !allSelected;

  const toggleAll = () => {
    if (allSelected) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(cards.map((c) => c.id)));
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
      const result = await deleteBusinessCards(ids);
      if (result.error) {
        toast.error(result.error);
      } else {
        toast.success(`${result.deleted}件の名刺を削除しました`);
        setSelectedIds(new Set());
      }
    });
  };

  const colSpan = isAdmin ? 9 : 8;

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
                  名刺データを削除しますか？
                </AlertDialogTitle>
                <AlertDialogDescription className="text-sm text-zinc-500">
                  選択した{" "}
                  <span className="font-semibold text-red-600">
                    {selectedIds.size}件
                  </span>{" "}
                  の名刺データ（関連する開示申請を含む）を完全に削除します。
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
        <table className="w-full text-xs">
          <thead>
            <tr className="border-b border-zinc-100 bg-zinc-50/80">
              {isAdmin && (
                <th className="px-4 py-2.5 w-10">
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
              <th className="text-left px-4 py-2.5 font-semibold text-zinc-500">会社名</th>
              <th className="text-left px-4 py-2.5 font-semibold text-zinc-500">氏名</th>
              <th className="text-left px-4 py-2.5 font-semibold text-zinc-500">役職</th>
              <th className="text-left px-4 py-2.5 font-semibold text-zinc-500">業界</th>
              <th className="text-left px-4 py-2.5 font-semibold text-zinc-500">地域</th>
              <th className="text-left px-4 py-2.5 font-semibold text-zinc-500">フラグ</th>
              <th className="text-left px-4 py-2.5 font-semibold text-zinc-500">所有者</th>
              <th className="text-left px-4 py-2.5 font-semibold text-zinc-500">交換日</th>
            </tr>
          </thead>
          <tbody>
            {cards.length === 0 ? (
              <tr>
                <td colSpan={colSpan} className="text-center py-12 text-zinc-400">
                  該当する名刺はありません
                </td>
              </tr>
            ) : (
              cards.map((card) => {
                const isOwned = isAdmin || card.ownerId === currentUserId;
                const regions = getRegionLabels(card);
                const isSelected = selectedIds.has(card.id);
                return (
                  <tr
                    key={card.id}
                    className={cn(
                      "border-b border-zinc-50 hover:bg-zinc-50/50 transition-colors",
                      isSelected && "bg-red-50 hover:bg-red-50"
                    )}
                  >
                    {isAdmin && (
                      <td className="px-4 py-2.5">
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={() => toggleOne(card.id)}
                          className="w-4 h-4 rounded border-zinc-300 text-blue-600 cursor-pointer"
                          aria-label={`${card.companyName} ${card.lastName}を選択`}
                        />
                      </td>
                    )}
                    <td className="px-4 py-2.5">
                      <Link
                        href={`/dashboard/business-cards/${card.id}`}
                        className="text-blue-600 hover:underline font-medium"
                      >
                        {card.companyName}
                      </Link>
                      {isOwned && card.department && (
                        <span className="block text-[10px] text-zinc-400 mt-0.5">
                          {card.department}
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-2.5 whitespace-nowrap text-zinc-500">
                      {isOwned ? `${card.lastName} ${card.firstName ?? ""}` : "***"}
                    </td>
                    <td className="px-4 py-2.5 text-zinc-500">
                      {card.title ?? "—"}
                    </td>
                    <td className="px-4 py-2.5">
                      {card.aiIndustry ? (
                        <span className="inline-flex px-1.5 py-0.5 rounded bg-blue-50 text-blue-600 text-[10px] font-medium">
                          {card.aiIndustry}
                        </span>
                      ) : (
                        <span className="text-zinc-300">—</span>
                      )}
                    </td>
                    <td className="px-4 py-2.5">
                      {regions.length > 0 ? (
                        <div className="flex flex-wrap gap-0.5">
                          {regions.map((r) => (
                            <span
                              key={r}
                              className="inline-flex px-1 py-0.5 rounded bg-zinc-100 text-zinc-500 text-[10px]"
                            >
                              {r}
                            </span>
                          ))}
                        </div>
                      ) : (
                        <span className="text-zinc-300">—</span>
                      )}
                    </td>
                    <td className="px-4 py-2.5">
                      {isOwned ? (
                        <div className="flex flex-wrap gap-1">
                          {card.wantsCollab && (
                            <span className="inline-flex px-1.5 py-0.5 rounded-full bg-emerald-50 text-emerald-600 text-[10px] font-medium border border-emerald-100">
                              コラボ
                            </span>
                          )}
                          {card.isOrdered && (
                            <span className="inline-flex px-1.5 py-0.5 rounded-full bg-blue-50 text-blue-600 text-[10px] font-medium border border-blue-100">
                              受注
                            </span>
                          )}
                          {card.isCompetitor && (
                            <span className="inline-flex px-1.5 py-0.5 rounded-full bg-red-50 text-red-600 text-[10px] font-medium border border-red-100">
                              競合
                            </span>
                          )}
                          {card.isCreator && (
                            <span className="inline-flex px-1.5 py-0.5 rounded-full bg-violet-50 text-violet-600 text-[10px] font-medium border border-violet-100">
                              制作
                            </span>
                          )}
                        </div>
                      ) : (
                        <span className="text-zinc-500">***</span>
                      )}
                    </td>
                    <td className="px-4 py-2.5 text-zinc-500 whitespace-nowrap">
                      {card.owner?.name ?? "—"}
                    </td>
                    <td className="px-4 py-2.5 text-zinc-400 whitespace-nowrap">
                      {card.exchangeDate
                        ? new Date(card.exchangeDate).toLocaleDateString("ja-JP")
                        : "—"}
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* ページネーション */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between px-4 py-3 border-t border-zinc-100">
          <p className="text-[11px] text-zinc-400">
            全{total.toLocaleString()}件中 {(page - 1) * 30 + 1}〜
            {Math.min(page * 30, total)}件
          </p>
          <div className="flex gap-1">
            {page > 1 && (
              <Link
                href={`${baseUrl}&page=${page - 1}`}
                className="px-2.5 py-1 text-[11px] rounded border border-zinc-200 text-zinc-600 hover:bg-zinc-50"
              >
                前へ
              </Link>
            )}
            {Array.from({ length: Math.min(totalPages, 7) }, (_, i) => {
              let p: number;
              if (totalPages <= 7) {
                p = i + 1;
              } else if (page <= 4) {
                p = i + 1;
              } else if (page >= totalPages - 3) {
                p = totalPages - 6 + i;
              } else {
                p = page - 3 + i;
              }
              return (
                <Link
                  key={p}
                  href={`${baseUrl}&page=${p}`}
                  className={`px-2.5 py-1 text-[11px] rounded border ${
                    p === page
                      ? "bg-blue-600 text-white border-blue-600"
                      : "border-zinc-200 text-zinc-600 hover:bg-zinc-50"
                  }`}
                >
                  {p}
                </Link>
              );
            })}
            {page < totalPages && (
              <Link
                href={`${baseUrl}&page=${page + 1}`}
                className="px-2.5 py-1 text-[11px] rounded border border-zinc-200 text-zinc-600 hover:bg-zinc-50"
              >
                次へ
              </Link>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
