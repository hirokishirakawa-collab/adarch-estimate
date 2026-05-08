import { redirect } from "next/navigation";
import Link from "next/link";
import { auth } from "@/lib/auth";
import { Banknote, Plus } from "lucide-react";
import type { UserRole } from "@/types/roles";
import { getPaymentStatements } from "@/lib/actions/payment-statement";

const STATUS_BADGE: Record<string, { label: string; cls: string }> = {
  DRAFT: { label: "下書き", cls: "bg-zinc-100 text-zinc-600 border-zinc-200" },
  CONFIRMED: { label: "確定", cls: "bg-blue-50 text-blue-700 border-blue-200" },
  PAID: { label: "支払済", cls: "bg-emerald-50 text-emerald-700 border-emerald-200" },
};

function fmtNum(n: number | bigint | { toString(): string }): string {
  return Number(n).toLocaleString("ja-JP");
}

function fmtDate(d: Date | string | null): string {
  if (!d) return "—";
  return new Date(d).toLocaleDateString("ja-JP", { year: "numeric", month: "2-digit", day: "2-digit" });
}

export default async function AdminPaymentsPage() {
  const session = await auth();
  const role = (session?.user?.role ?? "USER") as UserRole;
  if (role !== "ADMIN") redirect("/dashboard");

  const statements = await getPaymentStatements();

  const counts = {
    draft: statements.filter((s) => s.status === "DRAFT").length,
    confirmed: statements.filter((s) => s.status === "CONFIRMED").length,
    paid: statements.filter((s) => s.status === "PAID").length,
  };

  return (
    <div className="px-6 py-6 max-w-screen-xl mx-auto w-full">
      <div className="flex items-center justify-between mb-6 flex-wrap gap-4">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 bg-emerald-50 rounded-xl flex items-center justify-center">
            <Banknote className="text-emerald-600" style={{ width: "1.125rem", height: "1.125rem" }} />
          </div>
          <div>
            <h2 className="text-lg font-bold text-zinc-900">支払明細管理</h2>
            <p className="text-xs text-zinc-500 mt-0.5">本部 → パートナーへの支払明細（ADMIN専用）</p>
          </div>
        </div>
        <Link
          href="/dashboard/admin/payments/new"
          className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-600 text-white text-xs font-medium rounded-lg hover:bg-emerald-700 transition-colors"
        >
          <Plus className="w-3.5 h-3.5" />
          支払明細を作成
        </Link>
      </div>

      {/* サマリー */}
      <div className="grid grid-cols-3 gap-3 mb-6">
        <div className="bg-zinc-50 border border-zinc-200 rounded-xl px-4 py-3">
          <p className="text-[11px] text-zinc-500 font-semibold">下書き</p>
          <p className="text-2xl font-bold text-zinc-600">{counts.draft}</p>
        </div>
        <div className="bg-blue-50 border border-zinc-200 rounded-xl px-4 py-3">
          <p className="text-[11px] text-zinc-500 font-semibold">確定</p>
          <p className="text-2xl font-bold text-blue-700">{counts.confirmed}</p>
        </div>
        <div className="bg-emerald-50 border border-zinc-200 rounded-xl px-4 py-3">
          <p className="text-[11px] text-zinc-500 font-semibold">支払済</p>
          <p className="text-2xl font-bold text-emerald-700">{counts.paid}</p>
        </div>
      </div>

      {/* テーブル */}
      <div className="bg-white border border-zinc-200 rounded-xl overflow-hidden">
        {statements.length === 0 ? (
          <div className="px-6 py-12 text-center">
            <p className="text-sm text-zinc-400">支払明細がまだありません</p>
            <Link
              href="/dashboard/admin/payments/new"
              className="inline-flex items-center gap-1.5 mt-3 text-xs text-emerald-600 hover:text-emerald-700 font-medium"
            >
              <Plus className="w-3 h-3" />
              最初の支払明細を作成する
            </Link>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-zinc-50 border-b border-zinc-200">
                  <th className="px-4 py-3 text-left text-xs font-semibold text-zinc-600">件名</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-zinc-600">パートナー</th>
                  <th className="px-4 py-3 text-right text-xs font-semibold text-zinc-600">入金額</th>
                  <th className="px-4 py-3 text-right text-xs font-semibold text-zinc-600">手数料</th>
                  <th className="px-4 py-3 text-right text-xs font-semibold text-zinc-600">支払額</th>
                  <th className="px-4 py-3 text-center text-xs font-semibold text-zinc-600">ステータス</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-zinc-600">作成日</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-100">
                {statements.map((s) => {
                  const badge = STATUS_BADGE[s.status] ?? STATUS_BADGE.DRAFT;
                  return (
                    <tr key={s.id} className="hover:bg-zinc-50/50">
                      <td className="px-4 py-3">
                        <Link
                          href={`/dashboard/admin/payments/${s.id}`}
                          className="text-sm font-medium text-indigo-600 hover:underline"
                        >
                          {s.title}
                        </Link>
                        {s.clientName && (
                          <p className="text-[11px] text-zinc-400">{s.clientName}</p>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <p className="text-sm text-zinc-800">{s.groupCompany.name}</p>
                        <p className="text-[11px] text-zinc-400">{s.groupCompany.ownerName}</p>
                      </td>
                      <td className="px-4 py-3 text-right font-medium text-zinc-800">
                        ¥{fmtNum(s.grossAmount)}
                      </td>
                      <td className="px-4 py-3 text-right text-zinc-500">
                        ¥{fmtNum(s.commissionAmount)}
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
                        {fmtDate(s.createdAt)}
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
