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
    category?: string;
    page?: string;
  }>;
}

// カテゴリ → action プレフィックスのマッピング
const CATEGORY_PREFIXES: Record<string, string[]> = {
  login:       ["login_"],
  customer:    ["customer_"],
  deal:        ["deal_"],
  project:     ["project_", "expense_"],
  estimation:  ["estimation_"],
  admin:       ["member_", "user_"],
  invoice:     ["invoice_"],
  media:       ["media_request_"],
  collaboration: ["collaboration_"],
  tver:        ["tver_", "advertiser_review_"],
  wiki:        ["wiki_"],
  revenue:     ["revenue_report_"],
  video:       ["video_achievement_"],
};

export default async function LoginLogsPage({ searchParams }: PageProps) {
  const session = await auth();
  const role = (session?.user?.role ?? "MANAGER") as UserRole;

  // ADMIN 専用ページ
  if (role !== "ADMIN") {
    redirect("/dashboard");
  }

  const params = await searchParams;
  const q = params.q?.trim() ?? "";
  const category = params.category ?? "";
  const page = Math.max(1, parseInt(params.page ?? "1") || 1);

  // ---------------------------------------------------------------
  // Prisma WHERE 条件を構築
  // ---------------------------------------------------------------
  type WhereInput = {
    email?: { contains: string; mode: "insensitive" };
    action?: { startsWith: string } | { in: string[] };
    OR?: Array<{ action: { startsWith: string } }>;
  };

  const where: WhereInput = {};
  if (q) {
    where.email = { contains: q, mode: "insensitive" };
  }
  if (category && CATEGORY_PREFIXES[category]) {
    const prefixes = CATEGORY_PREFIXES[category];
    if (prefixes.length === 1) {
      where.action = { startsWith: prefixes[0] };
    } else {
      where.OR = prefixes.map((p) => ({ action: { startsWith: p } }));
    }
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
  const hasFilter = !!(q || category);

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
            <h2 className="text-lg font-bold text-zinc-900">操作ログ</h2>
            <p className="text-xs text-zinc-500 mt-0.5">
              ログイン・作成・更新・削除の記録を一覧表示
            </p>
          </div>
        </div>
      </div>

      {/* ===== サマリーカード ===== */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        <div className="bg-white rounded-lg border border-zinc-200 px-4 py-3">
          <p className="text-[11px] text-zinc-500">総操作数</p>
          <p className="text-xl font-bold text-zinc-900 mt-0.5">
            {total.toLocaleString()}
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
            : "操作ログはまだありません"}
        </div>
      )}
    </div>
  );
}
