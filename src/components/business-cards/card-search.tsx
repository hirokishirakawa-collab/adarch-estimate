"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useCallback, useTransition } from "react";
import { Search } from "lucide-react";
import { REGION_OPTIONS, INDUSTRY_OPTIONS } from "@/lib/constants/business-cards";

export function CardSearch() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [, startTransition] = useTransition();

  const updateParams = useCallback(
    (key: string, value: string) => {
      const params = new URLSearchParams(searchParams.toString());
      if (value) {
        params.set(key, value);
      } else {
        params.delete(key);
      }
      params.delete("page"); // 検索条件変更時は1ページ目に
      startTransition(() => {
        router.push(`/dashboard/business-cards?${params.toString()}`);
      });
    },
    [router, searchParams, startTransition]
  );

  return (
    <div className="bg-white rounded-xl border border-zinc-200 p-4">
      <div className="flex flex-wrap gap-3">
        {/* テキスト検索 */}
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-zinc-400" />
          <input
            type="text"
            placeholder="会社名・氏名で検索..."
            defaultValue={searchParams.get("q") ?? ""}
            onChange={(e) => updateParams("q", e.target.value)}
            className="w-full pl-9 pr-3 py-2 text-xs border border-zinc-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400"
          />
        </div>

        {/* 業界フィルタ */}
        <select
          defaultValue={searchParams.get("industry") ?? ""}
          onChange={(e) => updateParams("industry", e.target.value)}
          className="px-3 py-2 text-xs border border-zinc-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20"
        >
          <option value="">業界: すべて</option>
          {INDUSTRY_OPTIONS.map((ind) => (
            <option key={ind} value={ind}>
              {ind}
            </option>
          ))}
        </select>

        {/* 地域フィルタ */}
        <select
          defaultValue={searchParams.get("region") ?? ""}
          onChange={(e) => updateParams("region", e.target.value)}
          className="px-3 py-2 text-xs border border-zinc-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20"
        >
          <option value="">地域: すべて</option>
          {REGION_OPTIONS.map((r) => (
            <option key={r.value} value={r.value}>
              {r.label}
            </option>
          ))}
        </select>

        {/* コラボ希望フィルタ */}
        <select
          defaultValue={searchParams.get("collab") ?? ""}
          onChange={(e) => updateParams("collab", e.target.value)}
          className="px-3 py-2 text-xs border border-zinc-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20"
        >
          <option value="">コラボ: すべて</option>
          <option value="1">希望あり</option>
          <option value="0">希望なし</option>
        </select>

        {/* 競合フィルタ */}
        <select
          defaultValue={searchParams.get("competitor") ?? ""}
          onChange={(e) => updateParams("competitor", e.target.value)}
          className="px-3 py-2 text-xs border border-zinc-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20"
        >
          <option value="">競合: すべて</option>
          <option value="1">競合のみ</option>
          <option value="0">競合以外</option>
        </select>
      </div>
    </div>
  );
}
