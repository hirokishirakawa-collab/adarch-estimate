"use client";
import { usePathname } from "next/navigation";
import { Menu, Search } from "lucide-react";
import { NotificationBell } from "./notification-bell";
import { PresenceBadge } from "@/components/office/presence-badge";
import { ArchKunToggle } from "@/components/chatbot/arch-kun-toggle";
import {
  ReportBranchSwitch,
  type ReportBranches,
} from "./report-branch-switch";
import { navigationForPath } from "@/lib/navigation/catalog";
import { AiWorkButton } from "@/components/workspace/ai-work-button";
import type { UserRole } from "@/types/roles";
interface HeaderProps {
  pageTitle: string;
  user: { name?: string | null; role: UserRole; aiConnected?: boolean };
  onMenuOpen: () => void;
  onSearchOpen: () => void;
  reportBranches?: ReportBranches | null;
}
export function Header({
  pageTitle,
  user,
  onMenuOpen,
  onSearchOpen,
  reportBranches,
}: HeaderProps) {
  const pathname = usePathname();
  const current = navigationForPath(pathname);
  return (
    <header className="os-topbar">
      <div className="os-topbar-start">
        <button
          type="button"
          aria-label="メニューを開く"
          className="os-menu-button os-icon-button"
          onClick={onMenuOpen}
        >
          <Menu size={20} />
        </button>
        <span className="os-current-title">
          <span className="os-header-label">WORKSPACE</span>
          <span aria-hidden="true">/</span>
          {current.group?.label ?? pageTitle}
        </span>
        <button
          type="button"
          onClick={onSearchOpen}
          className="os-search-trigger"
          aria-label="顧客・案件・資料・機能を検索"
        >
          <Search size={17} aria-hidden />
          <span>顧客・案件・資料を探す</span>
          <kbd>⌘K</kbd>
        </button>
      </div>
      {reportBranches && (
        <div className="os-report-switch">
          <ReportBranchSwitch branches={reportBranches} />
        </div>
      )}
      <div className="os-topbar-actions">
        {user.aiConnected && <span className="os-ai-connection-status"><span aria-hidden="true" />AI接続済み</span>}
        <span className="os-header-presence">
          <PresenceBadge />
        </span>
        <NotificationBell />
        <ArchKunToggle />
        <AiWorkButton connected={user.aiConnected} label="AIと進める" />
      </div>
    </header>
  );
}
