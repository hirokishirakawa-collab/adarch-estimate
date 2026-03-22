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

  const clients = await prisma.studioClient.findMany({
    where: { ...branchFilter, status: "ACTIVE" },
    select: { id: true, name: true, businessType: true },
    orderBy: { name: "asc" },
  });

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

      {/* How it works */}
      <div data-tour="sns-format-guide" className="bg-white rounded-xl border mb-6">
        <details>
          <summary className="px-5 py-4 cursor-pointer flex items-center justify-between hover:bg-zinc-50 transition rounded-xl">
            <span className="text-sm font-bold text-zinc-900">使い方 — Adobe Premiere Pro × AI 自動編集</span>
            <span className="text-xs text-zinc-400">クリックで開く</span>
          </summary>
          <div className="px-5 pb-5">
            <div className="grid grid-cols-1 md:grid-cols-4 gap-3 mb-4">
              <div className="bg-zinc-50 rounded-lg p-4 border">
                <div className="w-7 h-7 bg-fuchsia-600 text-white rounded-lg flex items-center justify-center text-xs font-bold mb-2">1</div>
                <div className="text-sm font-semibold text-zinc-900 mb-1">フォーマットを選ぶ</div>
                <div className="text-xs text-zinc-500 leading-relaxed">業種・テイストで絞り込み、クライアントと一緒にフォーマットを選択</div>
              </div>
              <div className="bg-zinc-50 rounded-lg p-4 border">
                <div className="w-7 h-7 bg-pink-600 text-white rounded-lg flex items-center justify-center text-xs font-bold mb-2">2</div>
                <div className="text-sm font-semibold text-zinc-900 mb-1">撮影依頼書を渡す</div>
                <div className="text-xs text-zinc-500 leading-relaxed">自動生成された撮影依頼書をクライアントに共有。スマホで撮影してもらう</div>
              </div>
              <div className="bg-zinc-50 rounded-lg p-4 border">
                <div className="w-7 h-7 bg-blue-600 text-white rounded-lg flex items-center justify-center text-xs font-bold mb-2">3</div>
                <div className="text-sm font-semibold text-zinc-900 mb-1">依頼する</div>
                <div className="text-xs text-zinc-500 leading-relaxed">「この構成で依頼する」ボタンで依頼。素材パスを指定して自動編集を実行</div>
              </div>
              <div className="bg-zinc-50 rounded-lg p-4 border">
                <div className="w-7 h-7 bg-emerald-600 text-white rounded-lg flex items-center justify-center text-xs font-bold mb-2">4</div>
                <div className="text-sm font-semibold text-zinc-900 mb-1">自動編集 → 納品</div>
                <div className="text-xs text-zinc-500 leading-relaxed">Premiere Proが自動で編集。テロップ・BGM・マーカー全て自動で配置</div>
              </div>
            </div>
            <div className="bg-indigo-50 border border-indigo-200 rounded-lg px-4 py-3 text-xs text-indigo-700 leading-relaxed">
              <span className="font-semibold">⚡ Adobe Premiere Pro MCP 連携：</span>
              このツールは Claude AI が Adobe Premiere Pro を直接操作する独自技術で動いています。
              フォーマット選択 → テロップスタイル選択 → 素材指定だけで、プロ品質のSNS動画が自動生成されます。
              外部APIは使用しないため、追加費用は一切かかりません。
            </div>
          </div>
        </details>
      </div>

      {/* Recent orders */}
      {recentOrders.length > 0 && (
        <div data-tour="sns-format-orders" className="bg-white rounded-xl border mb-6">
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
