import { auth } from "@/lib/auth";
import { db as prisma } from "@/lib/db";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Plus, Search } from "lucide-react";

export default async function StudioClientsPage() {
  const session = await auth();
  if (!session?.user) redirect("/login");

  const user = await prisma.user.findUnique({
    where: { email: session.user.email! },
  });
  if (!user) redirect("/login");

  const isAdmin = user.role === "ADMIN";
  const branchFilter = isAdmin ? {} : { branchId: user.branchId! };

  const clients = await prisma.studioClient.findMany({
    where: branchFilter,
    orderBy: { updatedAt: "desc" },
    include: {
      _count: { select: { productions: true, results: true } },
      branch: true,
    },
  });

  return (
    <div className="p-6 max-w-6xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-zinc-900">クライアント管理</h1>
        <Link
          href="/dashboard/studio/clients/new"
          className="flex items-center gap-2 bg-fuchsia-600 text-white px-4 py-2 rounded-lg hover:bg-fuchsia-700 transition"
        >
          <Plus className="h-4 w-4" />
          新規登録
        </Link>
      </div>

      {clients.length === 0 ? (
        <div className="bg-white rounded-xl border p-12 text-center">
          <Search className="h-12 w-12 text-zinc-300 mx-auto mb-4" />
          <h3 className="text-lg font-bold text-zinc-900 mb-2">クライアントがまだいません</h3>
          <p className="text-zinc-500 mb-4">新規クライアントを登録して、SNS運用を始めましょう。</p>
          <Link
            href="/dashboard/studio/clients/new"
            className="inline-flex items-center gap-2 bg-fuchsia-600 text-white px-4 py-2 rounded-lg hover:bg-fuchsia-700"
          >
            <Plus className="h-4 w-4" />
            新規登録
          </Link>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {clients.map((client) => (
            <Link
              key={client.id}
              href={`/dashboard/studio/clients/${client.id}`}
              className="bg-white rounded-xl border p-5 hover:border-fuchsia-300 hover:shadow-sm transition"
            >
              <div className="flex items-start justify-between mb-3">
                <div>
                  <h3 className="font-bold text-zinc-900">{client.name}</h3>
                  <p className="text-sm text-zinc-500">{client.businessType}</p>
                </div>
                <span
                  className={`text-xs px-2 py-1 rounded ${
                    client.status === "ACTIVE"
                      ? "bg-green-50 text-green-700"
                      : client.status === "PAUSED"
                      ? "bg-yellow-50 text-yellow-700"
                      : "bg-zinc-100 text-zinc-500"
                  }`}
                >
                  {client.status === "ACTIVE" ? "運用中" : client.status === "PAUSED" ? "一時停止" : "解約"}
                </span>
              </div>
              <p className="text-sm text-zinc-500 mb-3">{client.area} · {client.target}</p>
              <div className="flex gap-4 text-xs text-zinc-400">
                <span>プラン {client._count.productions}件</span>
                <span>レポート {client._count.results}件</span>
              </div>
              {isAdmin && (
                <p className="text-xs text-zinc-400 mt-2">{client.branch.name}</p>
              )}
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
