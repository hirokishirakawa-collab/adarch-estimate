"use client";

import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { Search, X } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  CUSTOMER_RANK_OPTIONS,
  CUSTOMER_STATUS_OPTIONS,
  PREFECTURES,
} from "@/lib/constants/crm";

export function CustomerSearch() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const currentQ          = searchParams.get("q") ?? "";
  const currentRank       = searchParams.get("rank") ?? "";
  const currentPrefecture = searchParams.get("prefecture") ?? "";
  const currentStatus     = searchParams.get("status") ?? "";

  // テキスト検索はローカル state でデバウンス
  const [inputValue, setInputValue] = useState(currentQ);

  const updateParam = useCallback(
    (key: string, value: string) => {
      const params = new URLSearchParams(searchParams.toString());
      if (value) {
        params.set(key, value);
      } else {
        params.delete(key);
      }
      // フィルタ変更時はページをリセット
      params.delete("page");
      router.replace(`${pathname}?${params.toString()}`);
    },
    [router, pathname, searchParams]
  );

  // 検索テキストをデバウンス（350ms）
  useEffect(() => {
    const t = setTimeout(() => updateParam("q", inputValue), 350);
    return () => clearTimeout(t);
  }, [inputValue]); // eslint-disable-line react-hooks/exhaustive-deps

  const clearAll = () => {
    setInputValue("");
    router.replace(pathname);
  };

  const hasFilter = currentQ || currentRank || currentPrefecture || currentStatus;
  const activeFilterCount = [currentQ, currentRank, currentPrefecture, currentStatus].filter(Boolean).length;

  return (
    <div className="space-y-2">
      {/* 検索バー */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-400" />
        <input
          type="text"
          value={inputValue}
          onChange={(e) => setInputValue(e.target.value)}
          placeholder="会社名・フリガナ・担当者名で検索..."
          className="w-full pl-9 pr-4 py-2.5 text-sm bg-white border border-zinc-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent placeholder:text-zinc-400"
        />
        {inputValue && (
          <button
            onClick={() => setInputValue("")}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-zinc-600"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        )}
      </div>

      {/* フィルター行 */}
      <div className="flex flex-wrap items-center gap-2">
        {/* 顧客ランク（ピルボタン） */}
        <div className="flex items-center gap-1.5">
          <span className="text-[11px] text-zinc-500 font-medium">ランク</span>
          <div className="flex gap-1">
            {CUSTOMER_RANK_OPTIONS.map((opt) => (
              <button
                key={opt.value}
                type="button"
                onClick={() =>
                  updateParam("rank", currentRank === opt.value ? "" : opt.value)
                }
                className={cn(
                  "px-2.5 py-1 rounded-full text-xs font-bold border transition-all",
                  currentRank === opt.value
                    ? cn(opt.className, "shadow-sm")
                    : "bg-white text-zinc-400 border-zinc-200 hover:border-zinc-300 hover:text-zinc-600"
                )}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>

        <div className="h-4 w-px bg-zinc-200" />

        {/* 都道府県 */}
        <div className="flex items-center gap-1.5">
          <span className="text-[11px] text-zinc-500 font-medium">都道府県</span>
          <div className="relative">
            <select
              value={currentPrefecture}
              onChange={(e) => updateParam("prefecture", e.target.value)}
              className={cn(
                "pl-2.5 pr-7 py-1.5 text-xs border rounded-lg appearance-none focus:outline-none focus:ring-2 focus:ring-blue-500 transition-colors",
                currentPrefecture
                  ? "bg-blue-50 border-blue-300 text-blue-700 font-medium"
                  : "bg-white border-zinc-200 text-zinc-600"
              )}
            >
              <option value="">全都道府県</option>
              {PREFECTURES.map((pref) => (
                <option key={pref} value={pref}>
                  {pref}
                </option>
              ))}
            </select>
            <span className="absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none text-zinc-400 text-[10px]">
              ▾
            </span>
          </div>
        </div>

        <div className="h-4 w-px bg-zinc-200" />

        {/* 取引ステータス */}
        <div className="flex items-center gap-1.5">
          <span className="text-[11px] text-zinc-500 font-medium">ステータス</span>
          <div className="relative">
            <select
              value={currentStatus}
              onChange={(e) => updateParam("status", e.target.value)}
              className={cn(
                "pl-2.5 pr-7 py-1.5 text-xs border rounded-lg appearance-none focus:outline-none focus:ring-2 focus:ring-blue-500 transition-colors",
                currentStatus
                  ? "bg-blue-50 border-blue-300 text-blue-700 font-medium"
                  : "bg-white border-zinc-200 text-zinc-600"
              )}
            >
              <option value="">全ステータス</option>
              {CUSTOMER_STATUS_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
            <span className="absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none text-zinc-400 text-[10px]">
              ▾
            </span>
          </div>
        </div>

        {/* クリアボタン */}
        {hasFilter && (
          <>
            <div className="h-4 w-px bg-zinc-200" />
            <button
              onClick={clearAll}
              className="flex items-center gap-1 px-3 py-1.5 text-xs rounded-lg bg-zinc-100 text-zinc-600 hover:bg-zinc-200 transition-colors"
            >
              <X className="w-3 h-3" />
              クリア
              {activeFilterCount > 1 && (
                <span className="ml-0.5 w-4 h-4 bg-zinc-400 text-white rounded-full text-[10px] flex items-center justify-center font-bold">
                  {activeFilterCount}
                </span>
              )}
            </button>
          </>
        )}
      </div>
    </div>
  );
}
