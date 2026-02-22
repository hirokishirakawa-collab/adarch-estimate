"use client";

import { useRouter } from "next/navigation";
import { Archive } from "lucide-react";

interface ArchiveToggleProps {
  showArchived: boolean;
  archivedCount: number;
}

export function ArchiveToggle({ showArchived, archivedCount }: ArchiveToggleProps) {
  const router = useRouter();

  function toggle() {
    router.replace(showArchived ? "/dashboard/deals" : "/dashboard/deals?showArchived=true");
  }

  return (
    <button
      onClick={toggle}
      className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg border transition-colors ${
        showArchived
          ? "bg-zinc-800 text-white border-zinc-700"
          : "bg-white text-zinc-500 border-zinc-200 hover:border-zinc-300 hover:text-zinc-700"
      }`}
    >
      <Archive className="w-3.5 h-3.5" />
      アーカイブを表示
      {archivedCount > 0 && (
        <span
          className={`text-[10px] px-1.5 py-0.5 rounded-full leading-none ${
            showArchived
              ? "bg-zinc-600 text-zinc-300"
              : "bg-zinc-100 text-zinc-500"
          }`}
        >
          {archivedCount}
        </span>
      )}
    </button>
  );
}
