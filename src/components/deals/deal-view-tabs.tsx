"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { LayoutGrid, List } from "lucide-react";

export function DealViewTabs() {
  const pathname = usePathname();

  const tabs = [
    {
      href: "/dashboard/deals",
      label: "ボード",
      icon: LayoutGrid,
      active: pathname === "/dashboard/deals",
    },
    {
      href: "/dashboard/deals/list",
      label: "リスト",
      icon: List,
      active: pathname === "/dashboard/deals/list",
    },
  ];

  return (
    <div className="flex items-center gap-0.5 bg-zinc-100 rounded-lg p-0.5">
      {tabs.map((tab) => (
        <Link
          key={tab.href}
          href={tab.href}
          className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-colors
            ${
              tab.active
                ? "bg-white text-zinc-900 shadow-sm"
                : "text-zinc-500 hover:text-zinc-700"
            }`}
        >
          <tab.icon className="w-3.5 h-3.5" />
          {tab.label}
        </Link>
      ))}
    </div>
  );
}
