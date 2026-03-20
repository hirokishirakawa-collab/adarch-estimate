import { auth } from "@/lib/auth";
import { db as prisma } from "@/lib/db";
import { redirect, notFound } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Wand2, BarChart2, Calendar } from "lucide-react";
import { ClientEditForm } from "./client-edit-form";

export default async function ClientDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await auth();
  if (!session?.user) redirect("/login");

  const { id } = await params;

  const client = await prisma.studioClient.findUnique({
    where: { id },
    include: {
      branch: true,
      createdBy: { select: { name: true, email: true } },
      productions: { orderBy: { createdAt: "desc" }, take: 10 },
      results: { orderBy: { month: "desc" }, take: 6 },
    },
  });

  if (!client) notFound();

  return (
    <div className="p-6 max-w-6xl mx-auto">
      <Link href="/dashboard/studio/clients" className="flex items-center gap-1 text-sm text-zinc-500 hover:text-zinc-900 mb-4">
        <ArrowLeft className="h-4 w-4" />
        クライアント一覧に戻る
      </Link>

      <div className="flex items-start justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-zinc-900">{client.name}</h1>
          <p className="text-zinc-500">{client.businessType} · {client.area}</p>
        </div>
        <div className="flex gap-2">
          <Link
            href={`/dashboard/studio/generate?clientId=${client.id}`}
            className="flex items-center gap-2 bg-fuchsia-600 text-white px-4 py-2 rounded-lg hover:bg-fuchsia-700 transition text-sm"
          >
            <Wand2 className="h-4 w-4" />
            プラン生成
          </Link>
          <Link
            href={`/dashboard/studio/clients/${client.id}/report`}
            className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition text-sm"
          >
            <BarChart2 className="h-4 w-4" />
            月次レポート
          </Link>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left: Client info edit */}
        <div className="lg:col-span-1">
          <ClientEditForm
            client={{
              id: client.id,
              name: client.name,
              businessType: client.businessType,
              area: client.area,
              target: client.target,
              sellingPoints: client.sellingPoints,
              snsAccounts: client.snsAccounts,
              brandColors: client.brandColors,
              monthlyBudget: client.monthlyBudget,
              postsPerMonth: client.postsPerMonth,
              status: client.status,
              notes: client.notes,
            }}
          />
        </div>

        {/* Right: History */}
        <div className="lg:col-span-2 space-y-6">
          {/* Productions */}
          <div className="bg-white rounded-xl border">
            <div className="px-5 py-4 border-b flex items-center gap-2">
              <Wand2 className="h-4 w-4 text-fuchsia-500" />
              <h2 className="font-bold text-zinc-900">生成履歴</h2>
            </div>
            {client.productions.length === 0 ? (
              <div className="p-6 text-center text-zinc-400 text-sm">
                まだプランが生成されていません
              </div>
            ) : (
              <div className="divide-y">
                {client.productions.map((p) => (
                  <div key={p.id} className="px-5 py-3 flex items-center justify-between">
                    <div>
                      <p className="font-medium text-zinc-900 text-sm">{p.title}</p>
                      <p className="text-xs text-zinc-500">{new Date(p.createdAt).toLocaleDateString("ja-JP")} · {p.type === "SNS_PLAN" ? "SNSプラン" : p.type}</p>
                    </div>
                    <Link
                      href={`/api/studio/productions/${p.id}`}
                      target="_blank"
                      className="text-xs text-fuchsia-600 hover:text-fuchsia-800"
                    >
                      詳細
                    </Link>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Monthly Results */}
          <div className="bg-white rounded-xl border">
            <div className="px-5 py-4 border-b flex items-center gap-2">
              <Calendar className="h-4 w-4 text-blue-500" />
              <h2 className="font-bold text-zinc-900">月次成果データ</h2>
            </div>
            {client.results.length === 0 ? (
              <div className="p-6 text-center text-zinc-400 text-sm">
                まだ成果データがありません。月次レポートから登録できます。
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b bg-zinc-50">
                      <th className="px-4 py-2 text-left text-xs font-medium text-zinc-500">月</th>
                      <th className="px-4 py-2 text-right text-xs font-medium text-zinc-500">フォロワー</th>
                      <th className="px-4 py-2 text-right text-xs font-medium text-zinc-500">増減</th>
                      <th className="px-4 py-2 text-right text-xs font-medium text-zinc-500">リーチ</th>
                      <th className="px-4 py-2 text-right text-xs font-medium text-zinc-500">エンゲージ率</th>
                      <th className="px-4 py-2 text-right text-xs font-medium text-zinc-500">保存</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {client.results.map((r) => (
                      <tr key={r.id}>
                        <td className="px-4 py-2 font-medium">{r.month}</td>
                        <td className="px-4 py-2 text-right">{r.followers?.toLocaleString() ?? "-"}</td>
                        <td className={`px-4 py-2 text-right ${(r.followersGain ?? 0) > 0 ? "text-green-600" : (r.followersGain ?? 0) < 0 ? "text-red-600" : ""}`}>
                          {r.followersGain != null ? (r.followersGain > 0 ? "+" : "") + r.followersGain.toLocaleString() : "-"}
                        </td>
                        <td className="px-4 py-2 text-right">{r.reach?.toLocaleString() ?? "-"}</td>
                        <td className="px-4 py-2 text-right">{r.engagementRate != null ? r.engagementRate.toFixed(1) + "%" : "-"}</td>
                        <td className="px-4 py-2 text-right">{r.saves?.toLocaleString() ?? "-"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
