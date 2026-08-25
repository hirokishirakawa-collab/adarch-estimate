"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

const TABS = [
  { seg: "", label: "友だち・チャット" },
  { seg: "/scenarios", label: "ステップ配信" },
  { seg: "/broadcasts", label: "一斉配信" },
  { seg: "/settings", label: "設定" },
];

export function AccountNav({ accountId }: { accountId: string }) {
  const path = usePathname();
  const root = `/dashboard/line/${accountId}`;
  return (
    <nav className="flex items-center gap-1 border-b border-zinc-200">
      {TABS.map((t) => {
        const href = `${root}${t.seg}`;
        const active = t.seg === "" ? path === root || path.startsWith(`${root}/chat`) : path.startsWith(href);
        return (
          <Link
            key={t.seg}
            href={href}
            className={cn(
              "px-3 py-2 text-xs font-medium border-b-2 -mb-px transition-colors",
              active ? "border-emerald-600 text-emerald-700" : "border-transparent text-zinc-500 hover:text-zinc-800",
            )}
          >
            {t.label}
          </Link>
        );
      })}
    </nav>
  );
}
