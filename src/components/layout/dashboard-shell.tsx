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
  contractDaysLeft?: number | null;
  children: React.ReactNode;
}

export function DashboardShell({ user, reportWarning, isActive = true, contractDaysLeft, children }: Props) {
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
    <div className="flex h-screen overflow-hidden bg-[#fafbfe] relative">
      {/* Ambient background glow */}
      <div className="pointer-events-none absolute -top-[200px] -right-[200px] w-[800px] h-[800px] bg-[radial-gradient(circle,rgba(99,102,241,0.06)_0%,rgba(6,182,212,0.03)_40%,transparent_70%)]" />
      <div className="pointer-events-none absolute -bottom-[300px] -left-[100px] w-[600px] h-[600px] bg-[radial-gradient(circle,rgba(16,185,129,0.04)_0%,transparent_60%)]" />
      <Sidebar user={user} isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} reportWarning={reportWarning} isSuspended={!isActive} />
      <div className="flex-1 flex flex-col overflow-hidden min-w-0 relative z-[1]">
        <Header
          pageTitle="ダッシュボード"
          user={user}
          onMenuOpen={() => setSidebarOpen(true)}
          onSearchOpen={() => setSearchOpen(true)}
        />
        <main className="flex-1 overflow-y-auto">
          {!isActive && <SuspendedBanner />}
          {contractDaysLeft !== null && contractDaysLeft !== undefined && contractDaysLeft > 0 && contractDaysLeft <= 90 && (
            <ContractRenewalBanner daysLeft={contractDaysLeft} />
          )}
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

function ContractRenewalBanner({ daysLeft }: { daysLeft: number }) {
  const isUrgent = daysLeft <= 30;
  const isWarning = daysLeft <= 60;

  const bgCls = isUrgent
    ? "from-red-50 to-orange-50 border-red-200"
    : isWarning
    ? "from-orange-50 to-amber-50 border-orange-200"
    : "from-amber-50 to-yellow-50 border-amber-200";

  const iconBg = isUrgent ? "bg-red-100" : isWarning ? "bg-orange-100" : "bg-amber-100";
  const iconColor = isUrgent ? "text-red-600" : isWarning ? "text-orange-600" : "text-amber-600";
  const titleColor = isUrgent ? "text-red-800" : isWarning ? "text-orange-800" : "text-amber-800";
  const textColor = isUrgent ? "text-red-700/80" : isWarning ? "text-orange-700/80" : "text-amber-700/80";

  const title = isUrgent
    ? `契約満了まであと${daysLeft}日です`
    : isWarning
    ? "契約更新の手続きをお願いします"
    : "契約更新が近づいています";

  const message = isUrgent
    ? "契約期間が間もなく満了します。更新されない場合、満了日をもってAd Arch OSの全機能がご利用いただけなくなります。"
    : "契約の更新時期が近づいています。更新についてはGoogle Chatまたはメールにて本部にお問い合わせください。";

  return (
    <div className={`mx-4 mt-4 p-4 rounded-xl bg-gradient-to-r ${bgCls}`}>
      <div className="flex items-start gap-3">
        <div className={`w-10 h-10 rounded-lg ${iconBg} flex items-center justify-center flex-shrink-0`}>
          <AlertTriangle className={`w-5 h-5 ${iconColor}`} />
        </div>
        <div className="flex-1 min-w-0">
          <h3 className={`text-sm font-bold ${titleColor}`}>{title}</h3>
          <p className={`text-sm ${textColor} mt-1`}>{message}</p>
        </div>
      </div>
    </div>
  );
}
