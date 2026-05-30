import { redirect } from "next/navigation";
import { Sparkles, Download, FileText } from "lucide-react";
import { auth } from "@/lib/auth";
import type { UserRole } from "@/types/roles";
import { getMonthlyRoyaltyOverview, getGroupInvoices } from "@/lib/actions/group-invoice";

function monthKeyAgo(delta: number): string {
  const d = new Date();
  const t = new Date(d.getFullYear(), d.getMonth() - delta, 1);
  return `${t.getFullYear()}-${String(t.getMonth() + 1).padStart(2, "0")}`;
}
function fmtMonthLabel(month: string): string {
  const [y, m] = month.split("-");
  return `${y}年${parseInt(m, 10)}月`;
}

const INVOICE_BADGE: Record<string, { label: string; cls: string }> = {
  ISSUED: { label: "お支払い前", cls: "bg-blue-50 text-blue-700 border-blue-200" },
  PAID: { label: "入金確認済", cls: "bg-emerald-50 text-emerald-700 border-emerald-200" },
};

export default async function PartnerRoyaltyPage() {
  const session = await auth();
  const role = (session?.user?.role ?? "USER") as UserRole;
  if (role === "ADMIN") redirect("/dashboard/admin/royalty");

  // 直近3ヶ月のロイヤリティ状況（自社のみ）
  const months = [monthKeyAgo(0), monthKeyAgo(1), monthKeyAgo(2)];
  const overviews = await Promise.all(months.map((m) => getMonthlyRoyaltyOverview(m)));
  const monthRows = months.map((m, i) => ({ month: m, row: overviews[i][0] ?? null }));

  // 自社の発行済・入金済 請求書
  const invoices = (await getGroupInvoices()).filter((inv) => inv.status === "ISSUED" || inv.status === "PAID");

  return (
    <div className="px-6 py-6 max-w-3xl mx-auto w-full">
      <div className="flex items-center gap-3 mb-6">
        <div className="w-9 h-9 bg-indigo-50 rounded-xl flex items-center justify-center">
          <Sparkles className="text-indigo-600" style={{ width: "1.125rem", height: "1.125rem" }} />
        </div>
        <div>
          <h2 className="text-lg font-bold text-zinc-900">ロイヤリティ</h2>
          <p className="text-xs text-zinc-500 mt-0.5">毎月のロイヤリティ状況とご請求</p>
        </div>
      </div>

      {/* 直近3ヶ月のステータスカード */}
      <div className="space-y-3 mb-8">
        {monthRows.map(({ month, row }) => {
          const covered = row?.isCovered ?? false;
          const invoice = row?.invoice ?? null;
          return (
            <div key={month} className={`rounded-xl border px-5 py-4 ${covered ? "bg-gradient-to-r from-emerald-50 to-white border-emerald-200" : "bg-white border-zinc-200"}`}>
              <div className="flex items-center justify-between flex-wrap gap-2">
                <p className="text-sm font-bold text-zinc-800">{fmtMonthLabel(month)}</p>
                {covered ? (
                  <span className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-semibold rounded-full bg-emerald-100 text-emerald-700">
                    <Sparkles className="w-3.5 h-3.5" />最低保証クリア
                  </span>
                ) : invoice ? (
                  <span className={`inline-block px-2.5 py-1 text-xs font-semibold rounded-full border ${(INVOICE_BADGE[invoice.status] ?? INVOICE_BADGE.ISSUED).cls}`}>
                    {(INVOICE_BADGE[invoice.status] ?? INVOICE_BADGE.ISSUED).label}
                  </span>
                ) : (
                  <span className="inline-block px-2.5 py-1 text-xs font-semibold rounded-full bg-zinc-100 text-zinc-500">集計中</span>
                )}
              </div>

              {covered ? (
                <p className="text-sm text-emerald-800 mt-2">
                  今月もご貢献いただきありがとうございます。案件のお取り扱いが最低保証に達しているため、<span className="font-semibold">追加のロイヤリティのご請求はありません。</span>
                </p>
              ) : invoice ? (
                <div className="flex items-center justify-between mt-2">
                  <p className="text-sm text-zinc-600">ロイヤリティのご請求があります（ご請求額 ¥{invoice.totalInclTax.toLocaleString("ja-JP")}）。</p>
                  <a href={`/api/group-invoices/${invoice.id}/pdf`} className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-zinc-900 text-white text-xs font-medium rounded-lg hover:bg-zinc-700 transition-colors">
                    <Download className="w-3.5 h-3.5" />請求書PDF
                  </a>
                </div>
              ) : (
                <p className="text-sm text-zinc-500 mt-2">当月分は集計中です。確定までしばらくお待ちください。</p>
              )}
            </div>
          );
        })}
      </div>

      {/* 請求書一覧 */}
      <div>
        <h3 className="text-sm font-bold text-zinc-800 mb-3 flex items-center gap-1.5"><FileText className="w-4 h-4 text-zinc-400" />請求書</h3>
        {invoices.length === 0 ? (
          <div className="bg-white border border-zinc-200 rounded-xl px-6 py-10 text-center">
            <p className="text-sm text-zinc-400">現在、ご請求はありません</p>
          </div>
        ) : (
          <div className="bg-white border border-zinc-200 rounded-xl overflow-hidden divide-y divide-zinc-100">
            {invoices.map((inv) => (
              <div key={inv.id} className="flex items-center justify-between px-5 py-3.5">
                <div>
                  <p className="text-sm font-medium text-zinc-800">{inv.title}</p>
                  <p className="text-[11px] text-zinc-400 font-mono">{inv.invoiceNo}</p>
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-sm font-bold text-zinc-900">¥{Number(inv.totalInclTax).toLocaleString("ja-JP")}</span>
                  <span className={`inline-block px-2 py-0.5 text-[11px] font-semibold rounded-full border ${(INVOICE_BADGE[inv.status] ?? INVOICE_BADGE.ISSUED).cls}`}>
                    {(INVOICE_BADGE[inv.status] ?? INVOICE_BADGE.ISSUED).label}
                  </span>
                  <a href={`/api/group-invoices/${inv.id}/pdf`} className="inline-flex items-center gap-1 px-2.5 py-1 bg-zinc-100 text-zinc-700 text-xs font-medium rounded-lg hover:bg-zinc-200 transition-colors">
                    <Download className="w-3.5 h-3.5" />PDF
                  </a>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
