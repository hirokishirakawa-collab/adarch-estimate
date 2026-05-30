import { redirect } from "next/navigation";
import Link from "next/link";
import { ChevronLeft, ChevronRight, TrendingUp, Sparkles } from "lucide-react";
import { auth } from "@/lib/auth";
import type { UserRole } from "@/types/roles";
import { getMonthlyRoyaltyOverview } from "@/lib/actions/group-invoice";
import { MIN_ROYALTY_EXCL_TAX } from "@/lib/royalty-monthly";
import { CreateRoyaltyInvoiceButton } from "./create-royalty-invoice-button";

const INVOICE_BADGE: Record<string, { label: string; cls: string }> = {
  DRAFT: { label: "下書き", cls: "bg-zinc-100 text-zinc-600 border-zinc-200" },
  ISSUED: { label: "発行済", cls: "bg-blue-50 text-blue-700 border-blue-200" },
  PAID: { label: "入金済", cls: "bg-emerald-50 text-emerald-700 border-emerald-200" },
};

function currentMonthKey(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}
function shiftMonth(month: string, delta: number): string {
  const [y, m] = month.split("-").map(Number);
  const d = new Date(y, m - 1 + delta, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}
function fmtMonthLabel(month: string): string {
  const [y, m] = month.split("-");
  return `${y}年${parseInt(m, 10)}月`;
}

export default async function AdminRoyaltyPage({ searchParams }: { searchParams: Promise<{ month?: string }> }) {
  const session = await auth();
  const role = (session?.user?.role ?? "USER") as UserRole;
  if (role !== "ADMIN") redirect("/dashboard");

  const sp = await searchParams;
  const month = /^\d{4}-\d{2}$/.test(sp.month ?? "") ? sp.month! : currentMonthKey();

  const rows = await getMonthlyRoyaltyOverview(month);

  const needBilling = rows.filter((r) => !r.isCovered && !r.invoice);
  const totalShortfall = needBilling.reduce((s, r) => s + r.shortfallExclTax, 0);
  const coveredCount = rows.filter((r) => r.isCovered).length;

  return (
    <div className="px-6 py-6 max-w-screen-xl mx-auto w-full">
      <div className="flex items-center justify-between mb-6 flex-wrap gap-4">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 bg-indigo-50 rounded-xl flex items-center justify-center">
            <TrendingUp className="text-indigo-600" style={{ width: "1.125rem", height: "1.125rem" }} />
          </div>
          <div>
            <h2 className="text-lg font-bold text-zinc-900">ロイヤリティ状況</h2>
            <p className="text-xs text-zinc-500 mt-0.5">最低保証 max(¥{MIN_ROYALTY_EXCL_TAX.toLocaleString()}, 案件手数料10%)。未達のみ差額を請求</p>
          </div>
        </div>
        <Link href="/dashboard/admin/group-invoices" className="text-xs text-indigo-600 hover:text-indigo-700 font-medium">請求書一覧 →</Link>
      </div>

      {/* 月ナビ */}
      <div className="flex items-center justify-center gap-4 mb-6">
        <Link href={`/dashboard/admin/royalty?month=${shiftMonth(month, -1)}`} className="p-2 rounded-lg hover:bg-zinc-100 transition-colors"><ChevronLeft className="w-4 h-4 text-zinc-500" /></Link>
        <p className="text-base font-bold text-zinc-900 w-32 text-center">{fmtMonthLabel(month)}</p>
        <Link href={`/dashboard/admin/royalty?month=${shiftMonth(month, 1)}`} className="p-2 rounded-lg hover:bg-zinc-100 transition-colors"><ChevronRight className="w-4 h-4 text-zinc-500" /></Link>
      </div>

      {/* サマリー */}
      <div className="grid grid-cols-3 gap-3 mb-6">
        <div className="bg-emerald-50 border border-zinc-200 rounded-xl px-4 py-3">
          <p className="text-[11px] text-zinc-500 font-semibold">相殺済み（貢献層）</p>
          <p className="text-2xl font-bold text-emerald-700">{coveredCount}<span className="text-sm font-medium text-zinc-400 ml-1">社</span></p>
        </div>
        <div className="bg-amber-50 border border-zinc-200 rounded-xl px-4 py-3">
          <p className="text-[11px] text-zinc-500 font-semibold">要請求（未達）</p>
          <p className="text-2xl font-bold text-amber-700">{needBilling.length}<span className="text-sm font-medium text-zinc-400 ml-1">社</span></p>
        </div>
        <div className="bg-zinc-50 border border-zinc-200 rounded-xl px-4 py-3">
          <p className="text-[11px] text-zinc-500 font-semibold">請求差額 合計（税抜）</p>
          <p className="text-2xl font-bold text-zinc-800">¥{totalShortfall.toLocaleString("ja-JP")}</p>
        </div>
      </div>

      {/* マトリクス */}
      <div className="bg-white border border-zinc-200 rounded-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-zinc-50 border-b border-zinc-200">
                <th className="px-4 py-3 text-left text-xs font-semibold text-zinc-600">パートナー</th>
                <th className="px-4 py-3 text-right text-xs font-semibold text-zinc-600">最低保証（税抜）</th>
                <th className="px-4 py-3 text-right text-xs font-semibold text-zinc-600">当月手数料（10%・税抜）</th>
                <th className="px-4 py-3 text-center text-xs font-semibold text-zinc-600">判定</th>
                <th className="px-4 py-3 text-right text-xs font-semibold text-zinc-600">請求差額（税抜）</th>
                <th className="px-4 py-3 text-center text-xs font-semibold text-zinc-600">請求書</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100">
              {rows.map((r) => (
                <tr key={r.groupCompanyId} className="hover:bg-zinc-50/50">
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-1.5">
                      <p className="text-sm text-zinc-800">{r.name}</p>
                      {r.units > 1 && (
                        <span className="inline-block px-1.5 py-0.5 text-[10px] font-bold rounded border bg-indigo-50 text-indigo-700 border-indigo-200">{r.units}拠点</span>
                      )}
                    </div>
                    <p className="text-[11px] text-zinc-400">{r.ownerName}</p>
                    {r.branches.length > 0 && (
                      <div className="flex flex-wrap gap-1 mt-1">
                        {r.branches.map((b) => (
                          <span key={b.label} className={`inline-block px-1.5 py-0.5 text-[10px] rounded border ${b.isCovered ? "bg-emerald-50 text-emerald-700 border-emerald-200" : "bg-amber-50 text-amber-700 border-amber-200"}`}>
                            {b.label} ¥{b.commissionExclTax.toLocaleString("ja-JP")}{b.isCovered ? " ✓" : ` → 要¥${b.shortfallExclTax.toLocaleString("ja-JP")}`}
                          </span>
                        ))}
                      </div>
                    )}
                    {r.untaggedCommissionExclTax > 0 && (
                      <p className="text-[10px] text-red-500 mt-1">⚠ 県未指定 ¥{r.untaggedCommissionExclTax.toLocaleString("ja-JP")}（支払明細に県を割当ててください）</p>
                    )}
                  </td>
                  <td className="px-4 py-3 text-right text-zinc-500">¥{r.minRoyaltyExclTax.toLocaleString("ja-JP")}</td>
                  <td className="px-4 py-3 text-right text-zinc-700">¥{r.commissionTotalExclTax.toLocaleString("ja-JP")}</td>
                  <td className="px-4 py-3 text-center">
                    {r.isCovered ? (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 text-[11px] font-semibold rounded-full border bg-emerald-50 text-emerald-700 border-emerald-200">
                        <Sparkles className="w-3 h-3" />相殺済み
                      </span>
                    ) : (
                      <span className="inline-block px-2 py-0.5 text-[11px] font-semibold rounded-full border bg-amber-50 text-amber-700 border-amber-200">要請求</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-right font-medium text-zinc-900">
                    {r.isCovered ? <span className="text-zinc-300">—</span> : `¥${r.shortfallExclTax.toLocaleString("ja-JP")}`}
                  </td>
                  <td className="px-4 py-3 text-center">
                    {r.invoice ? (
                      <Link href={`/dashboard/admin/group-invoices/${r.invoice.id}`} className="inline-flex items-center gap-1.5">
                        <span className="text-[11px] font-mono text-indigo-600 hover:underline">{r.invoice.invoiceNo}</span>
                        <span className={`inline-block px-1.5 py-0.5 text-[10px] font-semibold rounded border ${(INVOICE_BADGE[r.invoice.status] ?? INVOICE_BADGE.DRAFT).cls}`}>
                          {(INVOICE_BADGE[r.invoice.status] ?? INVOICE_BADGE.DRAFT).label}
                        </span>
                      </Link>
                    ) : r.isCovered ? (
                      <span className="text-[11px] text-zinc-400">不要</span>
                    ) : (
                      <CreateRoyaltyInvoiceButton groupCompanyId={r.groupCompanyId} month={month} />
                    )}
                  </td>
                </tr>
              ))}
              {rows.length === 0 && (
                <tr><td colSpan={6} className="px-4 py-12 text-center text-sm text-zinc-400">対象パートナーがいません</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
