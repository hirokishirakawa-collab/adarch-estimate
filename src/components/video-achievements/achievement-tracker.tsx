"use client";

import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { useTransition, useCallback } from "react";
import { AiTalkModal } from "./ai-talk-modal";
import { deleteVideoAchievement, startAttackFromAchievement } from "@/lib/actions/video-achievement";
import { VIDEO_TYPE_OPTIONS, VIDEO_ACHIEVEMENT_INDUSTRY_OPTIONS } from "@/lib/constants/video-achievements";
import { PREFECTURES } from "@/lib/constants/crm";
import { Trash2, Crosshair, CheckCircle2 } from "lucide-react";
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
  isProcessed:       boolean;
  createdAt:         Date;
}

interface Props {
  achievements: Achievement[];
  role:         UserRole;
}

export function AchievementTracker({ achievements, role }: Props) {
  const router     = useRouter();
  const pathname   = usePathname();
  const searchParams = useSearchParams();
  const [isPending, startTransition] = useTransition();

  const updateFilter = useCallback(
    (key: string, value: string) => {
      const params = new URLSearchParams(searchParams.toString());
      if (value) params.set(key, value);
      else params.delete(key);
      router.replace(`${pathname}?${params.toString()}`);
    },
    [router, pathname, searchParams]
  );

  const handleDelete = (id: string) => {
    if (!confirm("この実績データを削除しますか？")) return;
    startTransition(async () => {
      const res = await deleteVideoAchievement(id);
      if (res.error) alert(res.error);
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

  const videoTypeLabel = (val: string) =>
    VIDEO_TYPE_OPTIONS.find((o) => o.value === val)?.label ?? val;

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

      {/* カウント */}
      <p className="text-xs text-zinc-500">
        {achievements.length} 件
      </p>

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
                <th className="text-left px-4 py-2.5 font-medium text-zinc-600 whitespace-nowrap">企業名</th>
                <th className="text-left px-4 py-2.5 font-medium text-zinc-600 whitespace-nowrap">都道府県</th>
                <th className="text-left px-4 py-2.5 font-medium text-zinc-600 whitespace-nowrap">業種</th>
                <th className="text-left px-4 py-2.5 font-medium text-zinc-600 whitespace-nowrap">動画種別</th>
                <th className="text-left px-4 py-2.5 font-medium text-zinc-600 whitespace-nowrap">競合制作会社</th>
                <th className="text-left px-4 py-2.5 font-medium text-zinc-600 whitespace-nowrap">ステータス</th>
                <th className="px-4 py-2.5 font-medium text-zinc-600 whitespace-nowrap">操作</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100">
              {achievements.map((a) => (
                <tr key={a.id} className="hover:bg-zinc-50 transition-colors">
                  {/* 企業名 → AiTalkModal トリガー */}
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
    </div>
  );
}
