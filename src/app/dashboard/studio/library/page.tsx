import { auth } from "@/lib/auth";
import { db as prisma } from "@/lib/db";
import { redirect } from "next/navigation";
import { ImagePlus } from "lucide-react";

export default async function LibraryPage() {
  const session = await auth();
  if (!session?.user) redirect("/login");

  const user = await prisma.user.findUnique({ where: { email: session.user.email! } });
  if (!user) redirect("/login");

  const isAdmin = user.role === "ADMIN";
  const branchFilter = isAdmin ? {} : { branchId: user.branchId! };

  const productions = await prisma.production.findMany({
    where: branchFilter,
    orderBy: { createdAt: "desc" },
    include: { studioClient: true },
  });

  return (
    <div className="p-6 max-w-6xl mx-auto">
      <h1 className="text-2xl font-bold text-zinc-900 mb-6 flex items-center gap-2">
        <ImagePlus className="h-6 w-6 text-fuchsia-500" />
        制作ライブラリ
      </h1>

      {productions.length === 0 ? (
        <div className="bg-white rounded-xl border p-12 text-center">
          <ImagePlus className="h-12 w-12 text-zinc-300 mx-auto mb-4" />
          <h3 className="text-lg font-bold text-zinc-900 mb-2">まだ制作物がありません</h3>
          <p className="text-zinc-500">SNSプラン生成で作成した制作物がここに表示されます。</p>
        </div>
      ) : (
        <div className="space-y-3">
          {productions.map((p) => (
            <div key={p.id} className="bg-white rounded-xl border p-4 hover:border-fuchsia-300 transition">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="font-bold text-zinc-900">{p.title}</h3>
                  <p className="text-sm text-zinc-500">{p.studioClient.name} · {p.month} · {new Date(p.createdAt).toLocaleDateString("ja-JP")}</p>
                </div>
                <span className="text-xs px-2 py-1 bg-fuchsia-50 text-fuchsia-700 rounded">
                  {p.type === "SNS_PLAN" ? "SNSプラン" : p.type === "CUTSHEET" ? "カット表" : p.type === "REPORT" ? "レポート" : p.type}
                </span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
