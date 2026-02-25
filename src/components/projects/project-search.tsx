"use client";

import { useRouter, usePathname, useSearchParams } from "next/navigation";
import { useCallback } from "react";
import { Search, X } from "lucide-react";
import { PROJECT_STATUS_OPTIONS } from "@/lib/constants/projects";
import { cn } from "@/lib/utils";

export function ProjectSearch() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const currentQuery   = searchParams.get("q")       ?? "";
  const currentStatus  = searchParams.get("status")  ?? "";
  const currentOverdue = searchParams.get("overdue") ?? "";

  const update = useCallback(
    (key: string, value: string) => {
      const params = new URLSearchParams(searchParams.toString());
      if (value) {
        params.set(key, value);
      } else {
        params.delete(key);
      }
      params.delete("page"); // フィルタ変更時は1ページ目へ
      router.replace(`${pathname}?${params.toString()}`);
    },
    [router, pathname, searchParams]
  );

  const hasFilters = currentQuery || currentStatus || currentOverdue;

  return (
    <div className="flex flex-wrap items-center gap-2">
      {/* テキスト検索 */}
      <div className="relative">
        <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-zinc-400 pointer-events-none" />
        <input
          type="text"
          placeholder="プロジェクト名で検索…"
          defaultValue={currentQuery}
          onChange={(e) => {
            const timer = setTimeout(() => update("q", e.target.value.trim()), 400);
            return () => clearTimeout(timer);
          }}
          className="pl-8 pr-3 py-1.5 text-xs border border-zinc-200 rounded-lg bg-white text-zinc-700 placeholder:text-zinc-400 focus:outline-none focus:ring-2 focus:ring-blue-500/30 w-52"
        />
      </div>

      {/* ステータスフィルタ */}
      <div className="flex items-center gap-1 flex-wrap">
        <button
          onClick={() => update("status", "")}
          className={cn(
            "px-2.5 py-1 text-xs rounded-full border transition-colors",
            !currentStatus && !currentOverdue
              ? "bg-zinc-800 text-white border-zinc-700"
              : "bg-white text-zinc-500 border-zinc-200 hover:border-zinc-400"
          )}
        >
          すべて
        </button>
        {PROJECT_STATUS_OPTIONS.map((opt) => (
          <button
            key={opt.value}
            onClick={() => {
              const params = new URLSearchParams(searchParams.toString());
              params.delete("overdue");
              params.delete("page");
              if (currentStatus === opt.value) {
                params.delete("status");
              } else {
                params.set("status", opt.value);
              }
              router.replace(`${pathname}?${params.toString()}`);
            }}
            className={cn(
              "px-2.5 py-1 text-xs rounded-full border transition-colors",
              currentStatus === opt.value && !currentOverdue
                ? "bg-zinc-800 text-white border-zinc-700"
                : "bg-white text-zinc-500 border-zinc-200 hover:border-zinc-400"
            )}
          >
            {opt.icon} {opt.label}
          </button>
        ))}
        {/* 期限超過フィルタ */}
        <button
          onClick={() => {
            const params = new URLSearchParams(searchParams.toString());
            params.delete("status");
            params.delete("page");
            if (currentOverdue) {
              params.delete("overdue");
            } else {
              params.set("overdue", "1");
            }
            router.replace(`${pathname}?${params.toString()}`);
          }}
          className={cn(
            "px-2.5 py-1 text-xs rounded-full border transition-colors",
            currentOverdue
              ? "bg-red-600 text-white border-red-600"
              : "bg-white text-red-500 border-red-200 hover:border-red-400"
          )}
        >
          🔴 期限超過
        </button>
      </div>

      {/* クリア */}
      {hasFilters && (
        <button
          onClick={() => {
            const params = new URLSearchParams();
            router.replace(`${pathname}?${params.toString()}`);
          }}
          className="flex items-center gap-1 text-xs text-zinc-400 hover:text-zinc-700 transition-colors"
        >
          <X className="w-3.5 h-3.5" />
          クリア
        </button>
      )}
    </div>
  );
}
