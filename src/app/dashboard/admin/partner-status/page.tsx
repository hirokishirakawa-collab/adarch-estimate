import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { Shield, Users } from "lucide-react";
import { PartnerStatusTable } from "@/components/admin/partner-status-table";
import type { UserRole } from "@/types/roles";

export default async function AdminPartnerStatusPage() {
  // ── ADMIN ガード ──────────────────────────────────────────────
  const session = await auth();
  const role = (session?.user?.role ?? "USER") as UserRole;
  if (role !== "ADMIN") redirect("/dashboard");

  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth() + 1;

  // ── 全グループ企業の取得 ──────────────────────────────────────
  const companies = await db.groupCompany.findMany({
    where: { isActive: true },
    select: {
      id: true,
      name: true,
      ownerName: true,
    },
    orderBy: { name: "asc" },
  });

  // ── 当月ステータスの取得（無い企業は NOT_SELECTED で自動作成）──
  const statuses = await Promise.all(
    companies.map(async (c) => {
      const status = await db.partnerStatus.upsert({
        where: {
          groupCompanyId_year_month: {
            groupCompanyId: c.id,
            year,
            month,
          },
        },
        create: {
          groupCompanyId: c.id,
          year,
          month,
          status: "NOT_SELECTED",
        },
        update: {},
      });

      // 連続非稼働月数を算出
      let consecutiveInactiveMonths = 0;
      if (status.status !== "ACTIVE") {
        for (let i = 1; i <= 12; i++) {
          let checkMonth = month - i;
          let checkYear = year;
          if (checkMonth <= 0) {
            checkMonth += 12;
            checkYear -= 1;
          }
          const prev = await db.partnerStatus.findUnique({
            where: {
              groupCompanyId_year_month: {
                groupCompanyId: c.id,
                year: checkYear,
                month: checkMonth,
              },
            },
          });
          if (!prev || prev.status === "ACTIVE") break;
          consecutiveInactiveMonths++;
        }
      }

      // 当月スコア
      const score = await db.partnerScore.findUnique({
        where: {
          groupCompanyId_year_month: {
            groupCompanyId: c.id,
            year,
            month,
          },
        },
        select: { totalScore: true },
      });

      // 直近の月次報告日（RevenueReport）
      // User の branchId 経由で取得するのではなく groupCompany にリンクされた User の報告を取得
      const linkedUsers = await db.user.findMany({
        where: { groupCompanyId: c.id },
        select: { id: true },
      });
      const userIds = linkedUsers.map((u) => u.id);

      let lastReportDate: Date | null = null;
      if (userIds.length > 0) {
        const latestReport = await db.revenueReport.findFirst({
          where: { createdById: { in: userIds } },
          orderBy: { createdAt: "desc" },
          select: { createdAt: true },
        });
        lastReportDate = latestReport?.createdAt ?? null;
      }

      return {
        id: status.id,
        groupCompanyId: c.id,
        year: status.year,
        month: status.month,
        status: status.status as
          | "ACTIVE"
          | "INACTIVE"
          | "FORCED_INACTIVE"
          | "NOT_SELECTED",
        selectedAt: status.selectedAt?.toISOString() ?? null,
        reportCount: status.reportCount,
        note: status.note,
        consecutiveInactiveMonths,
        groupCompany: {
          id: c.id,
          name: c.name,
          ownerName: c.ownerName,
        },
        score: score?.totalScore ?? null,
        lastReportDate: lastReportDate?.toISOString() ?? null,
      };
    })
  );

  // ── サマリー集計 ────────────────────────────────────────────
  const counts = {
    ACTIVE: statuses.filter((s) => s.status === "ACTIVE").length,
    INACTIVE: statuses.filter(
      (s) => s.status === "INACTIVE" || s.status === "FORCED_INACTIVE"
    ).length,
    NOT_SELECTED: statuses.filter((s) => s.status === "NOT_SELECTED").length,
    total: statuses.length,
  };

  const summaryCards = [
    {
      label: "稼働中",
      count: counts.ACTIVE,
      cls: "text-emerald-700",
      bg: "bg-emerald-50",
    },
    {
      label: "活動休止中",
      count: counts.INACTIVE,
      cls: "text-amber-700",
      bg: "bg-amber-50",
    },
    {
      label: "未選択",
      count: counts.NOT_SELECTED,
      cls: "text-red-700",
      bg: "bg-red-50",
    },
    {
      label: "全パートナー",
      count: counts.total,
      cls: "text-zinc-800",
      bg: "bg-white",
    },
  ];

  // ── アラート算出 ────────────────────────────────────────────
  type AlertBadge = {
    type: "warning" | "danger" | "critical";
    label: string;
    count: number;
  };
  const alerts: AlertBadge[] = [];

  // 報告ゼロ1ヶ月（ACTIVE なのに reportCount=0）
  const zeroReport1 = statuses.filter(
    (s) => s.status === "ACTIVE" && s.reportCount === 0
  ).length;
  if (zeroReport1 > 0) {
    alerts.push({
      type: "warning",
      label: "報告ゼロ1ヶ月",
      count: zeroReport1,
    });
  }

  // 休止2ヶ月
  const inactive2 = statuses.filter(
    (s) => s.consecutiveInactiveMonths >= 2 && s.consecutiveInactiveMonths < 3
  ).length;
  if (inactive2 > 0) {
    alerts.push({
      type: "danger",
      label: "報告ゼロ2ヶ月 / 休止2ヶ月",
      count: inactive2,
    });
  }

  // 休止3ヶ月超
  const inactive3plus = statuses.filter(
    (s) => s.consecutiveInactiveMonths >= 3
  ).length;
  if (inactive3plus > 0) {
    alerts.push({
      type: "critical",
      label: "休止3ヶ月超",
      count: inactive3plus,
    });
  }

  return (
    <div className="px-6 py-6 max-w-screen-xl mx-auto w-full">
      {/* ヘッダー */}
      <div className="flex items-center gap-3 mb-6">
        <div className="w-9 h-9 bg-zinc-100 rounded-xl flex items-center justify-center">
          <Shield
            className="text-zinc-600"
            style={{ width: "1.125rem", height: "1.125rem" }}
          />
        </div>
        <div>
          <h2 className="text-lg font-bold text-zinc-900">
            パートナー稼働管理
          </h2>
          <p className="text-xs text-zinc-500 mt-0.5">
            {year}年{month}月の稼働状況（ADMIN専用）
          </p>
        </div>
      </div>

      {/* サマリーカード */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
        {summaryCards.map(({ label, count, cls, bg }) => (
          <div
            key={label}
            className={`${bg} border border-zinc-200 rounded-xl px-4 py-3`}
          >
            <p className="text-[11px] text-zinc-500 font-semibold mb-0.5">
              {label}
            </p>
            <div className="flex items-center gap-2">
              <p className={`text-2xl font-bold ${cls}`}>{count}</p>
              <Users className="w-4 h-4 text-zinc-300" />
            </div>
          </div>
        ))}
      </div>

      {/* テーブル（クライアントコンポーネント） */}
      <PartnerStatusTable partners={statuses} alerts={alerts} />
    </div>
  );
}
