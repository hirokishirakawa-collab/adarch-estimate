import { Banknote } from "lucide-react";
import { getPaymentStatements } from "@/lib/actions/payment-statement";

function fmtNum(n: number | bigint | { toString(): string }): string {
  return Number(n).toLocaleString("ja-JP");
}

function fmtDate(d: Date | string | null): string {
  if (!d) return "—";
  return new Date(d).toLocaleDateString("ja-JP", { year: "numeric", month: "2-digit", day: "2-digit" });
}

const STATUS_BADGE: Record<string, { label: string; cls: string }> = {
  CONFIRMED: { label: "確定", cls: "bg-blue-50 text-blue-700 border-blue-200" },
  PAID: { label: "支払済", cls: "bg-emerald-50 text-emerald-700 border-emerald-200" },
};

export default async function PaymentsPage() {
  const statements = await getPaymentStatements();

  return (
    <div className="px-6 py-6 max-w-screen-xl mx-auto w-full">
      <div className="flex items-center gap-3 mb-6">
        <div className="w-9 h-9 bg-emerald-50 rounded-xl flex items-center justify-center">
          <Banknote className="text-emerald-600" style={{ width: "1.125rem", height: "1.125rem" }} />
        </div>
        <div>
          <h2 className="text-lg font-bold text-zinc-900">支払明細</h2>
          <p className="text-xs text-zinc-500 mt-0.5">本部からの支払明細を確認できます</p>
        </div>
      </div>

      <div className="bg-white border border-zinc-200 rounded-xl overflow-hidden">
        {statements.length === 0 ? (
          <div className="px-6 py-12 text-center">
            <p className="text-sm text-zinc-400">支払明細がまだありません</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-zinc-50 border-b border-zinc-200">
                  <th className="px-4 py-3 text-left text-xs font-semibold text-zinc-600">件名</th>
                  <th className="px-4 py-3 text-right text-xs font-semibold text-zinc-600">入金額</th>
                  <th className="px-4 py-3 text-right text-xs font-semibold text-zinc-600">手数料</th>
                  <th className="px-4 py-3 text-right text-xs font-semibold text-zinc-600">源泉徴収</th>
                  <th className="px-4 py-3 text-right text-xs font-semibold text-zinc-600">支払額</th>
                  <th className="px-4 py-3 text-center text-xs font-semibold text-zinc-600">ステータス</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-zinc-600">日付</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-100">
                {statements.map((s) => {
                  const badge = STATUS_BADGE[s.status] ?? STATUS_BADGE.CONFIRMED;
                  return (
                    <tr key={s.id} className="hover:bg-zinc-50/50">
                      <td className="px-4 py-3">
                        <p className="text-sm font-medium text-zinc-900">{s.title}</p>
                        {s.clientName && (
                          <p className="text-[11px] text-zinc-400">{s.clientName}</p>
                        )}
                      </td>
                      <td className="px-4 py-3 text-right text-zinc-600">
                        ¥{fmtNum(s.grossAmount)}
                      </td>
                      <td className="px-4 py-3 text-right text-zinc-500">
                        -¥{fmtNum(s.commissionAmount)}
                      </td>
                      <td className="px-4 py-3 text-right text-zinc-500">
                        {Number(s.withholdingTaxAmount) > 0
                          ? `-¥${fmtNum(s.withholdingTaxAmount)}`
                          : "—"}
                      </td>
                      <td className="px-4 py-3 text-right font-bold text-emerald-700">
                        ¥{fmtNum(s.netPaymentAmount)}
                      </td>
                      <td className="px-4 py-3 text-center">
                        <span className={`inline-block px-2 py-0.5 text-[11px] font-semibold rounded-full border ${badge.cls}`}>
                          {badge.label}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-xs text-zinc-400">
                        {s.status === "PAID" ? fmtDate(s.paidAt) : fmtDate(s.createdAt)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
