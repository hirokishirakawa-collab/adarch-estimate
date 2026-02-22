"use client";

import { useRouter, usePathname, useSearchParams } from "next/navigation";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";

interface Props {
  currentPage: number;
  totalPages: number;
  total: number;
  perPage: number;
}

export function CustomerPagination({
  currentPage,
  totalPages,
  total,
  perPage,
}: Props) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const goTo = (page: number) => {
    const params = new URLSearchParams(searchParams.toString());
    if (page === 1) {
      params.delete("page");
    } else {
      params.set("page", String(page));
    }
    router.replace(`${pathname}?${params.toString()}`);
  };

  // 表示するページ番号の配列を生成（最大7件、省略あり）
  const getPages = (): (number | "...")[] => {
    if (totalPages <= 7) {
      return Array.from({ length: totalPages }, (_, i) => i + 1);
    }
    const pages: (number | "...")[] = [1];
    if (currentPage > 3) pages.push("...");
    for (
      let i = Math.max(2, currentPage - 1);
      i <= Math.min(totalPages - 1, currentPage + 1);
      i++
    ) {
      pages.push(i);
    }
    if (currentPage < totalPages - 2) pages.push("...");
    pages.push(totalPages);
    return pages;
  };

  const from = (currentPage - 1) * perPage + 1;
  const to = Math.min(currentPage * perPage, total);

  return (
    <div className="flex items-center justify-between py-2">
      <p className="text-xs text-zinc-500">
        全 {total.toLocaleString()} 件中{" "}
        <span className="font-medium text-zinc-700">
          {from}–{to}
        </span>{" "}
        件を表示
      </p>

      <div className="flex items-center gap-1">
        {/* 前へ */}
        <button
          onClick={() => goTo(currentPage - 1)}
          disabled={currentPage === 1}
          className={cn(
            "flex items-center justify-center w-8 h-8 rounded-lg text-sm transition-colors",
            currentPage === 1
              ? "text-zinc-300 cursor-not-allowed"
              : "text-zinc-600 hover:bg-zinc-100"
          )}
        >
          <ChevronLeft className="w-4 h-4" />
        </button>

        {/* ページ番号 */}
        {getPages().map((p, i) =>
          p === "..." ? (
            <span
              key={`ellipsis-${i}`}
              className="w-8 h-8 flex items-center justify-center text-xs text-zinc-400"
            >
              …
            </span>
          ) : (
            <button
              key={p}
              onClick={() => goTo(p as number)}
              className={cn(
                "w-8 h-8 rounded-lg text-xs font-medium transition-colors",
                p === currentPage
                  ? "bg-blue-600 text-white"
                  : "text-zinc-600 hover:bg-zinc-100"
              )}
            >
              {p}
            </button>
          )
        )}

        {/* 次へ */}
        <button
          onClick={() => goTo(currentPage + 1)}
          disabled={currentPage === totalPages}
          className={cn(
            "flex items-center justify-center w-8 h-8 rounded-lg text-sm transition-colors",
            currentPage === totalPages
              ? "text-zinc-300 cursor-not-allowed"
              : "text-zinc-600 hover:bg-zinc-100"
          )}
        >
          <ChevronRight className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}
