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

  // 県別の入金集計（複数県にまたがる明細の確認用）
  const prefTotals = Object.entries(
    (s.items ?? []).reduce<Record<string, number>>((acc, it) => {
      const key = it.prefecture || "県未指定";
      acc[key] = (acc[key] ?? 0) + Number(it.grossAmount);
      return acc;
    }, {})
  ).map(([label, amount]) => ({ label, amount }));

  const b = breakdownFromStored({
    grossAmount: Number(s.grossAmount),
    commissionRate: Number(s.commissionRate),
    commissionAmount: Number(s.commissionAmount),
    mediaExpense: Number(s.mediaExpense),
    productionExpense: Number(s.productionExpense),
    reimbursementInclTax: Number(s.reimbursementInclTax),
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
                  <td className="px-2 py-2.5 whitespace-nowrap">
                    {it.prefecture ? (
                      <span className="px-2 py-0.5 text-[11px] font-semibold rounded-full bg-indigo-50 text-indigo-700 border border-indigo-100">
                        {it.prefecture}
                      </span>
                    ) : (
                      <span className="text-[11px] text-zinc-300">—</span>
                    )}
                  </td>
                  <td className="px-4 py-2.5 text-right font-medium text-zinc-800">¥{fmtNum(it.grossAmount)}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {/* 県別 集計（複数県にまたがる場合のみ） */}
          {prefTotals.length > 1 && (
            <div className="px-4 py-2.5 bg-zinc-50 border-t border-zinc-200 space-y-1">
              <p className="text-[10px] font-semibold text-zinc-400 uppercase tracking-wider">県別 集計</p>
              {prefTotals.map((p) => (
                <div key={p.label} className="flex justify-between text-[11px] text-zinc-600">
                  <span>{p.label}</span>
                  <span className="font-medium">¥{fmtNum(p.amount)}</span>
                </div>
              ))}
            </div>
          )}
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

        {b.reimbursementInclTax > 0 && (
          <div className="flex justify-between text-xs text-zinc-400">
            <span className="pl-3">立替実費（税抜・手数料対象外）</span>
            <span>¥{fmtNum(b.reimbursementExclTax)}</span>
          </div>
        )}

        <div className="flex justify-between text-sm pt-1">
          <span className="text-zinc-500">本部手数料（{b.commissionRate}%・税抜）</span>
          <span className="text-red-600 font-medium">-¥{fmtNum(b.commissionExclTax)}</span>
        </div>
        {b.reimbursementInclTax > 0 && (
          <div className="flex justify-between text-xs text-zinc-400">
            <span className="pl-3">手数料の対象（税抜）</span>
            <span>¥{fmtNum(b.commissionBaseExclTax)}</span>
          </div>
        )}

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

        {b.adMediaCostInclTax > 0 && (
          <div className="flex justify-between text-sm">
            <span className="text-zinc-500">広告媒体費（税込・源泉対象外）</span>
            <span className="text-red-600 font-medium">-¥{fmtNum(b.adMediaCostInclTax)}</span>
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

      {/* 本部取り分（管理用・ADMINのみ。パートナー向けPDFには出さない） */}
      <div className="bg-indigo-50/60 border border-indigo-100 rounded-xl p-4 mb-4 space-y-2">
        <p className="text-[11px] font-semibold text-indigo-500 uppercase tracking-wider">本部取り分（管理用）</p>
        <div className="flex justify-between text-xs">
          <span className="text-zinc-500">本部手数料（税抜）</span>
          <span className="text-zinc-700 font-medium">¥{fmtNum(b.commissionExclTax)}</span>
        </div>
        <div className="flex justify-between text-xs">
          <span className="text-zinc-500">うち消費税（10%）</span>
          <span className="text-zinc-700 font-medium">¥{fmtNum(b.commissionTax)}</span>
        </div>
        <div className="flex justify-between text-sm pt-2 border-t border-indigo-100">
          <span className="font-semibold text-zinc-700">本部取り分（税込）</span>
          <span className="font-bold text-indigo-700">¥{fmtNum(b.commissionExclTax + b.commissionTax)}</span>
        </div>
        <p className="text-[11px] text-zinc-400">
          手数料（税抜）¥{fmtNum(b.commissionExclTax)} ＋ その消費税 ¥{fmtNum(b.commissionTax)}。
          {b.withholdingTaxAmount > 0 && ` 源泉徴収 ¥${fmtNum(b.withholdingTaxAmount)} は預り金として後日納付（取り分には含めない）。`}
          {b.nonDeductibleTaxAmount > 0 && ` 控除不可消費税 ¥${fmtNum(b.nonDeductibleTaxAmount)} は仕入税額控除の目減り分の補填として別途保持。`}
          {" "}広告媒体費は媒体へのパススルー（差引済み）。
        </p>
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
