import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { getMockBranchId } from "@/lib/data/customers";
import { RevenueReportList } from "@/components/sales-report/revenue-report-list";
import { AdminRevenueSummary } from "@/components/sales-report/admin-revenue-summary";
import { AdminReportList } from "@/components/sales-report/admin-report-list";
import { BarChart2, Plus } from "lucide-react";
import type { UserRole } from "@/types/roles";
import { getMyFunnel, currentMonthKey } from "@/lib/kpis/outreach-funnel";
import { Activity, PartyPopper } from "lucide-react";
import type { Prisma } from "@/generated/prisma/client";
import { WikiHelpLink } from "@/components/wiki/wiki-help-link";

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
    select: { id: true, name: true },
  });

  const where: Prisma.RevenueReportWhereInput = user
    ? { createdById: user.id }
    : { createdById: "__none__" };

  // 自分の今月の動き（送付→返信→受注）。受注で未報告があれば知らせる
  const myFunnel = user
    ? await getMyFunnel(user.id, user.name ?? email, currentMonthKey())
    : null;

  const [reports, adminReports] = await Promise.all([
    db.revenueReport.findMany({
      where,
      include: { items: { orderBy: { sortOrder: "asc" } } },
      orderBy: { targetMonth: "desc" },
    }),
    // Admin のみ全件取得（集計用＋詳細一覧用）
    role === "ADMIN"
      ? db.revenueReport.findMany({
          include: {
            createdBy: { select: { name: true, email: true } },
            items: { orderBy: { sortOrder: "asc" } },
          },
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
            <h2 className="text-lg font-bold text-zinc-900">月次報告</h2>
            <div className="flex items-center gap-2 mt-0.5">
              <p className="text-xs text-zinc-500">
                毎月の活動状況と売上を報告します
              </p>
              <WikiHelpLink query="月次報告" />
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
        {role === "ADMIN" && (
          <Link
            href="/dashboard/sales-report/funnel"
            className="flex items-center gap-1.5 px-3 py-1.5 border border-emerald-200 text-emerald-700 bg-emerald-50
                       text-xs font-medium rounded-lg hover:bg-emerald-100 transition-colors"
          >
            <Activity className="w-3.5 h-3.5" />
            行動量ボード
          </Link>
        )}
        <Link
          href="/dashboard/sales-report/new"
          data-tour="report-new"
          className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 text-white
                     text-xs font-medium rounded-lg hover:bg-blue-700 transition-colors"
        >
          <Plus className="w-3.5 h-3.5" />
          月次報告を作成
        </Link>
        </div>
      </div>

      {/* 自分の今月の動き */}
      {myFunnel && (
        <div className="flex items-center flex-wrap gap-x-5 gap-y-2 rounded-xl border border-zinc-200 bg-white px-4 py-3 text-xs">
          <span className="font-semibold text-zinc-600">今月の動き</span>
          <span className="text-zinc-500">送付 <b className="text-zinc-900 tabular-nums">{myFunnel.sent}</b></span>
          <span className="text-zinc-300">→</span>
          <span className="text-zinc-500">返信あり <b className="text-zinc-900 tabular-nums">{myFunnel.replied}</b></span>
          <span className="text-zinc-300">→</span>
          <span className="text-zinc-500">受注 <b className="text-zinc-900 tabular-nums">{myFunnel.won}</b></span>
          {myFunnel.unreportedWon > 0 && (
            <Link
              href="/dashboard/sales-report/new"
              className="inline-flex items-center gap-1 ml-auto px-2.5 py-1 rounded-lg bg-sky-50 border border-sky-200 text-sky-800 font-medium hover:bg-sky-100"
            >
              <PartyPopper className="w-3.5 h-3.5" />
              未報告の受注が {myFunnel.unreportedWon} 件 → 報告に取り込む
            </Link>
          )}
        </div>
      )}

      {/* 管理者集計ビュー（Admin のみ） */}
      {adminReports && (
        <div className="border-b border-zinc-100 pb-8">
          <AdminRevenueSummary reports={adminReports} />
        </div>
      )}

      {/* 管理者: 全員の報告一覧（Admin のみ） */}
      {adminReports && (
        <div>
          <p className="text-xs font-semibold text-zinc-500 uppercase tracking-wider mb-4">
            全パートナーの報告一覧
          </p>
          <AdminReportList reports={adminReports} />
        </div>
      )}

      {/* 自分の報告一覧 */}
      <div>
        {role === "ADMIN" && (
          <p className="text-xs font-semibold text-zinc-500 uppercase tracking-wider mb-4">
            自分の報告
          </p>
        )}
        <div data-tour="report-list">
          <RevenueReportList reports={reports} />
        </div>
      </div>
    </div>
  );
}
