import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import type { UserRole } from "@/types/roles";
import { getEligibilityList } from "@/lib/actions/project-matching";
import { REQUIRED_WEEKS } from "@/lib/constants/project-matching";

export default async function EligibilityPage() {
  const session = await auth();
  const role = (session?.user?.role ?? "USER") as UserRole;
  if (role !== "ADMIN") redirect("/dashboard");

  const { results, reportMonth } = await getEligibilityList();

  const eligibleCount = results.filter((r) => r.eligible).length;

  return (
    <div className="space-y-5">
      <div>
        <Link
          href="/dashboard/project-matching"
          className="inline-flex items-center gap-1 text-xs text-zinc-500 hover:text-zinc-700 transition-colors mb-3"
        >
          <ArrowLeft className="w-3 h-3" />
          案件一覧に戻る
        </Link>
        <h1 className="text-lg font-bold text-zinc-900">応募資格一覧</h1>
        <p className="text-xs text-zinc-500 mt-0.5">
          案件マッチングに応募可能な拠点を確認できます
        </p>
      </div>

      {/* サマリー */}
      <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
        <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-3">
          <p className="text-xs font-medium text-emerald-700">応募可能</p>
          <p className="text-2xl font-bold text-emerald-700 mt-1">
            {eligibleCount}
          </p>
        </div>
        <div className="rounded-lg border border-amber-200 bg-amber-50 p-3">
          <p className="text-xs font-medium text-amber-700">条件未達</p>
          <p className="text-2xl font-bold text-amber-700 mt-1">
            {results.length - eligibleCount}
          </p>
        </div>
        <div className="rounded-lg border border-zinc-200 bg-zinc-50 p-3">
          <p className="text-xs font-medium text-zinc-500">全拠点</p>
          <p className="text-2xl font-bold text-zinc-700 mt-1">
            {results.length}
          </p>
        </div>
      </div>

      {/* テーブル */}
      <div className="rounded-lg border border-zinc-200 overflow-hidden bg-white">
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-zinc-200 bg-zinc-50">
                <th className="text-left px-3 py-2 text-zinc-500 font-medium">
                  拠点
                </th>
                <th className="text-left px-3 py-2 text-zinc-500 font-medium">
                  代表
                </th>
                <th className="text-center px-3 py-2 text-zinc-500 font-medium">
                  週次シェア（直近{REQUIRED_WEEKS}週）
                </th>
                <th className="text-center px-3 py-2 text-zinc-500 font-medium">
                  売上報告（{reportMonth}）
                </th>
                <th className="text-center px-3 py-2 text-zinc-500 font-medium">
                  応募資格
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100">
              {results.map((r) => (
                <tr
                  key={r.id}
                  className="hover:bg-zinc-50 transition-colors"
                >
                  <td className="px-3 py-2 font-medium text-zinc-900">
                    {r.name}
                  </td>
                  <td className="px-3 py-2 text-zinc-700">
                    {r.ownerName}
                  </td>
                  <td className="px-3 py-2 text-center">
                    <div className="inline-flex gap-1">
                      {Array.from({ length: REQUIRED_WEEKS }).map((_, i) => (
                        <div
                          key={i}
                          className={`w-5 h-5 rounded flex items-center justify-center text-[10px] font-bold ${
                            i < r.submissionCount
                              ? "bg-emerald-500 text-white"
                              : "bg-zinc-200 text-zinc-400"
                          }`}
                        >
                          {i < r.submissionCount ? "\u2713" : "\u2013"}
                        </div>
                      ))}
                    </div>
                    <span className="ml-2 text-zinc-500">
                      {r.submissionCount}/{REQUIRED_WEEKS}
                    </span>
                  </td>
                  <td className="px-3 py-2 text-center">
                    {r.hasRevenueReport ? (
                      <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-medium bg-emerald-50 border border-emerald-200 text-emerald-700">
                        提出済み
                      </span>
                    ) : (
                      <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-medium bg-red-50 border border-red-200 text-red-700">
                        未提出
                      </span>
                    )}
                  </td>
                  <td className="px-3 py-2 text-center">
                    {r.eligible ? (
                      <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-medium bg-emerald-50 border border-emerald-200 text-emerald-700">
                        可能
                      </span>
                    ) : (
                      <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-medium bg-zinc-100 border border-zinc-200 text-zinc-500">
                        不可
                      </span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
