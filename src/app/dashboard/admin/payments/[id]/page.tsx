import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { auth } from "@/lib/auth";
import { ArrowLeft, Banknote, Download } from "lucide-react";
import type { UserRole } from "@/types/roles";
import { getPaymentStatementById } from "@/lib/actions/payment-statement";
import { breakdownFromStored } from "@/lib/payment-statement-calc";
import { PaymentStatusActions } from "./status-actions";

function fmtNum(n: number | bigint | { toString(): string }): string {
  return Number(n).toLocaleString("ja-JP");
}

function fmtDate(d: Date | string | null): string {
  if (!d) return "—";
  return new Date(d).toLocaleDateString("ja-JP", { year: "numeric", month: "2-digit", day: "2-digit" });
}

const STATUS_BADGE: Record<string, { label: string; cls: string }> = {
  DRAFT: { label: "下書き", cls: "bg-zinc-100 text-zinc-600" },
  CONFIRMED: { label: "確定", cls: "bg-blue-50 text-blue-700" },
  PAID: { label: "支払済", cls: "bg-emerald-50 text-emerald-700" },
};

export default async function PaymentDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  const role = (session?.user?.role ?? "USER") as UserRole;
  if (role !== "ADMIN") redirect("/dashboard");

  const { id } = await params;
  const s = await getPaymentStatementById(id);
  if (!s) notFound();

  const badge = STATUS_BADGE[s.status] ?? STATUS_BADGE.DRAFT;
  const gc = s.groupCompany;
  const hasBank = gc.bankName && gc.bankAccountNumber;

  const b = breakdownFromStored({
    grossAmount: Number(s.grossAmount),
    commissionRate: Number(s.commissionRate),
    commissionAmount: Number(s.commissionAmount),
    mediaExpense: Number(s.mediaExpense),
    productionExpense: Number(s.productionExpense),
    withholdingTaxAmount: Number(s.withholdingTaxAmount),
    nonDeductibleTaxAmount: Number(s.nonDeductibleTaxAmount),
    netPaymentAmount: Number(s.netPaymentAmount),
  });

  return (
    <div className="px-6 py-6 max-w-2xl mx-auto w-full">
      <Link
        href="/dashboard/admin/payments"
        className="inline-flex items-center gap-1.5 text-xs text-zinc-500 hover:text-zinc-800 transition-colors mb-4"
      >
        <ArrowLeft className="w-3.5 h-3.5" />
        一覧に戻る
      </Link>

      <div className="flex items-center gap-3 mb-6">
        <div className="w-9 h-9 bg-emerald-50 rounded-xl flex items-center justify-center">
          <Banknote className="text-emerald-600" style={{ width: "1.125rem", height: "1.125rem" }} />
        </div>
        <div className="flex-1">
          <h2 className="text-lg font-bold text-zinc-900">{s.title}</h2>
          <p className="text-xs text-zinc-500 mt-0.5">作成: {fmtDate(s.createdAt)} / {s.createdBy?.name ?? "—"}</p>
        </div>
        <span className={`px-3 py-1 text-xs font-semibold rounded-full ${badge.cls}`}>
          {badge.label}
        </span>
      </div>

      {/* パートナー情報 */}
      <div className="bg-zinc-50 border border-zinc-200 rounded-xl p-4 mb-4">
        <div className="flex justify-between items-start">
          <div>
            <p className="text-sm font-bold text-zinc-900">{gc.name}</p>
            <p className="text-xs text-zinc-500">{gc.ownerName}</p>
          </div>
          <div className="flex gap-1.5">
            <span className={`px-2 py-0.5 text-[11px] font-semibold rounded-full border ${
              gc.entityType === "SOLE_PROPRIETOR" ? "bg-amber-50 text-amber-700 border-amber-200"
              : gc.entityType === "CORPORATION" ? "bg-blue-50 text-blue-700 border-blue-200"
              : "bg-red-50 text-red-700 border-red-200"
            }`}>
              {gc.entityType === "SOLE_PROPRIETOR" ? "個人事業主" : gc.entityType === "CORPORATION" ? "法人" : "未確認"}
            </span>
            <span className={`px-2 py-0.5 text-[11px] font-semibold rounded-full border ${
              gc.invoiceRegistered ? "bg-emerald-50 text-emerald-700 border-emerald-200" : "bg-red-50 text-red-700 border-red-200"
            }`}>
              {gc.invoiceRegistered ? "インボイス済" : "インボイス未登録"}
            </span>
          </div>
        </div>
        {hasBank && (
          <div className="mt-2 pt-2 border-t border-zinc-200 text-xs text-zinc-600">
            <p>振込先: {gc.bankName} {gc.bankBranch} / {gc.bankAccountType === "SAVINGS" ? "普通" : "当座"} {gc.bankAccountNumber} / {gc.bankAccountHolder}</p>
          </div>
        )}
      </div>

      {/* クライアント別 入金内訳 */}
      {s.items && s.items.length > 0 && (
        <div className="bg-white border border-zinc-200 rounded-xl overflow-hidden mb-4">
          <div className="px-4 py-2.5 bg-zinc-50 border-b border-zinc-200">
            <p className="text-[11px] font-semibold text-zinc-500 uppercase tracking-wider">
              クライアント別 入金内訳（{s.items.length}件）
            </p>
          </div>
          <table className="w-full text-sm">
            <tbody className="divide-y divide-zinc-100">
              {s.items.map((it) => (
                <tr key={it.id}>
                  <td className="px-4 py-2.5 text-zinc-800">
                    {it.clientName}
                    {it.note && <span className="text-[11px] text-zinc-400 ml-2">{it.note}</span>}
                  </td>
                  <td className="px-4 py-2.5 text-right font-medium text-zinc-800">¥{fmtNum(it.grossAmount)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* 金額明細（税抜ベース） */}
      <div className="bg-white border border-zinc-200 rounded-xl p-5 mb-4 space-y-2">
        {s.clientName && (!s.items || s.items.length === 0) && (
          <div className="flex justify-between text-sm mb-1">
            <span className="text-zinc-500">クライアント</span>
            <span className="text-zinc-800 font-medium">{s.clientName}</span>
          </div>
        )}
        <div className="flex justify-between text-sm">
          <span className="text-zinc-500">入金額（税込）{s.items && s.items.length > 0 ? " 合計" : ""}</span>
          <span className="text-zinc-800 font-bold">¥{fmtNum(b.grossInclTax)}</span>
        </div>
        <div className="flex justify-between text-xs text-zinc-400">
          <span className="pl-3">本体（税抜）</span>
          <span>¥{fmtNum(b.grossExclTax)}</span>
        </div>
        <div className="flex justify-between text-xs text-zinc-400">
          <span className="pl-3">消費税（10%）</span>
          <span>¥{fmtNum(b.grossTax)}</span>
        </div>

        <div className="flex justify-between text-sm pt-1">
          <span className="text-zinc-500">本部手数料（{b.commissionRate}%・税抜）</span>
          <span className="text-red-600 font-medium">-¥{fmtNum(b.commissionExclTax)}</span>
        </div>

        <div className="flex justify-between text-sm pt-1 border-t border-zinc-100">
          <span className="text-zinc-500">パートナー報酬（税抜）</span>
          <span className="text-zinc-800 font-medium">¥{fmtNum(b.partnerFeeExclTax)}</span>
        </div>
        <div className="flex justify-between text-sm">
          <span className="text-zinc-500">消費税（10%）</span>
          <span className="text-zinc-800 font-medium">+¥{fmtNum(b.partnerTax)}</span>
        </div>
        <div className="flex justify-between text-sm">
          <span className="text-zinc-500">パートナー報酬（税込）</span>
          <span className="text-zinc-800 font-medium">¥{fmtNum(b.partnerInclTax)}</span>
        </div>

        {b.adMediaCost > 0 && (
          <div className="flex justify-between text-sm">
            <span className="text-zinc-500">広告媒体費（源泉対象外）</span>
            <span className="text-red-600 font-medium">-¥{fmtNum(b.adMediaCost)}</span>
          </div>
        )}
        {b.withholdingTaxAmount > 0 && (
          <div className="flex justify-between text-sm">
            <span className="text-zinc-500">源泉徴収税（制作費 ¥{fmtNum(b.productionExclTax)}）</span>
            <span className="text-red-600 font-medium">-¥{fmtNum(b.withholdingTaxAmount)}</span>
          </div>
        )}
        {b.nonDeductibleTaxAmount > 0 && (
          <div className="flex justify-between text-sm">
            <span className="text-zinc-500">控除不可消費税（インボイス未登録）</span>
            <span className="text-red-600 font-medium">-¥{fmtNum(b.nonDeductibleTaxAmount)}</span>
          </div>
        )}
        <div className="flex justify-between text-base pt-3 border-t border-emerald-200">
          <span className="font-semibold text-zinc-700">差引支払額</span>
          <span className="font-bold text-emerald-700 text-lg">¥{fmtNum(b.netPaymentAmount)}</span>
        </div>
        {s.paidAt && (
          <p className="text-xs text-emerald-600 text-right">支払日: {fmtDate(s.paidAt)}</p>
        )}
      </div>

      {s.description && (
        <div className="bg-white border border-zinc-200 rounded-xl p-4 mb-4">
          <p className="text-xs font-semibold text-zinc-500 mb-1">備考</p>
          <p className="text-sm text-zinc-700 whitespace-pre-wrap">{s.description}</p>
        </div>
      )}

      {/* アクション */}
      <div className="flex items-center gap-3">
        {s.status !== "PAID" && (
          <PaymentStatusActions id={s.id} currentStatus={s.status} />
        )}
        <a
          href={`/api/payments/${s.id}/pdf`}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1.5 px-4 py-2 text-sm font-semibold bg-zinc-100 text-zinc-700 rounded-lg hover:bg-zinc-200 transition-colors"
        >
          <Download className="w-4 h-4" />
          PDF書き出し
        </a>
      </div>
    </div>
  );
}
