import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { Shield, Flag } from "lucide-react";
import { ViolationReportList } from "@/components/admin/violation-report-list";
import type { UserRole } from "@/types/roles";

export default async function AdminViolationReportsPage() {
  // ── ADMIN ガード ──────────────────────────────────────────────
  const session = await auth();
  const role = (session?.user?.role ?? "USER") as UserRole;
  if (role !== "ADMIN") redirect("/dashboard");

  // ── 全通報を取得 ─────────────────────────────────────────────
  const reports = await db.violationReport.findMany({
    include: {
      reporterCompany: {
        select: { id: true, name: true, ownerName: true },
      },
    },
    orderBy: { createdAt: "desc" },
  });

  // ── ステータス別集計 ─────────────────────────────────────────
  const counts = {
    PENDING: reports.filter((r) => r.status === "PENDING").length,
    REVIEWING: reports.filter((r) => r.status === "REVIEWING").length,
    CONFIRMED: reports.filter((r) => r.status === "CONFIRMED").length,
    RESOLVED: reports.filter((r) => r.status === "RESOLVED").length,
  };

  const summaryCards = [
    {
      label: "未対応",
      count: counts.PENDING,
      cls: "text-red-700",
      bg: "bg-red-50",
    },
    {
      label: "調査中",
      count: counts.REVIEWING,
      cls: "text-amber-700",
      bg: "bg-amber-50",
    },
    {
      label: "確認済み",
      count: counts.CONFIRMED,
      cls: "text-orange-700",
      bg: "bg-orange-50",
    },
    {
      label: "対応済み",
      count: counts.RESOLVED,
      cls: "text-emerald-700",
      bg: "bg-emerald-50",
    },
  ];

  // ── シリアライズ ─────────────────────────────────────────────
  const serializedReports = reports.map((r) => ({
    id: r.id,
    reporterCompanyId: r.reporterCompanyId,
    isAnonymous: r.isAnonymous,
    targetDescription: r.targetDescription,
    content: r.content,
    evidenceUrls: r.evidenceUrls,
    status: r.status as
      | "PENDING"
      | "REVIEWING"
      | "CONFIRMED"
      | "DISMISSED"
      | "RESOLVED",
    adminNote: r.adminNote,
    createdAt: r.createdAt.toISOString(),
    reporterCompany: r.reporterCompany
      ? {
          id: r.reporterCompany.id,
          name: r.reporterCompany.name,
          ownerName: r.reporterCompany.ownerName,
        }
      : null,
  }));

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
          <h2 className="text-lg font-bold text-zinc-900">コンプライアンス相談管理</h2>
          <p className="text-xs text-zinc-500 mt-0.5">
            パートナーからのコンプライアンス相談を管理します（ADMIN専用）
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
              <Flag className="w-4 h-4 text-zinc-300" />
            </div>
          </div>
        ))}
      </div>

      {/* 通報リスト */}
      <ViolationReportList reports={serializedReports} />
    </div>
  );
}
