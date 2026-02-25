import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { getMockBranchId } from "@/lib/data/customers";
import { RevenueReportList } from "@/components/sales-report/revenue-report-list";
import { AdminRevenueSummary } from "@/components/sales-report/admin-revenue-summary";
import { BarChart2, Plus } from "lucide-react";
import type { UserRole } from "@/types/roles";
import type { Prisma } from "@/generated/prisma/client";

export default async function SalesReportPage() {
  const session = await auth();
  const role = (session?.user?.role ?? "MANAGER") as UserRole;
  const email = session?.user?.email ?? "";
  getMockBranchId(email, role); // ロール確認のみ

  // USER ロールはアクセス不可
  if (role === "USER") redirect("/dashboard");

  // 本人が登録したレポートのみ表示
  const user = await db.user.findUnique({
    where: { email },
    select: { id: true },
  });

  const where: Prisma.RevenueReportWhereInput = user
    ? { createdById: user.id }
    : { createdById: "__none__" };

  const [reports, adminReports] = await Promise.all([
    db.revenueReport.findMany({
      where,
      orderBy: { targetMonth: "desc" },
    }),
    // Admin のみ全件取得（集計用）
    role === "ADMIN"
      ? db.revenueReport.findMany({
          include: { createdBy: { select: { name: true, email: true } } },
          orderBy: { targetMonth: "desc" },
        })
      : Promise.resolve(null),
  ]);

  return (
    <div className="px-6 py-6 max-w-screen-xl mx-auto w-full space-y-8">
      {/* ヘッダー */}
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 bg-amber-50 rounded-xl flex items-center justify-center">
            <BarChart2 className="text-amber-600" style={{ width: "1.125rem", height: "1.125rem" }} />
          </div>
          <div>
            <h2 className="text-lg font-bold text-zinc-900">売上報告</h2>
            <p className="text-xs text-zinc-500 mt-0.5">
              自社の月次売上を管理します（金額はすべて税抜）
            </p>
          </div>
        </div>

        <Link
          href="/dashboard/sales-report/new"
          className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 text-white
                     text-xs font-medium rounded-lg hover:bg-blue-700 transition-colors"
        >
          <Plus className="w-3.5 h-3.5" />
          売上を報告する
        </Link>
      </div>

      {/* 管理者集計ビュー（Admin のみ） */}
      {adminReports && (
        <div className="border-b border-zinc-100 pb-8">
          <AdminRevenueSummary reports={adminReports} />
        </div>
      )}

      {/* 自分の報告一覧 */}
      <div>
        {role === "ADMIN" && (
          <p className="text-xs font-semibold text-zinc-500 uppercase tracking-wider mb-4">
            自分の報告
          </p>
        )}
        <RevenueReportList reports={reports} />
      </div>
    </div>
  );
}
