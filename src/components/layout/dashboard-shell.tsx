"use client";
import { useState, useEffect } from "react";
import { Sidebar } from "@/components/layout/sidebar";
import { Header } from "@/components/layout/header";
import { GlobalSearch } from "@/components/layout/global-search";
import { TourGuide, TourHelpButton } from "@/components/onboarding/tour-guide";
import type { UserRole } from "@/types/roles";

interface Props {
  user: { name: string | null; email: string | null; image: string | null; role: UserRole; enabledFeatures?: string[] };
  reportWarning?: "yellow" | "red" | null;
  children: React.ReactNode;
}

export function DashboardShell({ user, reportWarning, children }: Props) {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);

  // ⌘K / Ctrl+K でグローバル検索を開く
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        setSearchOpen(true);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  return (
    <div className="flex h-screen overflow-hidden bg-zinc-950">
      <Sidebar user={user} isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} reportWarning={reportWarning} />
      <div className="flex-1 flex flex-col overflow-hidden bg-zinc-50 min-w-0">
        <Header
          pageTitle="ダッシュボード"
          user={user}
          onMenuOpen={() => setSidebarOpen(true)}
          onSearchOpen={() => setSearchOpen(true)}
        />
        <main className="flex-1 overflow-y-auto">{children}</main>
      </div>
      <GlobalSearch open={searchOpen} onClose={() => setSearchOpen(false)} />
      <TourGuide />
      <TourHelpButton />
    </div>
  );
}
