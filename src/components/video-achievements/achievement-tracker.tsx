"use client";

import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { useTransition, useCallback, useState } from "react";
import { AiTalkModal } from "./ai-talk-modal";
import { deleteVideoAchievement, bulkDeleteVideoAchievements, startAttackFromAchievement } from "@/lib/actions/video-achievement";
import { VIDEO_TYPE_OPTIONS, VIDEO_ACHIEVEMENT_INDUSTRY_OPTIONS } from "@/lib/constants/video-achievements";
import { PREFECTURES } from "@/lib/constants/crm";
import { Trash2, Crosshair, CheckCircle2, ChevronLeft, ChevronRight } from "lucide-react";
import type { UserRole } from "@/types/roles";

interface Achievement {
  id:                string;
  companyName:       string;
  prefecture:        string;
  industry:          string;
  videoType:         string;
  productionCompany: string;
  referenceUrl:      string | null;
  contentSummary:    string | null;
  publishedAt:       string | null;
  isProcessed:       boolean;
  createdAt:         Date;
}

interface Props {
  achievements: Achievement[];
  role:         UserRole;
  currentPage:  number;
  totalPages:   number;
  totalCount:   number;
}

export function AchievementTracker({ achievements, role, currentPage, totalPages, totalCount }: Props) {
  const router     = useRouter();
  const pathname   = usePathname();
  const searchParams = useSearchParams();
  const [isPending, startTransition] = useTransition();
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  const updateFilter = useCallback(
    (key: string, value: string) => {
      const params = new URLSearchParams(searchParams.toString());
      if (value) params.set(key, value);
      else params.delete(key);
      // フィルター変更時はページを1に戻す
      params.delete("page");
      router.replace(`${pathname}?${params.toString()}`);
    },
    [router, pathname, searchParams]
  );

  const goToPage = useCallback(
    (page: number) => {
      const params = new URLSearchParams(searchParams.toString());
      if (page <= 1) params.delete("page");
      else params.set("page", String(page));
      router.replace(`${pathname}?${params.toString()}`);
    },
    [router, pathname, searchParams]
  );

  const handleDelete = (id: string) => {
    if (!confirm("この実績データを削除しますか？")) return;
    startTransition(async () => {
      const res = await deleteVideoAchievement(id);
      if (res.error) alert(res.error);
      setSelectedIds((prev) => { const next = new Set(prev); next.delete(id); return next; });
    });
  };

  const handleBulkDelete = () => {
    if (selectedIds.size === 0) return;
    if (!confirm(`選択した ${selectedIds.size} 件を削除しますか？`)) return;
    startTransition(async () => {
      const res = await bulkDeleteVideoAchievements(Array.from(selectedIds));
      if (res.error) {
        alert(res.error);
        return;
      }
      alert(`${res.deleted} 件を削除しました`);
      setSelectedIds(new Set());
    });
  };

  const handleAttack = (id: string, companyName: string) => {
    startTransition(async () => {
      const res = await startAttackFromAchievement(id);
      if (res.error) {
        alert(res.error);
        return;
      }
      const msg = res.isNewCustomer
        ? `${companyName} を新規顧客として登録し、攻略商談を作成しました！`
        : `${companyName} の攻略商談を作成しました！`;
      alert(msg);
      router.push("/dashboard/deals");
    });
  };

  const toggleSelect = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleSelectAll = () => {
    if (selectedIds.size === achievements.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(achievements.map((a) => a.id)));
    }
  };

  const videoTypeLabel = (val: string) =>
    VIDEO_TYPE_OPTIONS.find((o) => o.value === val)?.label ?? val;

  const allSelected = achievements.length > 0 && selectedIds.size === achievements.length;

  return (
    <div className="space-y-4">
      {/* フィルター */}
      <div className="flex flex-wrap gap-3">
        <select
          defaultValue={searchParams.get("prefecture") ?? ""}
          onChange={(e) => updateFilter("prefecture", e.target.value)}
          className="text-xs border border-zinc-200 rounded-lg px-2.5 py-1.5 focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
        >
          <option value="">すべての都道府県</option>
          {PREFECTURES.map((p) => (
            <option key={p} value={p}>{p}</option>
          ))}
        </select>

        <select
          defaultValue={searchParams.get("industry") ?? ""}
          onChange={(e) => updateFilter("industry", e.target.value)}
          className="text-xs border border-zinc-200 rounded-lg px-2.5 py-1.5 focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
        >
          <option value="">すべての業種</option>
          {VIDEO_ACHIEVEMENT_INDUSTRY_OPTIONS.map((ind) => (
            <option key={ind} value={ind}>{ind}</option>
          ))}
        </select>

        <input
          type="text"
          placeholder="制作会社で絞り込み"
          defaultValue={searchParams.get("productionCompany") ?? ""}
          onChange={(e) => updateFilter("productionCompany", e.target.value)}
          className="text-xs border border-zinc-200 rounded-lg px-2.5 py-1.5 focus:outline-none focus:ring-2 focus:ring-blue-500 w-44"
        />

        <select
          defaultValue={searchParams.get("isProcessed") ?? ""}
          onChange={(e) => updateFilter("isProcessed", e.target.value)}
          className="text-xs border border-zinc-200 rounded-lg px-2.5 py-1.5 focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
        >
          <option value="">すべて</option>
          <option value="false">未攻略のみ</option>
          <option value="true">攻略済みのみ</option>
        </select>
      </div>

      {/* カウント + 一括操作 */}
      <div className="flex items-center justify-between">
        <p className="text-xs text-zinc-500">
          全 {totalCount} 件中 {(currentPage - 1) * 50 + 1}〜{Math.min(currentPage * 50, totalCount)} 件表示
        </p>
        {role === "ADMIN" && selectedIds.size > 0 && (
          <button
            onClick={handleBulkDelete}
            disabled={isPending}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-red-600 text-white text-xs font-medium rounded-lg hover:bg-red-700 disabled:opacity-60 transition-colors"
          >
            <Trash2 className="w-3.5 h-3.5" />
            選択した {selectedIds.size} 件を削除
          </button>
        )}
      </div>

      {/* テーブル */}
      {achievements.length === 0 ? (
        <div className="text-center py-16 text-zinc-400 text-sm">
          実績データがありません
        </div>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-zinc-200">
          <table className="w-full text-xs">
            <thead>
              <tr className="bg-zinc-50 border-b border-zinc-200">
                {role === "ADMIN" && (
                  <th className="px-3 py-2.5 w-8">
                    <input
                      type="checkbox"
                      checked={allSelected}
                      onChange={toggleSelectAll}
                      className="rounded border-zinc-300 text-blue-600 focus:ring-blue-500"
                    />
                  </th>
                )}
                <th className="text-left px-4 py-2.5 font-medium text-zinc-600 whitespace-nowrap">企業名</th>
                <th className="text-left px-4 py-2.5 font-medium text-zinc-600 whitespace-nowrap">所在地</th>
                <th className="text-left px-4 py-2.5 font-medium text-zinc-600 whitespace-nowrap">業種</th>
                <th className="text-left px-4 py-2.5 font-medium text-zinc-600 whitespace-nowrap">動画種別</th>
                <th className="text-left px-4 py-2.5 font-medium text-zinc-600 whitespace-nowrap">競合制作会社</th>
                <th className="text-left px-4 py-2.5 font-medium text-zinc-600 whitespace-nowrap">掲載日</th>
                <th className="text-left px-4 py-2.5 font-medium text-zinc-600 whitespace-nowrap">ステータス</th>
                <th className="px-4 py-2.5 font-medium text-zinc-600 whitespace-nowrap">操作</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100">
              {achievements.map((a) => (
                <tr key={a.id} className={`hover:bg-zinc-50 transition-colors ${selectedIds.has(a.id) ? "bg-blue-50/50" : ""}`}>
                  {role === "ADMIN" && (
                    <td className="px-3 py-3">
                      <input
                        type="checkbox"
                        checked={selectedIds.has(a.id)}
                        onChange={() => toggleSelect(a.id)}
                        className="rounded border-zinc-300 text-blue-600 focus:ring-blue-500"
                      />
                    </td>
                  )}
                  {/* 企業名 */}
                  <td className="px-4 py-3 font-medium">
                    <AiTalkModal achievement={a} role={role} />
                  </td>
                  <td className="px-4 py-3 text-zinc-600 whitespace-nowrap">{a.prefecture}</td>
                  <td className="px-4 py-3 text-zinc-600 whitespace-nowrap">{a.industry}</td>
                  <td className="px-4 py-3 whitespace-nowrap">
                    <span className="inline-flex items-center px-2 py-0.5 rounded bg-blue-50 text-blue-700 border border-blue-100 text-[11px] font-medium">
                      {videoTypeLabel(a.videoType)}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-zinc-600 max-w-[180px] truncate">{a.productionCompany}</td>
                  <td className="px-4 py-3 text-zinc-500 whitespace-nowrap text-[11px]">{a.publishedAt ?? "—"}</td>
                  <td className="px-4 py-3 whitespace-nowrap">
                    {a.isProcessed ? (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-emerald-50 text-emerald-700 border border-emerald-100 text-[11px] font-medium">
                        <CheckCircle2 className="w-3 h-3" />
                        攻略済み
                      </span>
                    ) : (
                      <span className="inline-flex items-center px-2 py-0.5 rounded bg-zinc-100 text-zinc-500 border border-zinc-200 text-[11px]">
                        未攻略
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap">
                    <div className="flex items-center gap-2">
                      {!a.isProcessed && (
                        <button
                          onClick={() => handleAttack(a.id, a.companyName)}
                          disabled={isPending}
                          title="攻略開始"
                          className="inline-flex items-center gap-1 px-2.5 py-1 rounded bg-blue-600 hover:bg-blue-700 disabled:opacity-60 text-white text-[11px] font-medium transition-colors"
                        >
                          <Crosshair className="w-3 h-3" />
                          攻略開始
                        </button>
                      )}
                      {role === "ADMIN" && (
                        <button
                          onClick={() => handleDelete(a.id)}
                          disabled={isPending}
                          title="削除"
                          className="p-1 text-zinc-400 hover:text-red-500 disabled:opacity-60 transition-colors"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* ページネーション */}
      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-2 pt-2">
          <button
            onClick={() => goToPage(currentPage - 1)}
            disabled={currentPage <= 1}
            className="flex items-center gap-1 px-3 py-1.5 text-xs font-medium rounded-lg border border-zinc-200 bg-white hover:bg-zinc-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          >
            <ChevronLeft className="w-3.5 h-3.5" />
            前へ
          </button>

          {generatePageNumbers(currentPage, totalPages).map((p, i) =>
            p === "..." ? (
              <span key={`ellipsis-${i}`} className="px-1 text-xs text-zinc-400">...</span>
            ) : (
              <button
                key={p}
                onClick={() => goToPage(p as number)}
                className={`px-3 py-1.5 text-xs font-medium rounded-lg border transition-colors ${
                  p === currentPage
                    ? "bg-blue-600 text-white border-blue-600"
                    : "border-zinc-200 bg-white hover:bg-zinc-50 text-zinc-700"
                }`}
              >
                {p}
              </button>
            )
          )}

          <button
            onClick={() => goToPage(currentPage + 1)}
            disabled={currentPage >= totalPages}
            className="flex items-center gap-1 px-3 py-1.5 text-xs font-medium rounded-lg border border-zinc-200 bg-white hover:bg-zinc-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          >
            次へ
            <ChevronRight className="w-3.5 h-3.5" />
          </button>
        </div>
      )}
    </div>
  );
}

// ページ番号の表示ロジック（1 ... 3 4 [5] 6 7 ... 20）
function generatePageNumbers(current: number, total: number): (number | "...")[] {
  if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1);

  const pages: (number | "...")[] = [];

  if (current <= 4) {
    for (let i = 1; i <= 5; i++) pages.push(i);
    pages.push("...", total);
  } else if (current >= total - 3) {
    pages.push(1, "...");
    for (let i = total - 4; i <= total; i++) pages.push(i);
  } else {
    pages.push(1, "...");
    for (let i = current - 1; i <= current + 1; i++) pages.push(i);
    pages.push("...", total);
  }

  return pages;
}
