import { redirect } from "next/navigation";
import Link from "next/link";
import { ChevronLeft, ChevronRight, ClipboardCheck } from "lucide-react";
import { auth } from "@/lib/auth";
import type { UserRole } from "@/types/roles";
import { getRoyaltyYearCheck } from "@/lib/actions/royalty-check";
import { ROYALTY_DUE_DAY } from "@/lib/royalty-monthly";
import { RoyaltyCheckGrid } from "./royalty-check-grid";

function fmtMd(iso: string): string {
  const [, m, d] = iso.split("-");
  return `${parseInt(m, 10)}/${parseInt(d, 10)}`;
}

export default async function AdminRoyaltyCheckPage({ searchParams }: { searchParams: Promise<{ year?: string }> }) {
  const session = await auth();
  const role = (session?.user?.role ?? "USER") as UserRole;
  if (role !== "ADMIN") redirect("/dashboard");

  const sp = await searchParams;
  const thisYear = new Date().getFullYear();
  const year = /^\d{4}$/.test(sp.year ?? "") ? Number(sp.year) : thisYear;

  const data = await getRoyaltyYearCheck(year);
  if (!data) redirect("/dashboard");

  // サマリー＝期限が到来している最新の対象月
  const latest = data.latestDueMonth;
  const latestIdx = latest ? data.months.findIndex((m) => m.month === latest) : -1;
  const latestCells = latestIdx >= 0 ? data.rows.map((r) => r.cells[latestIdx]) : [];
  const count = (s: string) => latestCells.filter((c) => c.status === s).length;
  const overdueTotal = latestCells.filter((c) => c.status === "OVERDUE").reduce((s, c) => s + c.expectedInclTax, 0);
  const overdueAllYear = data.rows.reduce((s, r) => s + r.cells.filter((c) => c.status === "OVERDUE").length, 0);

  return (
    <div className="px-6 py-6 max-w-screen-2xl mx-auto w-full">
      <div className="flex items-center justify-between mb-6 flex-wrap gap-4">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 bg-emerald-50 rounded-xl flex items-center justify-center">
            <ClipboardCheck className="text-emerald-600" style={{ width: "1.125rem", height: "1.125rem" }} />
          </div>
          <div>
            <h2 className="text-lg font-bold text-zinc-900">ロイヤリティ入金チェック</h2>
            <p className="text-xs text-zinc-500 mt-0.5">
              本部専用。社×月で入金の有無を記録。ロイヤリティ＝max(最低保証, 月次報告の売上×10%)。期限＝対象月の翌々月{ROYALTY_DUE_DAY}日。相殺・免除・期限超過は自動判定
            </p>
          </div>
        </div>
        <Link href="/dashboard/admin/royalty" className="text-xs text-indigo-600 hover:text-indigo-700 font-medium">ロイヤリティ状況（月別判定）→</Link>
      </div>

      {/* 年ナビ */}
      <div className="flex items-center justify-center gap-4 mb-6">
        <Link href={`/dashboard/admin/royalty/check?year=${year - 1}`} className="p-2 rounded-lg hover:bg-zinc-100 transition-colors"><ChevronLeft className="w-4 h-4 text-zinc-500" /></Link>
        <p className="text-base font-bold text-zinc-900 w-24 text-center">{year}年</p>
        <Link href={`/dashboard/admin/royalty/check?year=${year + 1}`} className="p-2 rounded-lg hover:bg-zinc-100 transition-colors"><ChevronRight className="w-4 h-4 text-zinc-500" /></Link>
      </div>

      {/* サマリー */}
      {latest && latestIdx >= 0 ? (
        <div className="mb-6">
          <p className="text-[11px] text-zinc-500 font-semibold mb-2">
            直近期限分＝{parseInt(latest.split("-")[1], 10)}月分（期限 {fmtMd(data.months[latestIdx].dueDate)}）
          </p>
          <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
            <div className="bg-emerald-50 border border-zinc-200 rounded-xl px-4 py-3">
              <p className="text-[11px] text-zinc-500 font-semibold">✅ 入金済</p>
              <p className="text-2xl font-bold text-emerald-700">{count("PAID")}<span className="text-sm font-medium text-zinc-400 ml-1">社</span></p>
            </div>
            <div className="bg-sky-50 border border-zinc-200 rounded-xl px-4 py-3">
              <p className="text-[11px] text-zinc-500 font-semibold">🔷 相殺済（支払不要）</p>
              <p className="text-2xl font-bold text-sky-700">{count("OFFSET")}<span className="text-sm font-medium text-zinc-400 ml-1">社</span></p>
            </div>
            <div className="bg-zinc-50 border border-zinc-200 rounded-xl px-4 py-3">
              <p className="text-[11px] text-zinc-500 font-semibold">➖ 免除</p>
              <p className="text-2xl font-bold text-zinc-600">{count("EXEMPT")}<span className="text-sm font-medium text-zinc-400 ml-1">社</span></p>
            </div>
            <div className="bg-red-50 border border-red-200 rounded-xl px-4 py-3">
              <p className="text-[11px] text-zinc-500 font-semibold">🔴 未入金（期限超過）</p>
              <p className="text-2xl font-bold text-red-700">{count("OVERDUE")}<span className="text-sm font-medium text-zinc-400 ml-1">社</span></p>
            </div>
            <div className="bg-red-50 border border-red-200 rounded-xl px-4 py-3">
              <p className="text-[11px] text-zinc-500 font-semibold">未入金 合計（税込・見込）</p>
              <p className="text-2xl font-bold text-red-700">¥{overdueTotal.toLocaleString("ja-JP")}</p>
              {overdueAllYear > count("OVERDUE") && (
                <p className="text-[10px] text-red-500 mt-0.5">年内の未入金セルは計 {overdueAllYear}件</p>
              )}
            </div>
          </div>
        </div>
      ) : (
        <p className="mb-6 text-xs text-zinc-400 text-center">この年は期限が到来した月がまだありません</p>
      )}

      <RoyaltyCheckGrid data={data} />
    </div>
  );
}
