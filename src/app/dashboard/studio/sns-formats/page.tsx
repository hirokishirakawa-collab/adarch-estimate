import { auth } from "@/lib/auth";
import { db as prisma } from "@/lib/db";
import { redirect } from "next/navigation";
import { Play } from "lucide-react";
import { FormatCatalog } from "./format-catalog";

export default async function SnsFormatsPage() {
  const session = await auth();
  if (!session?.user) redirect("/login");

  const user = await prisma.user.findUnique({
    where: { email: session.user.email! },
  });
  if (!user) redirect("/login");

  const isAdmin = user.role === "ADMIN";
  const branchFilter = isAdmin ? {} : { branchId: user.branchId! };

  // Get studio clients for the order dropdown
  const clients = await prisma.studioClient.findMany({
    where: { ...branchFilter, status: "ACTIVE" },
    select: { id: true, name: true, businessType: true },
    orderBy: { name: "asc" },
  });

  // Get recent orders
  const recentOrders = await prisma.snsFormatOrder.findMany({
    where: isAdmin ? {} : { branchId: user.branchId! },
    orderBy: { createdAt: "desc" },
    take: 5,
    include: { studioClient: { select: { name: true } }, createdBy: { select: { name: true } } },
  });

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-zinc-900 flex items-center gap-2">
            <Play className="h-6 w-6 text-fuchsia-500" />
            SNSフォーマット
          </h1>
          <p className="text-zinc-500 mt-1 text-sm">
            業種・テイスト・配信先からフォーマットを選び、テロップスタイルと組み合わせて自動編集
          </p>
        </div>
      </div>

      {/* Recent orders */}
      {recentOrders.length > 0 && (
        <div className="bg-white rounded-xl border mb-6">
          <div className="px-4 py-3 border-b">
            <h2 className="text-sm font-bold text-zinc-900">最近の依頼</h2>
          </div>
          <div className="divide-y">
            {recentOrders.map((o) => (
              <div key={o.id} className="px-4 py-2.5 flex items-center justify-between text-sm">
                <div>
                  <span className="font-medium text-zinc-900">{o.formatName}</span>
                  <span className="text-zinc-400 ml-2">{o.studioClient?.name || "未選択"}</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-xs text-zinc-400">{o.createdBy?.name}</span>
                  <span className={`text-xs px-2 py-0.5 rounded ${
                    o.status === "COMPLETED" ? "bg-green-50 text-green-700"
                    : o.status === "PROCESSING" ? "bg-blue-50 text-blue-700"
                    : o.status === "FAILED" ? "bg-red-50 text-red-700"
                    : "bg-zinc-100 text-zinc-500"
                  }`}>
                    {o.status === "COMPLETED" ? "完了" : o.status === "PROCESSING" ? "編集中" : o.status === "FAILED" ? "失敗" : "受付"}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Catalog */}
      <FormatCatalog
        userId={user.id}
        branchId={user.branchId!}
        clients={clients}
      />
    </div>
  );
}
