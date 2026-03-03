"use client";

import { useRouter, usePathname, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { Search, X } from "lucide-react";
import { cn } from "@/lib/utils";

const RESULT_OPTIONS = [
  { value: "", label: "すべて" },
  { value: "success", label: "成功" },
  { value: "failed", label: "失敗" },
];

export function LoginLogSearch() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const [query, setQuery] = useState(searchParams.get("q") ?? "");

  const updateParam = useCallback(
    (key: string, value: string) => {
      const params = new URLSearchParams(searchParams.toString());
      if (value) {
        params.set(key, value);
      } else {
        params.delete(key);
      }
      params.delete("page");
      router.replace(`${pathname}?${params.toString()}`);
    },
    [router, pathname, searchParams],
  );

  // デバウンス検索
  useEffect(() => {
    const timer = setTimeout(() => {
      updateParam("q", query);
    }, 350);
    return () => clearTimeout(timer);
  }, [query, updateParam]);

  const activeResult = searchParams.get("result") ?? "";
  const hasFilter = !!(query || activeResult);

  const clearAll = () => {
    setQuery("");
    router.replace(pathname);
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-3">
        {/* テキスト検索 */}
        <div className="relative flex-1 max-w-xs">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-zinc-400" />
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="メールアドレスで検索..."
            className="w-full pl-8 pr-3 py-1.5 text-xs border border-zinc-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-blue-500"
          />
        </div>

        {/* 結果フィルター */}
        <div className="flex items-center gap-1">
          {RESULT_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              onClick={() => updateParam("result", opt.value)}
              className={cn(
                "px-2.5 py-1 rounded-md text-xs font-medium transition-colors",
                activeResult === opt.value
                  ? "bg-blue-600 text-white"
                  : "bg-zinc-100 text-zinc-600 hover:bg-zinc-200",
              )}
            >
              {opt.label}
            </button>
          ))}
        </div>

        {/* クリア */}
        {hasFilter && (
          <button
            onClick={clearAll}
            className="flex items-center gap-1 text-xs text-zinc-500 hover:text-zinc-700"
          >
            <X className="w-3 h-3" />
            クリア
          </button>
        )}
      </div>
    </div>
  );
}
