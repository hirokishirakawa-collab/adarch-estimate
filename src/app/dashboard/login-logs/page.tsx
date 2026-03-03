import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { Shield } from "lucide-react";
import { db } from "@/lib/db";
import type { UserRole } from "@/types/roles";
import { LoginLogSearch } from "@/components/login-logs/login-log-search";
import { LoginLogTable } from "@/components/login-logs/login-log-table";
import { LoginLogPagination } from "@/components/login-logs/login-log-pagination";

const PER_PAGE = 30;

interface PageProps {
  searchParams: Promise<{
    q?: string;
    result?: string;
    page?: string;
  }>;
}

export default async function LoginLogsPage({ searchParams }: PageProps) {
  const session = await auth();
  const role = (session?.user?.role ?? "MANAGER") as UserRole;

  // ADMIN 専用ページ
  if (role !== "ADMIN") {
    redirect("/dashboard");
  }

  const params = await searchParams;
  const q = params.q?.trim() ?? "";
  const result = params.result ?? ""; // "success" | "failed" | ""
  const page = Math.max(1, parseInt(params.page ?? "1") || 1);

  // ---------------------------------------------------------------
  // Prisma WHERE 条件を構築
  // ---------------------------------------------------------------
  type WhereInput = {
    email?: { contains: string; mode: "insensitive" };
    success?: boolean;
  };

  const where: WhereInput = {};
  if (q) {
    where.email = { contains: q, mode: "insensitive" };
  }
  if (result === "success") where.success = true;
  if (result === "failed") where.success = false;

  // ---------------------------------------------------------------
  // データ取得
  // ---------------------------------------------------------------
  const [logs, total, successCount, failedCount] = await Promise.all([
    db.loginLog.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * PER_PAGE,
      take: PER_PAGE,
    }),
    db.loginLog.count({ where }),
    db.loginLog.count({ where: { success: true } }),
    db.loginLog.count({ where: { success: false } }),
  ]);

  const totalPages = Math.ceil(total / PER_PAGE);
  const hasFilter = !!(q || result);

  return (
    <div className="px-6 py-6 space-y-5 max-w-screen-2xl mx-auto w-full">
      {/* ===== ヘッダー ===== */}
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 bg-blue-50 rounded-xl flex items-center justify-center">
            <Shield
              className="text-blue-600"
              style={{ width: "1.125rem", height: "1.125rem" }}
            />
          </div>
          <div>
            <h2 className="text-lg font-bold text-zinc-900">ログイン履歴</h2>
            <p className="text-xs text-zinc-500 mt-0.5">
              ログイン成功・失敗の記録を一覧表示
            </p>
          </div>
        </div>
      </div>

      {/* ===== サマリーカード ===== */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        <div className="bg-white rounded-lg border border-zinc-200 px-4 py-3">
          <p className="text-[11px] text-zinc-500">総ログイン試行</p>
          <p className="text-xl font-bold text-zinc-900 mt-0.5">
            {(successCount + failedCount).toLocaleString()}
          </p>
        </div>
        <div className="bg-white rounded-lg border border-zinc-200 px-4 py-3">
          <p className="text-[11px] text-zinc-500">成功</p>
          <p className="text-xl font-bold text-emerald-600 mt-0.5">
            {successCount.toLocaleString()}
          </p>
        </div>
        <div className="bg-white rounded-lg border border-zinc-200 px-4 py-3">
          <p className="text-[11px] text-zinc-500">失敗</p>
          <p className="text-xl font-bold text-red-600 mt-0.5">
            {failedCount.toLocaleString()}
          </p>
        </div>
      </div>

      {/* ===== 検索・フィルター ===== */}
      <div className="bg-white rounded-xl border border-zinc-200 px-5 py-4">
        <Suspense>
          <LoginLogSearch />
        </Suspense>
      </div>

      {/* ===== テーブル ===== */}
      <LoginLogTable logs={logs} />

      {/* ===== ページネーション ===== */}
      {totalPages > 0 && (
        <Suspense>
          <LoginLogPagination
            currentPage={page}
            totalPages={totalPages}
            total={total}
            perPage={PER_PAGE}
          />
        </Suspense>
      )}

      {/* 結果なし */}
      {total === 0 && (
        <div className="text-center py-12 text-zinc-400 text-sm">
          {hasFilter
            ? "条件に一致するログはありません"
            : "ログイン履歴はまだありません"}
        </div>
      )}
    </div>
  );
}
