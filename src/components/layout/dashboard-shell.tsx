"use client";
import { useState, useEffect } from "react";
import Link from "next/link";
import { Sidebar } from "@/components/layout/sidebar";
import { Header } from "@/components/layout/header";
import { GlobalSearch } from "@/components/layout/global-search";
import { TourGuide, TourHelpButton } from "@/components/onboarding/tour-guide";
import { AlertTriangle } from "lucide-react";
import type { UserRole } from "@/types/roles";

interface Props {
  user: { name: string | null; email: string | null; image: string | null; role: UserRole; enabledFeatures?: string[] };
  reportWarning?: "yellow" | "red" | null;
  isActive?: boolean;
  children: React.ReactNode;
}

export function DashboardShell({ user, reportWarning, isActive = true, children }: Props) {
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
    <div className="flex h-screen overflow-hidden bg-[#1c1914]">
      <Sidebar user={user} isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} reportWarning={reportWarning} isSuspended={!isActive} />
      <div className="flex-1 flex flex-col overflow-hidden bg-zinc-50 min-w-0">
        <Header
          pageTitle="ダッシュボード"
          user={user}
          onMenuOpen={() => setSidebarOpen(true)}
          onSearchOpen={() => setSearchOpen(true)}
        />
        <main className="flex-1 overflow-y-auto">
          {!isActive && <SuspendedBanner />}
          {children}
        </main>
      </div>
      <GlobalSearch open={searchOpen} onClose={() => setSearchOpen(false)} />
      <TourGuide />
      <TourHelpButton />
    </div>
  );
}

function SuspendedBanner() {
  return (
    <div className="mx-4 mt-4 p-4 rounded-xl bg-gradient-to-r from-red-50 to-amber-50 border border-red-200">
      <div className="flex items-start gap-3">
        <div className="w-10 h-10 rounded-lg bg-red-100 flex items-center justify-center flex-shrink-0">
          <AlertTriangle className="w-5 h-5 text-red-600" />
        </div>
        <div className="flex-1 min-w-0">
          <h3 className="text-sm font-bold text-red-800">
            アカウントが制限されています
          </h3>
          <p className="text-sm text-red-700/80 mt-1">
            月次報告が未提出のため、アカウントが制限モードになっています。
            月次報告を提出すると、すべての機能が自動的に復旧します。
          </p>
          <Link
            href="/dashboard/sales-report/new"
            className="inline-flex items-center gap-1.5 mt-3 px-4 py-2 rounded-lg bg-red-600 text-white text-sm font-semibold hover:bg-red-700 transition-colors"
          >
            月次報告を提出する
          </Link>
        </div>
      </div>
    </div>
  );
}
