import { auth } from "@/lib/auth";
import { db as prisma } from "@/lib/db";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Palette, Users, Wand2, BarChart2, Plus, Play } from "lucide-react";

export default async function StudioHome() {
  const session = await auth();
  if (!session?.user) redirect("/login");

  const user = await prisma.user.findUnique({
    where: { email: session.user.email! },
  });
  if (!user) redirect("/login");

  const isAdmin = user.role === "ADMIN";
  const branchFilter = isAdmin ? {} : { branchId: user.branchId! };

  const [clientCount, productionCount, activeClients] = await Promise.all([
    prisma.studioClient.count({ where: { ...branchFilter } }),
    prisma.production.count({ where: { ...branchFilter } }),
    prisma.studioClient.count({ where: { ...branchFilter, status: "ACTIVE" } }),
  ]);

  const recentProductions = await prisma.production.findMany({
    where: branchFilter,
    orderBy: { createdAt: "desc" },
    take: 5,
    include: { studioClient: true },
  });

  return (
    <div className="p-6 max-w-6xl mx-auto">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-zinc-900 flex items-center gap-2">
            <Palette className="h-6 w-6 text-fuchsia-500" />
            Ad Arch Studio
          </h1>
          <p className="text-zinc-500 mt-1">SNS運用・制作ツール</p>
        </div>
        <Link
          href="/dashboard/studio/clients/new"
          className="flex items-center gap-2 bg-fuchsia-600 text-white px-4 py-2 rounded-lg hover:bg-fuchsia-700 transition"
        >
          <Plus className="h-4 w-4" />
          新規クライアント
        </Link>
      </div>

      {/* Stats */}
      <div data-tour="studio-summary" className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
        <div className="bg-white rounded-xl border p-5">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-fuchsia-50 rounded-lg">
              <Users className="h-5 w-5 text-fuchsia-600" />
            </div>
            <div>
              <p className="text-2xl font-bold text-zinc-900">{activeClients}</p>
              <p className="text-sm text-zinc-500">運用中クライアント</p>
            </div>
          </div>
        </div>
        <div className="bg-white rounded-xl border p-5">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-blue-50 rounded-lg">
              <Wand2 className="h-5 w-5 text-blue-600" />
            </div>
            <div>
              <p className="text-2xl font-bold text-zinc-900">{productionCount}</p>
              <p className="text-sm text-zinc-500">生成済みプラン</p>
            </div>
          </div>
        </div>
        <div className="bg-white rounded-xl border p-5">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-green-50 rounded-lg">
              <BarChart2 className="h-5 w-5 text-green-600" />
            </div>
            <div>
              <p className="text-2xl font-bold text-zinc-900">{clientCount}</p>
              <p className="text-sm text-zinc-500">全クライアント</p>
            </div>
          </div>
        </div>
      </div>

      {/* Quick Actions */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
        <Link
          href="/dashboard/studio/generate"
          data-tour="studio-generate"
          className="bg-gradient-to-br from-fuchsia-500 to-purple-600 rounded-xl p-6 text-white hover:from-fuchsia-600 hover:to-purple-700 transition"
        >
          <Wand2 className="h-8 w-8 mb-3" />
          <h3 className="text-lg font-bold">SNSプランを生成</h3>
          <p className="text-sm text-white/80 mt-1">
            カレンダー・カット表・撮影依頼書・キャプションを一括生成
          </p>
        </Link>
        <Link
          href="/dashboard/studio/sns-formats"
          className="bg-gradient-to-br from-indigo-500 to-fuchsia-500 rounded-xl p-6 text-white hover:from-indigo-600 hover:to-fuchsia-600 transition"
        >
          <Play className="h-8 w-8 mb-3" />
          <h3 className="text-lg font-bold">SNSフォーマット</h3>
          <p className="text-sm text-white/80 mt-1">
            参考動画からフォーマットを自動生成。Premiere Pro連携で即制作
          </p>
        </Link>
        <Link
          href="/dashboard/studio/clients"
          data-tour="studio-clients"
          className="bg-white rounded-xl border p-6 hover:border-fuchsia-300 transition"
        >
          <Users className="h-8 w-8 mb-3 text-fuchsia-600" />
          <h3 className="text-lg font-bold text-zinc-900">クライアント管理</h3>
          <p className="text-sm text-zinc-500 mt-1">
            クライアント情報・ヒアリングデータの管理
          </p>
        </Link>
      </div>

      {/* Recent Productions */}
      <div className="bg-white rounded-xl border">
        <div className="px-5 py-4 border-b">
          <h2 className="font-bold text-zinc-900">最近の生成</h2>
        </div>
        {recentProductions.length === 0 ? (
          <div className="p-8 text-center text-zinc-400">
            まだ制作物がありません。「SNSプランを生成」から始めましょう。
          </div>
        ) : (
          <div className="divide-y">
            {recentProductions.map((p) => (
              <div key={p.id} className="px-5 py-3 flex items-center justify-between">
                <div>
                  <p className="font-medium text-zinc-900">{p.title}</p>
                  <p className="text-sm text-zinc-500">
                    {p.studioClient.name} · {p.month}
                  </p>
                </div>
                <span className="text-xs px-2 py-1 bg-fuchsia-50 text-fuchsia-700 rounded">
                  {p.type.replace("_", " ")}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
