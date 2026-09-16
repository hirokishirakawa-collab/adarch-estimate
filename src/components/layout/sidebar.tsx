"use client";
import { useEffect, useState, useRef } from "react";
import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { signOut } from "next-auth/react";
import {
  Home,
  Users,
  Layers,
  BookOpen,
  ClipboardCheck,
  Building2,
  Settings2,
  Star,
  LogOut,
  X,
  Plug,
} from "lucide-react";
import {
  NAVIGATION_GROUPS,
  navigationForPath,
  findNavigationItem,
  canUseNavigation,
} from "@/lib/navigation/catalog";
import type { UserRole } from "@/types/roles";
interface SidebarProps {
  user: {
    name?: string | null;
    email?: string | null;
    image?: string | null;
    role: UserRole;
    enabledFeatures?: string[];
  };
  isOpen: boolean;
  onClose: () => void;
  reportWarning?: "yellow" | "red" | null;
  isSuspended?: boolean;
}
const icons = {
  home: Home,
  sales: Users,
  projects: Layers,
  library: BookOpen,
  procedures: ClipboardCheck,
};
type Favorite = { id: string; path: string; label: string };
export function Sidebar({
  user,
  isOpen,
  onClose,
  reportWarning,
  isSuspended,
}: SidebarProps) {
  const aside = useRef<HTMLElement>(null);
  const pathname = usePathname();
  const current = navigationForPath(pathname);
  const [favorites, setFavorites] = useState<Favorite[]>([]);
  useEffect(() => {
    const controller = new AbortController();
    fetch("/api/favorites", { signal: controller.signal })
      .then((r) => (r.ok ? r.json() : []))
      .then((data) => {
        if (Array.isArray(data)) setFavorites(data.slice(0, 5));
      })
      .catch(() => {});
    return () => controller.abort();
  }, []);
  useEffect(() => {
    if (!isOpen) return;
    const previous = document.activeElement as HTMLElement | null;
    const mobile = window.matchMedia("(max-width: 767px)").matches;
    if (mobile) aside.current?.querySelector<HTMLElement>("a,button")?.focus();
    function escape(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
      if (e.key !== "Tab" || !mobile) return;
      const focusable = Array.from(
        aside.current?.querySelectorAll<HTMLElement>(
          "a[href],button:not([disabled]),summary",
        ) ?? [],
      ).filter((el) => el.getClientRects().length > 0);
      const first = focusable[0],
        last = focusable.at(-1);
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last?.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first?.focus();
      }
    }
    window.addEventListener("keydown", escape);
    return () => {
      window.removeEventListener("keydown", escape);
      if (mobile) previous?.focus();
    };
  }, [isOpen, onClose]);
  const restricted = !!isSuspended && user.role !== "ADMIN";
  const visibleFavorites = restricted
    ? []
    : favorites.filter((f) => {
        const item = findNavigationItem(f.path);
        return item && canUseNavigation(item, user.role, user.enabledFeatures);
      });
  return (
    <>
      {isOpen && (
        <button
          type="button"
          aria-label="メニューを閉じる"
          className="os-sidebar-backdrop"
          onClick={onClose}
        />
      )}
      <aside
        ref={aside}
        className={`os-sidebar ${isOpen ? "is-open" : ""}`}
        aria-label="メインメニュー"
      >
        <div className="os-brand">
          <Link href="/dashboard" onClick={onClose}>
            <Image
              src="/logo-adarch.png"
              alt="Ad Arch Group"
              width={132}
              height={27}
            />
            <span>CONNECTED OS</span>
          </Link>
          <button
            type="button"
            className="os-mobile-close os-icon-button"
            aria-label="メニューを閉じる"
            onClick={onClose}
          >
            <X size={19} />
          </button>
        </div>
        {reportWarning && (
          <Link
            href="/dashboard/sales-report/new"
            onClick={onClose}
            className={`os-report-warning ${reportWarning === "red" ? "is-urgent" : ""}`}
          >
            月次報告が未提出です <span>提出する →</span>
          </Link>
        )}
        <p className="os-nav-caption">WORKSPACE</p>
        <nav
          className="os-primary-nav"
          data-tour="sidebar"
          aria-label="主な仕事"
        >
          {restricted ? (
            <Link href="/dashboard/sales-report" onClick={onClose}>
              <ClipboardCheck size={18} />
              月次報告
            </Link>
          ) : (
            NAVIGATION_GROUPS.filter((g) => g.id in icons).map((g) => {
              const Icon = icons[g.id as keyof typeof icons];
              return (
                <Link
                  key={g.id}
                  href={g.href}
                  onClick={onClose}
                  aria-current={current.group?.id === g.id ? "page" : undefined}
                >
                  <Icon size={18} aria-hidden />
                  <span>{g.label}</span>
                </Link>
              );
            })
          )}
        </nav>
        {visibleFavorites.length > 0 && (
          <details className="os-favorites">
            <summary>
              <Star size={14} aria-hidden />
              ピン留め
            </summary>
            <div>
              {visibleFavorites.map((f) => (
                <Link key={f.id} href={f.path} onClick={onClose}>
                  {findNavigationItem(f.path)?.label ?? f.label}
                </Link>
              ))}
            </div>
          </details>
        )}
        <div className="os-sidebar-bottom">
          {!restricted && (
            <>
              {user.role === "ADMIN" && (
                <Link
                  href="/dashboard/admin/workspace"
                  onClick={onClose}
                  aria-current={
                    current.group?.id === "admin" ? "page" : undefined
                  }
                >
                  <Building2 size={16} aria-hidden />
                  本部<span className="os-role">ADMIN</span>
                </Link>
              )}
              <Link href="/dashboard/ai-connect" onClick={onClose}>
                <Plug size={16} aria-hidden />
                AI接続
              </Link>
              <Link href="/dashboard/settings" onClick={onClose}>
                <Settings2 size={16} aria-hidden />
                通知・個人設定
              </Link>
            </>
          )}
          <div className="os-profile">
            {user.image ? (
              <Image src={user.image} width={30} height={30} alt="" />
            ) : (
              <span className="os-profile-initial">
                {user.name?.[0] ?? "U"}
              </span>
            )}
            <div>
              <strong>{user.name ?? "ユーザー"}</strong>
              <span>
                {user.role === "ADMIN"
                  ? "本部"
                  : user.role === "MANAGER"
                    ? "拠点代表"
                    : "メンバー"}
              </span>
            </div>
          </div>
          <button
            type="button"
            onClick={() => signOut({ callbackUrl: "/login" })}
          >
            <LogOut size={15} aria-hidden />
            ログアウト
          </button>
        </div>
      </aside>
    </>
  );
}
