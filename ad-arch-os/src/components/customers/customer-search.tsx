"use client";

import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { useCallback } from "react";
import { Search, X } from "lucide-react";
import { BRANCH_MAP } from "@/lib/data/customers";
import { cn } from "@/lib/utils";

export function CustomerSearch() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const currentQuery = searchParams.get("q") ?? "";
  const currentBranch = searchParams.get("branch") ?? "";

  const updateParams = useCallback(
    (key: string, value: string) => {
      const params = new URLSearchParams(searchParams.toString());
      if (value) {
        params.set(key, value);
      } else {
        params.delete(key);
      }
      router.replace(`${pathname}?${params.toString()}`);
    },
    [router, pathname, searchParams]
  );

  const clearAll = () => {
    router.replace(pathname);
  };

  const hasFilter = currentQuery || currentBranch;

  return (
    <div className="flex flex-col sm:flex-row gap-2">
      {/* テキスト検索 */}
      <div className="relative flex-1">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-400" />
        <input
          type="text"
          placeholder="顧客名・担当者名で検索..."
          defaultValue={currentQuery}
          onChange={(e) => updateParams("q", e.target.value)}
          className="w-full pl-9 pr-4 py-2 text-sm bg-white border border-zinc-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent placeholder:text-zinc-400"
        />
      </div>

      {/* 拠点フィルター */}
      <select
        value={currentBranch}
        onChange={(e) => updateParams("branch", e.target.value)}
        className="px-3 py-2 text-sm bg-white border border-zinc-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-zinc-700"
      >
        <option value="">全拠点</option>
        {Object.values(BRANCH_MAP).map((b) => (
          <option key={b.id} value={b.id}>
            {b.name}
          </option>
        ))}
      </select>

      {/* クリアボタン */}
      {hasFilter && (
        <button
          onClick={clearAll}
          className={cn(
            "flex items-center gap-1.5 px-3 py-2 text-sm rounded-lg",
            "bg-zinc-100 text-zinc-600 hover:bg-zinc-200 transition-colors"
          )}
        >
          <X className="w-3.5 h-3.5" />
          クリア
        </button>
      )}
    </div>
  );
}
