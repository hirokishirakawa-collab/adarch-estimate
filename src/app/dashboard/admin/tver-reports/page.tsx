// ==============================================================
// TVer配信実績 — 本部の一覧＋CSV取込（ADMINだけ。ページとアクションで二重に判定）
//   manage.tver.sale の配信レポートCSVを取り込み → 卸値×3の売価を確認 → 拠点を紐づけ → 「確認完了」で公開
// ==============================================================

import { redirect } from "next/navigation";
import Link from "next/link";
import { BarChart2 } from "lucide-react";
import { auth } from "@/lib/auth";
import type { UserRole } from "@/types/roles";
import { db } from "@/lib/db";
import type { TverDeliveryReportStatus } from "@/generated/prisma/client";
import { SELL_MULTIPLIER } from "@/lib/tver/plan";
import { CROSS_CHECK_WARN_PCT, isActionWarning } from "@/lib/tver/delivery-csv";
import { weeklyAudit } from "@/lib/tver/audit";
import { ImportForm } from "./import-form";
import { ReportsTable, type ReportRow } from "./reports-table";

export const dynamic = "force-dynamic";

type SP = { status?: string; company?: string; from?: string; to?: string };

export default async function AdminTverReportsPage({ searchParams }: { searchParams: Promise<SP> }) {
  const session = await auth();
  const role = (session?.user?.role ?? "USER") as UserRole;
  if (role !== "ADMIN") redirect("/dashboard");

  const sp = await searchParams;
  const status = sp.status === "IMPORTED" || sp.status === "PUBLISHED" ? (sp.status as TverDeliveryReportStatus) : null;
  const fromD = sp.from && /^\d{4}-\d{2}-\d{2}$/.test(sp.from) ? new Date(sp.from) : null;
  const toD = sp.to && /^\d{4}-\d{2}-\d{2}$/.test(sp.to) ? new Date(new Date(sp.to).getTime() + 86_400_000) : null;

  const [reports, companies, audit] = await Promise.all([
    db.tverDeliveryReport.findMany({
      where: {
        ...(status ? { status } : {}),
        ...(sp.company ? { groupCompanyId: sp.company } : {}),
        ...(fromD || toD ? { periodEnd: { ...(fromD ? { gte: fromD } : {}), ...(toD ? { lt: toD } : {}) } } : {}),
      },
      orderBy: { createdAt: "desc" },
      take: 500,
      include: { groupCompany: { select: { id: true, name: true } }, tverOrder: { select: { id: true, number: true, createdAt: true } } },
    }),
    db.groupCompany.findMany({ where: { isActive: true }, select: { id: true, name: true, prefecture: true }, orderBy: { name: "asc" } }),
    weeklyAudit(),
  ]);

  const rows: ReportRow[] = reports.map((r) => ({
    id: r.id,
    createdAt: r.createdAt.toISOString(),
    periodStart: r.periodStart.toISOString(),
    periodEnd: r.periodEnd.toISOString(),
    advertiser: r.advertiserName,
    advertiserTverId: r.advertiserTverId,
    company: r.groupCompany?.name ?? "",
    adSeconds: r.adSeconds,
    impressions: r.impressions,
    completes: r.completes,
    wholesaleAmount: r.wholesaleAmount,
    sellAmount: r.sellAmountAdjusted ?? r.sellAmount,
    adjusted: r.sellAmountAdjusted != null && r.sellAmountAdjusted !== r.sellAmount,
    diffPct: r.crossCheckDiffPct,
    warnings: r.warnings.filter(isActionWarning).length,
    notes: r.warnings.length - r.warnings.filter(isActionWarning).length,
    status: r.status,
  }));
  const pendingCount = reports.filter((r) => r.status === "IMPORTED").length;

  return (
    <div className="px-6 py-6 max-w-screen-2xl mx-auto w-full space-y-5">
      <div className="flex items-center gap-3">
        <div className="w-9 h-9 bg-orange-50 rounded-xl flex items-center justify-center">
          <BarChart2 className="text-orange-600" style={{ width: "1.125rem", height: "1.125rem" }} />
        </div>
        <div>
          <h1 className="text-lg font-bold text-zinc-900">TVer配信実績（本部の取込・確認）</h1>
          <p className="text-xs text-zinc-500 mt-0.5">
            TVer管理画面の「配信レポート」CSVを取り込むと、卸値×{SELL_MULTIPLIER}の売価を自動計算します。表示回数×売単価の裏計算と{CROSS_CHECK_WARN_PCT}%以上ずれた場合は警告。拠点を紐づけて「確認完了」を押した分だけ拠点に見えます（卸値の列は拠点に出ません）。
          </p>
        </div>
        {pendingCount > 0 && <span className="ml-auto px-3 py-1.5 rounded-lg bg-orange-50 text-orange-700 text-sm font-medium">確認待ち {pendingCount}件</span>}
      </div>

      <section className="bg-white border border-zinc-200 rounded-xl p-5">
        <div className="flex items-center gap-2 mb-2">
          <h2 className="text-sm font-bold text-zinc-900">今週やること（申込台帳と実績の突き合わせ）</h2>
          {audit.length > 0 ? <span className="px-2 py-0.5 rounded-md text-xs bg-rose-50 text-rose-700">{audit.filter((a) => a.severity === "red").length}件 要対応・{audit.filter((a) => a.severity === "amber").length}件 確認</span> : <span className="px-2 py-0.5 rounded-md text-xs bg-emerald-50 text-emerald-700">問題なし</span>}
        </div>
        <p className="text-xs text-zinc-500 mb-3">週1回（曜日を決めて）: ①TVerで各広告主の配信レポートをダウンロード → ②ここで取込（同じ広告主・重なる期間は自動で差し替え） → ③下の一覧を上から潰す。TVerのキャンペーン名にOSの申込番号（例: TV-2026-0042）を入れておくと申込と拠点に自動で紐づきます。キャンペーンは「期間予算・終了日＝契約終了日」で登録すると停止作業そのものが無くなります。</p>
        {audit.length > 0 && (
          <ul className="divide-y divide-zinc-100">
            {audit.map((a, i) => (
              <li key={i} className="py-2 flex flex-wrap items-start gap-x-3 gap-y-1 text-sm">
                <span className={`px-2 py-0.5 rounded-md text-xs whitespace-nowrap ${a.severity === "red" ? "bg-rose-50 text-rose-700" : "bg-amber-50 text-amber-700"}`}>{a.title}</span>
                <span className="font-medium text-zinc-900 whitespace-nowrap"><Link href={`/dashboard/admin/tver-orders/${a.orderId}`} className="hover:text-orange-600">{a.orderNo}</Link> {a.advertiser}</span>
                <span className="text-xs text-zinc-500 whitespace-nowrap">{a.company}</span>
                <span className="text-zinc-700 basis-full sm:basis-auto sm:flex-1">{a.detail}{a.reportId ? <>　<Link href={`/dashboard/admin/tver-reports/${a.reportId}`} className="text-orange-600 underline">実績</Link></> : null}</span>
              </li>
            ))}
          </ul>
        )}
      </section>

      <ImportForm companies={companies} />

      <form className="flex flex-wrap items-end gap-3 text-sm" method="get">
        <label className="text-xs text-zinc-600">状態
          <select name="status" defaultValue={status ?? ""} className="block mt-1 rounded-lg border border-zinc-300 px-2 py-1.5 text-sm">
            <option value="">すべて</option>
            <option value="IMPORTED">確認待ち</option>
            <option value="PUBLISHED">公開済み</option>
          </select>
        </label>
        <label className="text-xs text-zinc-600">拠点
          <select name="company" defaultValue={sp.company ?? ""} className="block mt-1 rounded-lg border border-zinc-300 px-2 py-1.5 text-sm max-w-[16rem]">
            <option value="">すべて</option>
            {companies.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </label>
        <label className="text-xs text-zinc-600">期間終了日（から）
          <input type="date" name="from" defaultValue={sp.from ?? ""} className="block mt-1 rounded-lg border border-zinc-300 px-2 py-1.5 text-sm" />
        </label>
        <label className="text-xs text-zinc-600">（まで）
          <input type="date" name="to" defaultValue={sp.to ?? ""} className="block mt-1 rounded-lg border border-zinc-300 px-2 py-1.5 text-sm" />
        </label>
        <button className="px-3 py-1.5 rounded-lg bg-zinc-900 text-white text-sm">絞り込む</button>
      </form>

      <ReportsTable rows={rows} />
    </div>
  );
}
