import { redirect, notFound } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Download } from "lucide-react";
import { auth } from "@/lib/auth";
import type { UserRole } from "@/types/roles";
import { getGroupInvoiceById } from "@/lib/actions/group-invoice";
import { GroupInvoiceActions } from "./group-invoice-actions";

const STATUS_BADGE: Record<string, { label: string; cls: string }> = {
  DRAFT: { label: "下書き", cls: "bg-zinc-100 text-zinc-600 border-zinc-200" },
  ISSUED: { label: "発行済", cls: "bg-blue-50 text-blue-700 border-blue-200" },
  PAID: { label: "入金済", cls: "bg-emerald-50 text-emerald-700 border-emerald-200" },
};
const TYPE_LABEL: Record<string, string> = { ROYALTY: "月額ロイヤリティ", MEMBERSHIP: "加盟参画費用", OTHER: "その他" };

function fmtNum(n: number | { toString(): string }): string {
  return Number(n).toLocaleString("ja-JP");
}
function fmtDate(d: Date | string | null): string {
  if (!d) return "—";
  return new Date(d).toLocaleDateString("ja-JP", { year: "numeric", month: "long", day: "numeric" });
}

export default async function GroupInvoiceDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await auth();
  const role = (session?.user?.role ?? "USER") as UserRole;
  if (role !== "ADMIN") redirect("/dashboard");

  const invoice = await getGroupInvoiceById(id);
  if (!invoice) notFound();

  const badge = STATUS_BADGE[invoice.status] ?? STATUS_BADGE.DRAFT;

  return (
    <div className="px-6 py-6 max-w-3xl mx-auto w-full">
      <Link href="/dashboard/admin/group-invoices" className="inline-flex items-center gap-1.5 text-xs text-zinc-500 hover:text-zinc-800 mb-4 transition-colors">
        <ArrowLeft className="w-3.5 h-3.5" />
        グループ請求書に戻る
      </Link>

      <div className="bg-white border border-zinc-200 rounded-2xl overflow-hidden">
        {/* ヘッダー */}
        <div className="px-6 py-5 border-b border-zinc-100 flex items-start justify-between flex-wrap gap-3">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="text-xs font-mono text-zinc-400">{invoice.invoiceNo}</span>
              <span className={`inline-block px-2 py-0.5 text-[11px] font-semibold rounded-full border ${badge.cls}`}>{badge.label}</span>
            </div>
            <h2 className="text-lg font-bold text-zinc-900">{invoice.title}</h2>
            <p className="text-xs text-zinc-500 mt-1">
              {TYPE_LABEL[invoice.type] ?? invoice.type}
              {invoice.targetMonth ? `・対象月 ${invoice.targetMonth}` : ""}
            </p>
          </div>
          <a href={`/api/group-invoices/${invoice.id}/pdf`} className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-zinc-900 text-white text-xs font-medium rounded-lg hover:bg-zinc-700 transition-colors">
            <Download className="w-3.5 h-3.5" />PDF
          </a>
        </div>

        {/* 宛先・期日 */}
        <div className="px-6 py-4 grid grid-cols-2 gap-4 border-b border-zinc-100 text-sm">
          <div>
            <p className="text-[11px] text-zinc-400 mb-1">請求先</p>
            <p className="font-medium text-zinc-900">{invoice.groupCompany.name}</p>
            <p className="text-xs text-zinc-500">{invoice.groupCompany.ownerName} 御中</p>
          </div>
          <div>
            <p className="text-[11px] text-zinc-400 mb-1">請求日 / 支払期限</p>
            <p className="text-zinc-800">{fmtDate(invoice.issueDate)}</p>
            <p className="text-xs text-zinc-500">期限: {fmtDate(invoice.dueDate)}</p>
          </div>
        </div>

        {/* 明細 */}
        <div className="px-6 py-4">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-zinc-200 text-[11px] text-zinc-500">
                <th className="text-left py-2 font-semibold">品目</th>
                <th className="text-right py-2 font-semibold">数量</th>
                <th className="text-right py-2 font-semibold">単価（税抜）</th>
                <th className="text-right py-2 font-semibold">金額（税抜）</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100">
              {invoice.items.map((it) => (
                <tr key={it.id}>
                  <td className="py-2.5">
                    <p className="text-zinc-800">{it.name}</p>
                    {it.detail && <p className="text-[11px] text-zinc-400">{it.detail}</p>}
                  </td>
                  <td className="py-2.5 text-right text-zinc-600">{fmtNum(it.quantity)}</td>
                  <td className="py-2.5 text-right text-zinc-600">¥{fmtNum(it.unitPrice)}</td>
                  <td className="py-2.5 text-right font-medium text-zinc-900">¥{fmtNum(it.amount)}</td>
                </tr>
              ))}
            </tbody>
          </table>

          <div className="flex flex-col items-end gap-1 mt-4 pt-3 border-t border-zinc-200">
            <div className="flex justify-between w-1/2 text-sm"><span className="text-zinc-500">小計（税抜）</span><span className="font-medium">¥{fmtNum(invoice.subtotalExclTax)}</span></div>
            <div className="flex justify-between w-1/2 text-sm"><span className="text-zinc-500">消費税（10%）</span><span className="font-medium">¥{fmtNum(invoice.taxAmount)}</span></div>
            <div className="flex justify-between w-1/2 text-base pt-1.5 mt-1 border-t border-zinc-200"><span className="font-semibold text-zinc-700">ご請求金額（税込）</span><span className="font-bold text-indigo-700">¥{fmtNum(invoice.totalInclTax)}</span></div>
          </div>
        </div>

        {invoice.description && (
          <div className="px-6 py-4 border-t border-zinc-100">
            <p className="text-[11px] text-zinc-400 mb-1">備考</p>
            <p className="text-sm text-zinc-700 whitespace-pre-wrap">{invoice.description}</p>
          </div>
        )}

        {/* 操作 */}
        <div className="px-6 py-4 border-t border-zinc-100 bg-zinc-50/50">
          <GroupInvoiceActions id={invoice.id} status={invoice.status} />
        </div>
      </div>
    </div>
  );
}
