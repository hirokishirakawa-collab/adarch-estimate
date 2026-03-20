import { auth } from "@/lib/auth";
import { db as prisma } from "@/lib/db";
import { redirect } from "next/navigation";
import { Lightbulb } from "lucide-react";

export default async function InsightsPage() {
  const session = await auth();
  if (!session?.user) redirect("/login");

  const user = await prisma.user.findUnique({ where: { email: session.user.email! } });
  if (!user) redirect("/login");

  // Aggregate by business type
  const clients = await prisma.studioClient.findMany({
    include: {
      results: { orderBy: { month: "desc" } },
      _count: { select: { productions: true } },
    },
  });

  const byType: Record<string, {
    count: number;
    avgEngagement: number;
    avgFollowersGain: number;
    avgReach: number;
    totalProductions: number;
    areas: Set<string>;
  }> = {};

  for (const client of clients) {
    const type = client.businessType;
    if (!byType[type]) {
      byType[type] = { count: 0, avgEngagement: 0, avgFollowersGain: 0, avgReach: 0, totalProductions: 0, areas: new Set() };
    }
    byType[type].count++;
    byType[type].totalProductions += client._count.productions;
    byType[type].areas.add(client.area);

    const latestResult = client.results[0];
    if (latestResult) {
      byType[type].avgEngagement += latestResult.engagementRate || 0;
      byType[type].avgFollowersGain += latestResult.followersGain || 0;
      byType[type].avgReach += latestResult.reach || 0;
    }
  }

  // Calculate averages
  for (const type of Object.keys(byType)) {
    const d = byType[type];
    if (d.count > 0) {
      d.avgEngagement /= d.count;
      d.avgFollowersGain /= d.count;
      d.avgReach /= d.count;
    }
  }

  // By area
  const byArea: Record<string, { count: number; types: Set<string> }> = {};
  for (const client of clients) {
    if (!byArea[client.area]) byArea[client.area] = { count: 0, types: new Set() };
    byArea[client.area].count++;
    byArea[client.area].types.add(client.businessType);
  }

  return (
    <div className="p-6 max-w-6xl mx-auto">
      <h1 className="text-2xl font-bold text-zinc-900 mb-2 flex items-center gap-2">
        <Lightbulb className="h-6 w-6 text-amber-500" />
        営業インサイト
      </h1>
      <p className="text-zinc-500 mb-6">Studioのクライアントデータ × 成果データから、営業に使えるインサイトを抽出</p>

      {clients.length === 0 ? (
        <div className="bg-white rounded-xl border p-12 text-center">
          <Lightbulb className="h-12 w-12 text-zinc-300 mx-auto mb-4" />
          <h3 className="text-lg font-bold text-zinc-900 mb-2">データ蓄積中</h3>
          <p className="text-zinc-500">クライアント登録・月次レポート入力が増えると、業種×エリアの傾向が見えてきます。</p>
        </div>
      ) : (
        <div className="space-y-6">
          {/* By Business Type */}
          <div className="bg-white rounded-xl border overflow-hidden">
            <div className="px-5 py-4 border-b">
              <h2 className="font-bold text-zinc-900">業種別パフォーマンス</h2>
              <p className="text-xs text-zinc-500">「この業種は成果が出やすい」→ 営業時の提案に活用</p>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b bg-zinc-50">
                    <th className="px-4 py-3 text-left text-xs font-medium text-zinc-500">業種</th>
                    <th className="px-4 py-3 text-right text-xs font-medium text-zinc-500">クライアント数</th>
                    <th className="px-4 py-3 text-right text-xs font-medium text-zinc-500">平均エンゲージ率</th>
                    <th className="px-4 py-3 text-right text-xs font-medium text-zinc-500">平均フォロワー増/月</th>
                    <th className="px-4 py-3 text-right text-xs font-medium text-zinc-500">平均リーチ</th>
                    <th className="px-4 py-3 text-right text-xs font-medium text-zinc-500">生成プラン数</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-zinc-500">対応エリア</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {Object.entries(byType).sort((a, b) => b[1].count - a[1].count).map(([type, data]) => (
                    <tr key={type} className="hover:bg-zinc-50">
                      <td className="px-4 py-3 font-medium text-zinc-900">{type}</td>
                      <td className="px-4 py-3 text-right">{data.count}</td>
                      <td className="px-4 py-3 text-right">{data.avgEngagement ? data.avgEngagement.toFixed(1) + "%" : "データなし"}</td>
                      <td className="px-4 py-3 text-right">{data.avgFollowersGain ? "+" + Math.round(data.avgFollowersGain).toLocaleString() : "データなし"}</td>
                      <td className="px-4 py-3 text-right">{data.avgReach ? Math.round(data.avgReach).toLocaleString() : "データなし"}</td>
                      <td className="px-4 py-3 text-right">{data.totalProductions}</td>
                      <td className="px-4 py-3 text-xs text-zinc-500">{[...data.areas].join(", ")}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* By Area */}
          <div className="bg-white rounded-xl border overflow-hidden">
            <div className="px-5 py-4 border-b">
              <h2 className="font-bold text-zinc-900">エリア別クライアント分布</h2>
              <p className="text-xs text-zinc-500">実績があるエリア → 同エリアの新規営業で「事例あり」と言える</p>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3 p-5">
              {Object.entries(byArea).sort((a, b) => b[1].count - a[1].count).map(([area, data]) => (
                <div key={area} className="border rounded-lg p-3">
                  <p className="font-medium text-zinc-900">{area}</p>
                  <p className="text-sm text-zinc-500">{data.count}社</p>
                  <p className="text-xs text-zinc-400 mt-1">{[...data.types].join(", ")}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
