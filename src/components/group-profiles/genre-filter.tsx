"use client";

import Link from "next/link";
import { cn } from "@/lib/utils";
import { GENRE_OPTIONS } from "@/lib/constants/group-profile";

interface GenreFilterProps {
  current: string | null;
}

export function GenreFilter({ current }: GenreFilterProps) {
  const baseCls =
    "px-3 py-1 text-xs font-medium rounded-full border transition-colors";

  return (
    <div className="flex items-center gap-2 mb-5 flex-wrap">
      <Link
        href="/dashboard/group-profiles"
        className={cn(
          baseCls,
          !current
            ? "bg-zinc-800 text-white border-zinc-800"
            : "bg-white text-zinc-600 border-zinc-200 hover:bg-zinc-50"
        )}
      >
        すべて
      </Link>
      {GENRE_OPTIONS.map((g) => (
        <Link
          key={g.value}
          href={`/dashboard/group-profiles?genre=${encodeURIComponent(g.value)}`}
          className={cn(
            baseCls,
            current === g.value
              ? "bg-zinc-800 text-white border-zinc-800"
              : `bg-white border-zinc-200 hover:bg-zinc-50 ${g.color.split(" ")[1] ?? "text-zinc-600"}`
          )}
        >
          {g.label}
        </Link>
      ))}
    </div>
  );
}
