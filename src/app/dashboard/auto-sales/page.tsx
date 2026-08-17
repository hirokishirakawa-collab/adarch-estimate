import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { AutoSalesMonitor } from "./AutoSalesMonitor";
import { WikiHelpLink } from "@/components/wiki/wiki-help-link";

export default async function AutoSalesPage() {
  const session = await auth();
  if (!session?.user?.email) redirect("/");

  const user = await db.user.findUnique({
    where: { email: session.user.email },
    include: { branch: { select: { name: true } } },
  });
  if (!user) redirect("/");

  const isAdmin = user.role === "ADMIN";

  // auto-sales 機能へのアクセス制御: ADMINは常にOK、それ以外はenabledFeaturesで許可された人のみ
  if (!isAdmin && !user.enabledFeatures.includes("auto-sales")) {
    redirect("/dashboard");
  }

  const branchFilter = isAdmin ? {} : { branchId: user.branchId! };

  // 今日の日付範囲
  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);
  const todayEnd = new Date();
  todayEnd.setHours(23, 59, 59, 999);

  const [totalTargets, , todayJobsByStatus, recentJobs] =
    await Promise.all([
      db.autoSalesTarget.count({ where: branchFilter }),
      // templates query kept for Promise.all alignment; used on request page
      Promise.resolve(null),
      db.autoSalesJob.groupBy({
        by: ["status"],
        where: {
          target: branchFilter,
          createdAt: { gte: todayStart, lte: todayEnd },
        },
        _count: true,
      }),
      db.autoSalesJob.findMany({
        where: { target: branchFilter },
        include: {
          target: {
            select: {
              companyName: true,
              url: true,
              area: true,
              industry: true,
              branch: { select: { name: true } },
            },
          },
          template: { select: { name: true, companyName: true } },
        },
        orderBy: { createdAt: "desc" },
        take: 100,
      }),
    ]);

  const statusCounts: Record<string, number> = {};
  for (const g of todayJobsByStatus) {
    statusCounts[g.status] = g._count;
  }

  const todayTotal = Object.values(statusCounts).reduce((a, b) => a + b, 0);

  return (
    <div className="space-y-6">
      {/* ヘッダー */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-zinc-900">自動営業モニター</h1>
          <p className="text-sm text-zinc-500 mt-1">
            フォーム営業の自動実行状況をリアルタイムで確認
          </p>
          <WikiHelpLink query="自動営業モニター" />
        </div>
        <div className="flex items-center gap-2">
          <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium bg-emerald-50 text-emerald-700 border border-emerald-200">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
            稼働中
          </span>
        </div>
      </div>

      {/* サマリーカード */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <SummaryCard
          label="営業先（総数）"
          value={totalTargets}
          color="blue"
        />
        <SummaryCard
          label="本日送信"
          value={todayTotal}
          color="emerald"
        />
        <SummaryCard
          label="成功"
          value={statusCounts.COMPLETED ?? 0}
          color="green"
        />
        <SummaryCard
          label="失敗・スキップ"
          value={(statusCounts.FAILED ?? 0) + (statusCounts.SKIPPED ?? 0)}
          color="red"
        />
      </div>

      {/* メインモニター */}
      <AutoSalesMonitor
        initialJobs={JSON.parse(JSON.stringify(recentJobs))}
        branchName={user.branch?.name ?? "本部"}
      />
    </div>
  );
}

function SummaryCard({
  label,
  value,
  color,
}: {
  label: string;
  value: number;
  color: string;
}) {
  const colorMap: Record<string, string> = {
    blue: "bg-blue-50 border-blue-200 text-blue-700",
    emerald: "bg-emerald-50 border-emerald-200 text-emerald-700",
    green: "bg-green-50 border-green-200 text-green-700",
    red: "bg-red-50 border-red-200 text-red-700",
  };

  return (
    <div
      className={`rounded-xl border p-4 ${colorMap[color] ?? colorMap.blue}`}
    >
      <p className="text-xs font-medium opacity-70">{label}</p>
      <p className="text-2xl font-bold mt-1">{value.toLocaleString()}</p>
    </div>
  );
}
