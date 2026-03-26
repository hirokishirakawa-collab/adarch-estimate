import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { Shield, ChevronLeft, ChevronRight, Search } from "lucide-react";
import { db } from "@/lib/db";
import type { UserRole } from "@/types/roles";

// ----------------------------------------------------------------
// 定数
// ----------------------------------------------------------------
const PER_PAGE = 100;

/** アクション → バッジ色 */
function actionBadgeColor(action: string): string {
  if (action === "login_success") return "bg-green-50 text-green-700 border-green-200";
  if (action === "login_failed" || action === "unauthorized_access") return "bg-red-50 text-red-700 border-red-200";
  if (action === "rate_limit_exceeded") return "bg-amber-50 text-amber-700 border-amber-200";
  if (
    action === "user_role_updated" ||
    action === "user_deleted" ||
    action === "user_active_toggled" ||
    action === "user_auto_suspended"
  )
    return "bg-violet-50 text-violet-700 border-violet-200";
  if (action === "member_registered" || action === "feature_toggled")
    return "bg-blue-50 text-blue-700 border-blue-200";
  return "bg-zinc-50 text-zinc-600 border-zinc-200";
}

/** 相対時間表示 */
function relativeTime(date: Date): string {
  const now = Date.now();
  const diff = now - date.getTime();
  const sec = Math.floor(diff / 1000);
  if (sec < 60) return `${sec}秒前`;
  const min = Math.floor(sec / 60);
  if (min < 60) return `${min}分前`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr}時間前`;
  const day = Math.floor(hr / 24);
  if (day < 30) return `${day}日前`;
  const month = Math.floor(day / 30);
  return `${month}ヶ月前`;
}

// ----------------------------------------------------------------
// アクション種別一覧（フィルター用）
// ----------------------------------------------------------------
const ACTION_OPTIONS: { value: string; label: string }[] = [
  { value: "", label: "すべてのアクション" },
  { value: "login_success", label: "ログイン成功" },
  { value: "login_failed", label: "ログイン失敗" },
  { value: "unauthorized_access", label: "不正アクセス" },
  { value: "rate_limit_exceeded", label: "レート制限" },
  { value: "user_role_updated", label: "ロール変更" },
  { value: "user_deleted", label: "ユーザー削除" },
  { value: "user_active_toggled", label: "有効/無効切替" },
  { value: "user_auto_suspended", label: "自動停止" },
  { value: "member_registered", label: "メンバー登録" },
  { value: "feature_toggled", label: "機能トグル" },
  { value: "customer_created", label: "顧客作成" },
  { value: "customer_updated", label: "顧客更新" },
  { value: "customer_deleted", label: "顧客削除" },
  { value: "deal_created", label: "商談作成" },
  { value: "deal_updated", label: "商談更新" },
  { value: "deal_deleted", label: "商談削除" },
  { value: "project_created", label: "PJ作成" },
  { value: "project_updated", label: "PJ更新" },
  { value: "estimation_created", label: "見積作成" },
  { value: "invoice_created", label: "請求書作成" },
];

// ----------------------------------------------------------------
// Page
// ----------------------------------------------------------------
interface PageProps {
  searchParams: Promise<{
    action?: string;
    q?: string;
    page?: string;
  }>;
}

export default async function AuditLogsPage({ searchParams }: PageProps) {
  const session = await auth();
  const role = (session?.user?.role ?? "MANAGER") as UserRole;

  if (role !== "ADMIN") {
    redirect("/dashboard");
  }

  const params = await searchParams;
  const actionFilter = params.action?.trim() ?? "";
  const q = params.q?.trim() ?? "";
  const page = Math.max(1, parseInt(params.page ?? "1") || 1);

  // ---------------------------------------------------------------
  // WHERE
  // ---------------------------------------------------------------
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const where: Record<string, any> = {};
  if (q) {
    where.email = { contains: q, mode: "insensitive" };
  }
  if (actionFilter) {
    where.action = actionFilter;
  }

  // ---------------------------------------------------------------
  // データ取得
  // ---------------------------------------------------------------
  const [logs, total] = await Promise.all([
    db.auditLog.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * PER_PAGE,
      take: PER_PAGE,
    }),
    db.auditLog.count({ where }),
  ]);

  const totalPages = Math.ceil(total / PER_PAGE);
  const hasFilter = !!(q || actionFilter);

  // ---------------------------------------------------------------
  // searchParams 構築ヘルパー
  // ---------------------------------------------------------------
  function buildHref(overrides: Record<string, string>): string {
    const sp = new URLSearchParams();
    const merged = { action: actionFilter, q, page: String(page), ...overrides };
    for (const [k, v] of Object.entries(merged)) {
      if (v) sp.set(k, v);
    }
    return `/dashboard/admin/audit-logs?${sp.toString()}`;
  }

  return (
    <div className="px-6 py-6 space-y-5 max-w-screen-2xl mx-auto w-full">
      {/* ===== ヘッダー ===== */}
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 bg-violet-50 rounded-xl flex items-center justify-center">
            <Shield
              className="text-violet-600"
              style={{ width: "1.125rem", height: "1.125rem" }}
            />
          </div>
          <div>
            <h2 className="text-lg font-bold text-zinc-900">
              操作ログ（詳細）
            </h2>
            <p className="text-xs text-zinc-500 mt-0.5">
              全操作の監査ログを時系列で表示（ADMIN専用）
            </p>
          </div>
        </div>
        <div className="text-sm text-zinc-500">
          {total.toLocaleString()} 件
        </div>
      </div>

      {/* ===== フィルターバー ===== */}
      <form
        action="/dashboard/admin/audit-logs"
        method="GET"
        data-tour="audit-filters"
        className="bg-white rounded-xl border border-zinc-200 px-5 py-4 flex flex-wrap items-end gap-3"
      >
        {/* アクション種別 */}
        <div className="flex flex-col gap-1">
          <label className="text-[11px] font-medium text-zinc-500">
            アクション種別
          </label>
          <select
            name="action"
            defaultValue={actionFilter}
            className="rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-800 focus:outline-none focus:ring-2 focus:ring-violet-300"
          >
            {ACTION_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </div>

        {/* メール検索 */}
        <div className="flex flex-col gap-1 flex-1 min-w-[200px]">
          <label className="text-[11px] font-medium text-zinc-500">
            メールアドレス検索
          </label>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-400" />
            <input
              type="text"
              name="q"
              defaultValue={q}
              placeholder="メールアドレスで絞り込み..."
              className="w-full rounded-lg border border-zinc-200 bg-white pl-9 pr-3 py-2 text-sm text-zinc-800 placeholder:text-zinc-400 focus:outline-none focus:ring-2 focus:ring-violet-300"
            />
          </div>
        </div>

        {/* 検索ボタン */}
        <button
          type="submit"
          className="px-4 py-2 rounded-lg bg-violet-600 text-white text-sm font-medium hover:bg-violet-700 transition-colors"
        >
          検索
        </button>

        {hasFilter && (
          <a
            href="/dashboard/admin/audit-logs"
            className="px-4 py-2 rounded-lg border border-zinc-200 text-zinc-600 text-sm font-medium hover:bg-zinc-50 transition-colors"
          >
            リセット
          </a>
        )}
      </form>

      {/* ===== テーブル ===== */}
      {total > 0 ? (
        <div className="bg-white rounded-xl border border-zinc-200 overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-zinc-100 text-left text-xs font-medium text-zinc-500">
                <th className="px-4 py-3 whitespace-nowrap">日時</th>
                <th className="px-4 py-3 whitespace-nowrap">アクション</th>
                <th className="px-4 py-3 whitespace-nowrap">ユーザー</th>
                <th className="px-4 py-3 whitespace-nowrap">詳細</th>
                <th className="px-4 py-3 whitespace-nowrap">IP</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-50">
              {logs.map((log) => (
                <tr key={log.id} className="hover:bg-zinc-50/50 transition-colors">
                  {/* 日時 */}
                  <td className="px-4 py-3 whitespace-nowrap">
                    <div className="text-zinc-800 text-xs">
                      {log.createdAt.toLocaleDateString("ja-JP")}
                    </div>
                    <div className="text-zinc-400 text-[11px]">
                      {log.createdAt.toLocaleTimeString("ja-JP")} ・{" "}
                      {relativeTime(log.createdAt)}
                    </div>
                  </td>

                  {/* アクション */}
                  <td className="px-4 py-3">
                    <span
                      className={`inline-flex items-center px-2 py-0.5 rounded-md text-[11px] font-semibold border ${actionBadgeColor(
                        log.action
                      )}`}
                    >
                      {log.action}
                    </span>
                  </td>

                  {/* ユーザー */}
                  <td className="px-4 py-3">
                    <div className="text-zinc-800 text-xs truncate max-w-[200px]">
                      {log.email}
                    </div>
                    {log.name && (
                      <div className="text-zinc-400 text-[11px] truncate max-w-[200px]">
                        {log.name}
                      </div>
                    )}
                  </td>

                  {/* 詳細 */}
                  <td className="px-4 py-3">
                    <div className="text-zinc-600 text-xs max-w-[300px] truncate">
                      {log.detail ?? "-"}
                    </div>
                    {log.entity && (
                      <div className="text-zinc-400 text-[11px]">
                        {log.entity}
                        {log.entityId ? ` #${log.entityId.slice(0, 8)}` : ""}
                      </div>
                    )}
                  </td>

                  {/* IP */}
                  <td className="px-4 py-3 text-xs text-zinc-500 whitespace-nowrap">
                    {log.ipAddress ?? "-"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="text-center py-12 text-zinc-400 text-sm">
          {hasFilter
            ? "条件に一致するログはありません"
            : "操作ログはまだありません"}
        </div>
      )}

      {/* ===== ページネーション ===== */}
      {totalPages > 1 && (
        <Suspense>
          <div className="flex items-center justify-between">
            <p className="text-xs text-zinc-500">
              {((page - 1) * PER_PAGE + 1).toLocaleString()} -{" "}
              {Math.min(page * PER_PAGE, total).toLocaleString()} / {total.toLocaleString()} 件
            </p>
            <div className="flex items-center gap-2">
              {page > 1 ? (
                <a
                  href={buildHref({ page: String(page - 1) })}
                  className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg border border-zinc-200 text-sm text-zinc-700 hover:bg-zinc-50 transition-colors"
                >
                  <ChevronLeft className="w-4 h-4" />
                  前へ
                </a>
              ) : (
                <span className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg border border-zinc-100 text-sm text-zinc-300 cursor-not-allowed">
                  <ChevronLeft className="w-4 h-4" />
                  前へ
                </span>
              )}
              <span className="text-sm text-zinc-600">
                {page} / {totalPages}
              </span>
              {page < totalPages ? (
                <a
                  href={buildHref({ page: String(page + 1) })}
                  className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg border border-zinc-200 text-sm text-zinc-700 hover:bg-zinc-50 transition-colors"
                >
                  次へ
                  <ChevronRight className="w-4 h-4" />
                </a>
              ) : (
                <span className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg border border-zinc-100 text-sm text-zinc-300 cursor-not-allowed">
                  次へ
                  <ChevronRight className="w-4 h-4" />
                </span>
              )}
            </div>
          </div>
        </Suspense>
      )}
    </div>
  );
}
