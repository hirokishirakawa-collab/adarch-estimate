import { redirect } from "next/navigation";
import Link from "next/link";
import { auth } from "@/lib/auth";
import { Repeat, TrendingUp, CalendarClock } from "lucide-react";
import { db } from "@/lib/db";
import { getMockBranchId } from "@/lib/data/customers";
import type { UserRole } from "@/types/roles";

function fmtDate(d: Date | null): string {
  if (!d) return "—";
  return new Date(d).toLocaleDateString("ja-JP", { year: "numeric", month: "2-digit", day: "2-digit" });
}
function daysUntil(d: Date | null): number | null {
  if (!d) return null;
  return Math.ceil((new Date(d).getTime() - Date.now()) / 86_400_000);
}

export default async function RegularsPage() {
  const session = await auth();
  const role = (session?.user?.role ?? "MANAGER") as UserRole;
  if (role === "USER") redirect("/dashboard");
  const email = session?.user?.email ?? "";
  const userBranchId = getMockBranchId(email, role);
  const branchWhere = role === "ADMIN" || !userBranchId ? {} : { branchId: userBranchId };

  const regulars = await db.deal.findMany({
    where: { isRegular: true, ...branchWhere },
    include: {
      customer: { select: { id: true, name: true } },
      assignedTo: { select: { name: true } },
      project: { select: { id: true } },
    },
    orderBy: [{ regularRenewalDate: "asc" }],
  });

  const active = regulars.filter((r) => !r.regularEndedAt);
  const ended = regulars.filter((r) => r.regularEndedAt);
  const mrr = active.reduce((s, r) => s + Number(r.regularMonthlyAmount ?? 0), 0);
  const renewalSoon = active.filter((r) => {
    const d = daysUntil(r.regularRenewalDate);
    return d != null && d <= 30;
  });

  return (
    <div className="px-6 py-6 max-w-screen-xl mx-auto w-full">
      <div className="flex items-center gap-3 mb-6">
        <div className="w-9 h-9 bg-violet-50 rounded-xl flex items-center justify-center">
          <Repeat className="text-violet-600" style={{ width: "1.125rem", height: "1.125rem" }} />
        </div>
        <div>
          <h2 className="text-lg font-bold text-zinc-900">レギュラー案件</h2>
          <p className="text-xs text-zinc-500 mt-0.5">毎月継続している案件の固定収入（MRR）と更新管理</p>
        </div>
      </div>

      {/* サマリー */}
      <div className="grid grid-cols-3 gap-3 mb-6">
        <div className="bg-violet-50 border border-zinc-200 rounded-xl px-4 py-3">
          <p className="text-[11px] text-zinc-500 font-semibold flex items-center gap-1"><TrendingUp className="w-3 h-3" />固定収入（MRR・税抜）</p>
          <p className="text-2xl font-bold text-violet-700">¥{mrr.toLocaleString("ja-JP")}<span className="text-xs font-medium text-zinc-400 ml-1">/月</span></p>
        </div>
        <div className="bg-white border border-zinc-200 rounded-xl px-4 py-3">
          <p className="text-[11px] text-zinc-500 font-semibold">継続中</p>
          <p className="text-2xl font-bold text-zinc-800">{active.length}<span className="text-xs font-medium text-zinc-400 ml-1">件</span></p>
        </div>
        <div className="bg-amber-50 border border-zinc-200 rounded-xl px-4 py-3">
          <p className="text-[11px] text-zinc-500 font-semibold flex items-center gap-1"><CalendarClock className="w-3 h-3" />更新間近（30日内）</p>
          <p className="text-2xl font-bold text-amber-700">{renewalSoon.length}<span className="text-xs font-medium text-zinc-400 ml-1">件</span></p>
        </div>
      </div>

      {/* 更新間近アラート */}
      {renewalSoon.length > 0 && (
        <div className="mb-6 px-4 py-3 bg-amber-50 border border-amber-200 rounded-xl">
          <p className="text-xs font-semibold text-amber-800 mb-1.5 flex items-center gap-1"><CalendarClock className="w-3.5 h-3.5" />更新が近いレギュラー案件</p>
          <div className="flex flex-wrap gap-2">
            {renewalSoon.map((r) => {
              const d = daysUntil(r.regularRenewalDate);
              return (
                <Link key={r.id} href={`/dashboard/deals/${r.id}`} className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-white border border-amber-200 rounded-lg text-xs hover:bg-amber-100/50">
                  <span className="font-medium text-zinc-800">{r.customer.name}</span>
                  <span className={`text-[11px] font-semibold ${d != null && d <= 7 ? "text-red-600" : "text-amber-700"}`}>{d != null && d < 0 ? `${-d}日超過` : `残${d}日`}</span>
                </Link>
              );
            })}
          </div>
        </div>
      )}

      {/* 継続中一覧 */}
      <div className="bg-white border border-zinc-200 rounded-xl overflow-hidden mb-6">
        <div className="px-4 py-2.5 border-b border-zinc-100 bg-zinc-50">
          <p className="text-xs font-semibold text-zinc-600">継続中（{active.length}）</p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-zinc-50/50 border-b border-zinc-200">
                <th className="px-4 py-2.5 text-left text-xs font-semibold text-zinc-600">顧客 / 案件</th>
                <th className="px-4 py-2.5 text-right text-xs font-semibold text-zinc-600">月額（税抜）</th>
                <th className="px-4 py-2.5 text-left text-xs font-semibold text-zinc-600">開始</th>
                <th className="px-4 py-2.5 text-left text-xs font-semibold text-zinc-600">次回更新</th>
                <th className="px-4 py-2.5 text-left text-xs font-semibold text-zinc-600">担当</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100">
              {active.map((r) => {
                const d = daysUntil(r.regularRenewalDate);
                return (
                  <tr key={r.id} className="hover:bg-zinc-50/50">
                    <td className="px-4 py-3">
                      <Link href={`/dashboard/deals/${r.id}`} className="text-sm font-medium text-violet-700 hover:underline">{r.customer.name}</Link>
                      <p className="text-[11px] text-zinc-400">{r.title}</p>
                    </td>
                    <td className="px-4 py-3 text-right font-bold text-zinc-900">¥{Number(r.regularMonthlyAmount ?? 0).toLocaleString("ja-JP")}</td>
                    <td className="px-4 py-3 text-xs text-zinc-500">{fmtDate(r.regularStartDate)}</td>
                    <td className="px-4 py-3 text-xs">
                      <span className="text-zinc-600">{fmtDate(r.regularRenewalDate)}</span>
                      {d != null && d <= 30 && <span className={`ml-1.5 text-[10px] font-semibold ${d <= 7 ? "text-red-600" : "text-amber-600"}`}>{d < 0 ? `${-d}日超過` : `残${d}日`}</span>}
                    </td>
                    <td className="px-4 py-3 text-xs text-zinc-500">{r.assignedTo?.name ?? "—"}</td>
                  </tr>
                );
              })}
              {active.length === 0 && (
                <tr><td colSpan={5} className="px-4 py-10 text-center text-sm text-zinc-400">継続中のレギュラー案件はありません。商談詳細で「レギュラーにする」を設定してください。</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* 解約済み */}
      {ended.length > 0 && (
        <div className="bg-white border border-zinc-200 rounded-xl overflow-hidden">
          <div className="px-4 py-2.5 border-b border-zinc-100 bg-zinc-50">
            <p className="text-xs font-semibold text-zinc-500">解約済み（{ended.length}）</p>
          </div>
          <div className="divide-y divide-zinc-100">
            {ended.map((r) => (
              <div key={r.id} className="flex items-center justify-between px-4 py-2.5">
                <Link href={`/dashboard/deals/${r.id}`} className="text-sm text-zinc-600 hover:underline">{r.customer.name}<span className="text-[11px] text-zinc-400 ml-2">{r.title}</span></Link>
                <span className="text-[11px] text-zinc-400">解約 {fmtDate(r.regularEndedAt)}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
