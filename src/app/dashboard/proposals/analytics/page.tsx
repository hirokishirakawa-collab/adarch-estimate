"use client";

import { useEffect, useState } from "react";
import {
  BarChart3,
  Eye,
  Users,
  Clock,
  MousePointerClick,
  ExternalLink,
  AlertTriangle,
} from "lucide-react";

interface UserSession {
  name?: string | null;
  email?: string | null;
  role?: string;
  image?: string | null;
}

interface ProposalAnalytics {
  id: string;
  title: string | null;
  companyName: string;
  slug: string | null;
  publishedAt: string | null;
  totalViews: number;
  uniqueViewers: number;
  avgDuration: number;
  avgScrollDepth: number;
  lastViewedAt: string | null;
}

function formatDuration(seconds: number): string {
  if (seconds === 0) return "0s";
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  if (m === 0) return `${s}s`;
  if (s === 0) return `${m}m`;
  return `${m}m ${s}s`;
}

function formatDate(dateStr: string | null): string {
  if (!dateStr) return "-";
  const d = new Date(dateStr);
  return d.toLocaleDateString("ja-JP", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default function ProposalAnalyticsPage() {
  const [user, setUser] = useState<UserSession | null>(null);
  const [analytics, setAnalytics] = useState<ProposalAnalytics[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/auth/session")
      .then((r) => r.json())
      .then((d) => {
        if (d?.user) setUser(d.user);
      });
  }, []);

  useEffect(() => {
    if (!user) return;
    if (user.role !== "ADMIN") {
      setError("この機能は管理者のみ利用できます");
      setLoading(false);
      return;
    }
    fetch("/api/proposals/analytics")
      .then((r) => {
        if (!r.ok) throw new Error("Failed to fetch analytics");
        return r.json();
      })
      .then((d) => setAnalytics(d.analytics))
      .catch(() => setError("データの取得に失敗しました"))
      .finally(() => setLoading(false));
  }, [user]);

  if (!user) return null;

  const totalAllViews = analytics.reduce((s, a) => s + a.totalViews, 0);
  const totalUniqueViewers = analytics.reduce(
    (s, a) => s + a.uniqueViewers,
    0
  );
  const viewedCount = analytics.filter((a) => a.totalViews > 0).length;

  return (
    <div className="px-6 py-6 space-y-5 max-w-screen-2xl mx-auto w-full">
      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        <div className="w-10 h-10 bg-blue-50 rounded-xl flex items-center justify-center">
          <BarChart3 className="w-5 h-5 text-blue-600" />
        </div>
        <div>
          <h1 className="text-lg font-bold text-zinc-900">
            提案書アナリティクス
          </h1>
          <p className="text-sm text-zinc-500">
            公開済み提案書の閲覧状況を確認
          </p>
        </div>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-sm text-red-700">
          {error}
        </div>
      )}

      {loading && (
        <div className="animate-pulse space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {[...Array(3)].map((_, i) => (
              <div key={i} className="h-24 bg-zinc-100 rounded-lg" />
            ))}
          </div>
          <div className="h-64 bg-zinc-100 rounded-lg" />
        </div>
      )}

      {!loading && !error && (
        <>
          {/* Summary Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="bg-white border border-zinc-200 rounded-lg p-4">
              <div className="flex items-center gap-2 mb-2">
                <Eye className="w-4 h-4 text-zinc-400" />
                <span className="text-xs text-zinc-500">総閲覧数</span>
              </div>
              <p className="text-2xl font-bold text-zinc-900">
                {totalAllViews}
              </p>
            </div>
            <div className="bg-white border border-zinc-200 rounded-lg p-4">
              <div className="flex items-center gap-2 mb-2">
                <Users className="w-4 h-4 text-zinc-400" />
                <span className="text-xs text-zinc-500">
                  ユニーク閲覧者数
                </span>
              </div>
              <p className="text-2xl font-bold text-zinc-900">
                {totalUniqueViewers}
              </p>
            </div>
            <div className="bg-white border border-zinc-200 rounded-lg p-4">
              <div className="flex items-center gap-2 mb-2">
                <BarChart3 className="w-4 h-4 text-zinc-400" />
                <span className="text-xs text-zinc-500">
                  閲覧済み提案書
                </span>
              </div>
              <p className="text-2xl font-bold text-zinc-900">
                {viewedCount}
                <span className="text-sm font-normal text-zinc-500 ml-1">
                  / {analytics.length}
                </span>
              </p>
            </div>
          </div>

          {/* Table */}
          {analytics.length === 0 ? (
            <div className="bg-white border border-zinc-200 rounded-lg p-8 text-center">
              <p className="text-sm text-zinc-500">
                公開済みの提案書がありません
              </p>
            </div>
          ) : (
            <div className="bg-white border border-zinc-200 rounded-lg overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-zinc-200 bg-zinc-50">
                      <th className="text-left px-4 py-3 text-xs font-medium text-zinc-500">
                        提案書
                      </th>
                      <th className="text-left px-4 py-3 text-xs font-medium text-zinc-500">
                        公開日
                      </th>
                      <th className="text-center px-4 py-3 text-xs font-medium text-zinc-500">
                        <div className="flex items-center justify-center gap-1">
                          <Eye className="w-3 h-3" />
                          閲覧数
                        </div>
                      </th>
                      <th className="text-center px-4 py-3 text-xs font-medium text-zinc-500">
                        <div className="flex items-center justify-center gap-1">
                          <Users className="w-3 h-3" />
                          UU
                        </div>
                      </th>
                      <th className="text-center px-4 py-3 text-xs font-medium text-zinc-500">
                        <div className="flex items-center justify-center gap-1">
                          <Clock className="w-3 h-3" />
                          平均滞在
                        </div>
                      </th>
                      <th className="text-center px-4 py-3 text-xs font-medium text-zinc-500">
                        <div className="flex items-center justify-center gap-1">
                          <MousePointerClick className="w-3 h-3" />
                          スクロール
                        </div>
                      </th>
                      <th className="text-left px-4 py-3 text-xs font-medium text-zinc-500">
                        最終閲覧
                      </th>
                      <th className="text-center px-4 py-3 text-xs font-medium text-zinc-500">
                        リンク
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {analytics.map((item) => (
                      <tr
                        key={item.id}
                        className="border-b border-zinc-100 hover:bg-zinc-50 transition-colors"
                      >
                        {/* Title / Company */}
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2">
                            <div>
                              <p className="font-medium text-zinc-900 text-sm">
                                {item.title || item.companyName}
                              </p>
                              {item.title && (
                                <p className="text-xs text-zinc-500">
                                  {item.companyName}
                                </p>
                              )}
                            </div>
                            {item.totalViews === 0 && (
                              <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium bg-red-100 text-red-700">
                                未閲覧
                              </span>
                            )}
                          </div>
                        </td>

                        {/* Published Date */}
                        <td className="px-4 py-3 text-xs text-zinc-600">
                          {formatDate(item.publishedAt)}
                        </td>

                        {/* Total Views */}
                        <td className="px-4 py-3 text-center text-sm font-medium text-zinc-900">
                          {item.totalViews}
                        </td>

                        {/* Unique Viewers */}
                        <td className="px-4 py-3 text-center text-sm text-zinc-600">
                          {item.uniqueViewers}
                        </td>

                        {/* Avg Duration */}
                        <td className="px-4 py-3 text-center text-sm text-zinc-600">
                          {formatDuration(item.avgDuration)}
                        </td>

                        {/* Scroll Depth */}
                        <td className="px-4 py-3 text-center">
                          <div className="flex items-center justify-center gap-1">
                            <span className="text-sm text-zinc-600">
                              {item.totalViews > 0
                                ? `${item.avgScrollDepth}%`
                                : "-"}
                            </span>
                            {item.totalViews > 0 &&
                              item.avgScrollDepth < 50 && (
                                <AlertTriangle className="w-3 h-3 text-amber-500" />
                              )}
                          </div>
                        </td>

                        {/* Last Viewed */}
                        <td className="px-4 py-3 text-xs text-zinc-600">
                          {formatDate(item.lastViewedAt)}
                        </td>

                        {/* Public Link */}
                        <td className="px-4 py-3 text-center">
                          {item.slug ? (
                            <a
                              href={`/p/${item.slug}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex items-center text-blue-600 hover:text-blue-700"
                            >
                              <ExternalLink className="w-4 h-4" />
                            </a>
                          ) : (
                            <span className="text-zinc-300">-</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
