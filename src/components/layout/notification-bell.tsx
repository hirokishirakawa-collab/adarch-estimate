"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Bell, TrendingUp, FolderKanban, Eye, BarChart2, MessageCircle } from "lucide-react";

// ----------------------------------------------------------------
// Types
// ----------------------------------------------------------------
interface Notification {
  id: string;
  type: string;
  title: string;
  message: string | null;
  linkUrl: string | null;
  isRead: boolean;
  createdAt: string;
}

// ----------------------------------------------------------------
// Helpers
// ----------------------------------------------------------------
function relativeTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60_000);
  if (mins < 1) return "たった今";
  if (mins < 60) return `${mins}分前`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}時間前`;
  const days = Math.floor(hours / 24);
  return `${days}日前`;
}

function typeIcon(type: string) {
  switch (type) {
    case "DEAL_WON":
      return <TrendingUp className="w-4 h-4 text-green-500" />;
    case "DEAL_UPDATED":
      return <TrendingUp className="w-4 h-4 text-blue-500" />;
    case "PROJECT_CREATED":
      return <FolderKanban className="w-4 h-4 text-violet-500" />;
    case "PROPOSAL_VIEWED":
      return <Eye className="w-4 h-4 text-amber-500" />;
    case "REPORT_SUBMITTED":
      return <BarChart2 className="w-4 h-4 text-emerald-500" />;
    case "OFFICE_KNOCK":
      return <MessageCircle className="w-4 h-4 text-emerald-600" />;
    default:
      return <Bell className="w-4 h-4 text-zinc-400" />;
  }
}

// ----------------------------------------------------------------
// Component
// ----------------------------------------------------------------
export function NotificationBell() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const ref = useRef<HTMLDivElement>(null);

  // ---- Fetch ----
  const fetchNotifications = useCallback(async () => {
    try {
      const res = await fetch("/api/notifications");
      if (!res.ok) return;
      const data = await res.json();
      setNotifications(data.notifications ?? []);
      setUnreadCount(data.unreadCount ?? 0);
    } catch {
      // silent
    }
  }, []);

  useEffect(() => {
    fetchNotifications();
    const id = setInterval(fetchNotifications, 60_000);
    return () => clearInterval(id);
  }, [fetchNotifications]);

  // ---- Click outside ----
  useEffect(() => {
    function handler(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    if (open) document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  // ---- Mark as read ----
  const markAllRead = async () => {
    await fetch("/api/notifications/read", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ all: true }),
    });
    setNotifications((prev) => prev.map((n) => ({ ...n, isRead: true })));
    setUnreadCount(0);
  };

  const handleClick = async (n: Notification) => {
    if (!n.isRead) {
      await fetch("/api/notifications/read", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ids: [n.id] }),
      });
      setNotifications((prev) =>
        prev.map((x) => (x.id === n.id ? { ...x, isRead: true } : x))
      );
      setUnreadCount((c) => Math.max(0, c - 1));
    }
    if (n.linkUrl) {
      router.push(n.linkUrl);
    }
    setOpen(false);
  };

  return (
    <div ref={ref} className="relative" data-tour="notification-bell">
      {/* Bell button */}
      <button
        onClick={() => setOpen((v) => !v)}
        className="relative p-1.5 rounded-lg text-zinc-500 hover:text-zinc-900 hover:bg-zinc-100 transition-colors"
        aria-label="通知"
      >
        <Bell className="w-5 h-5" />
        {unreadCount > 0 && (
          <span className="absolute -top-0.5 -right-0.5 flex items-center justify-center min-w-[18px] h-[18px] px-1 rounded-full bg-red-500 text-white text-[10px] font-bold leading-none">
            {unreadCount > 99 ? "99+" : unreadCount}
          </span>
        )}
      </button>

      {/* Dropdown */}
      {open && (
        <div className="absolute right-0 top-full mt-2 w-80 sm:w-96 bg-white rounded-xl shadow-2xl border border-zinc-200 z-50 overflow-hidden">
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-zinc-100">
            <h3 className="text-sm font-semibold text-zinc-900">通知</h3>
            {unreadCount > 0 && (
              <button
                onClick={markAllRead}
                className="text-xs text-amber-600 hover:text-amber-800 font-medium transition-colors"
              >
                すべて既読
              </button>
            )}
          </div>

          {/* List */}
          <div className="max-h-[400px] overflow-y-auto">
            {notifications.length === 0 ? (
              <div className="px-4 py-10 text-center text-sm text-zinc-400">
                通知はありません
              </div>
            ) : (
              notifications.map((n) => (
                <button
                  key={n.id}
                  onClick={() => handleClick(n)}
                  className={`w-full text-left px-4 py-3 border-b border-zinc-100 hover:bg-zinc-50 transition-colors flex items-start gap-3 ${
                    !n.isRead ? "bg-amber-50/50" : ""
                  }`}
                >
                  {/* Unread dot + type icon */}
                  <div className="flex-shrink-0 relative mt-0.5">
                    {typeIcon(n.type)}
                    {!n.isRead && (
                      <span className="absolute -top-0.5 -left-0.5 w-2 h-2 rounded-full bg-amber-500" />
                    )}
                  </div>

                  {/* Content */}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-zinc-900 truncate">
                      {n.title}
                    </p>
                    {n.message && (
                      <p className="text-xs text-zinc-500 mt-0.5 line-clamp-2">
                        {n.message}
                      </p>
                    )}
                    <p className="text-[11px] text-zinc-400 mt-1">
                      {relativeTime(n.createdAt)}
                    </p>
                  </div>
                </button>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}
