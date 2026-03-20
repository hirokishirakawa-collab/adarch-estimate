import { auth } from "@/lib/auth";
import { db as prisma } from "@/lib/db";
import { redirect } from "next/navigation";
import { BarChart2, TrendingUp, TrendingDown, Users } from "lucide-react";

export default async function ResultsPage() {
  const session = await auth();
  if (!session?.user) redirect("/login");

  const user = await prisma.user.findUnique({ where: { email: session.user.email! } });
  if (!user) redirect("/login");

  const isAdmin = user.role === "ADMIN";
  const branchFilter = isAdmin ? {} : { branchId: user.branchId! };

  const results = await prisma.monthlyResult.findMany({
    where: branchFilter,
    orderBy: { month: "desc" },
    include: { studioClient: true },
  });

  // Aggregate stats
  const clients = [...new Set(results.map(r => r.studioClientId))];
  const latestMonth = results[0]?.month || "N/A";
  const totalFollowers = results.filter(r => r.month === latestMonth).reduce((sum, r) => sum + (r.followers || 0), 0);
  const avgEngagement = results.filter(r => r.month === latestMonth && r.engagementRate).reduce((sum, r, _, arr) => sum + (r.engagementRate || 0) / arr.length, 0);
  const totalReach = results.filter(r => r.month === latestMonth).reduce((sum, r) => sum + (r.reach || 0), 0);

  return (
    <div className="p-6 max-w-6xl mx-auto">
      <h1 className="text-2xl font-bold text-zinc-900 mb-6 flex items-center gap-2">
        <BarChart2 className="h-6 w-6 text-emerald-500" />
        成果ダッシュボード
      </h1>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
        <div className="bg-white rounded-xl border p-5">
          <p className="text-xs text-zinc-500 mb-1">クライアント数</p>
          <p className="text-2xl font-bold text-zinc-900">{clients.length}</p>
        </div>
        <div className="bg-white rounded-xl border p-5">
          <p className="text-xs text-zinc-500 mb-1">総フォロワー（{latestMonth}）</p>
          <p className="text-2xl font-bold text-zinc-900">{totalFollowers.toLocaleString()}</p>
        </div>
        <div className="bg-white rounded-xl border p-5">
          <p className="text-xs text-zinc-500 mb-1">平均エンゲージ率</p>
          <p className="text-2xl font-bold text-zinc-900">{avgEngagement ? avgEngagement.toFixed(1) + "%" : "N/A"}</p>
        </div>
        <div className="bg-white rounded-xl border p-5">
          <p className="text-xs text-zinc-500 mb-1">総リーチ（{latestMonth}）</p>
          <p className="text-2xl font-bold text-zinc-900">{totalReach.toLocaleString()}</p>
        </div>
      </div>

      {/* Results Table */}
      {results.length === 0 ? (
        <div className="bg-white rounded-xl border p-12 text-center">
          <BarChart2 className="h-12 w-12 text-zinc-300 mx-auto mb-4" />
          <h3 className="text-lg font-bold text-zinc-900 mb-2">まだ成果データがありません</h3>
          <p className="text-zinc-500">月次レポート生成時にInsightsデータをJSON形式で入力すると、自動で蓄積されます。</p>
        </div>
      ) : (
        <div className="bg-white rounded-xl border overflow-hidden">
          <div className="px-5 py-4 border-b">
            <h2 className="font-bold text-zinc-900">月別成果データ</h2>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-zinc-50">
                  <th className="px-4 py-3 text-left text-xs font-medium text-zinc-500">クライアント</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-zinc-500">月</th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-zinc-500">フォロワー</th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-zinc-500">増減</th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-zinc-500">リーチ</th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-zinc-500">エンゲージ率</th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-zinc-500">保存数</th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-zinc-500">プロフィール訪問</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {results.map(r => (
                  <tr key={r.id} className="hover:bg-zinc-50">
                    <td className="px-4 py-3 font-medium text-zinc-900">{r.studioClient.name}</td>
                    <td className="px-4 py-3 text-zinc-600">{r.month}</td>
                    <td className="px-4 py-3 text-right">{r.followers?.toLocaleString() ?? "-"}</td>
                    <td className={`px-4 py-3 text-right flex items-center justify-end gap-1 ${(r.followersGain ?? 0) > 0 ? "text-emerald-600" : (r.followersGain ?? 0) < 0 ? "text-red-600" : "text-zinc-400"}`}>
                      {(r.followersGain ?? 0) > 0 && <TrendingUp className="h-3 w-3" />}
                      {(r.followersGain ?? 0) < 0 && <TrendingDown className="h-3 w-3" />}
                      {r.followersGain != null ? (r.followersGain > 0 ? "+" : "") + r.followersGain.toLocaleString() : "-"}
                    </td>
                    <td className="px-4 py-3 text-right">{r.reach?.toLocaleString() ?? "-"}</td>
                    <td className="px-4 py-3 text-right">{r.engagementRate != null ? r.engagementRate.toFixed(1) + "%" : "-"}</td>
                    <td className="px-4 py-3 text-right">{r.saves?.toLocaleString() ?? "-"}</td>
                    <td className="px-4 py-3 text-right">{r.profileVisits?.toLocaleString() ?? "-"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
