import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";

export async function GET() {
  const session = await auth();
  if (!session?.user?.email) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const user = await db.user.findUnique({
    where: { email: session.user.email },
  });
  if (!user) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

  const isAdmin = user.role === "ADMIN";
  if (!isAdmin && !user.enabledFeatures.includes("auto-sales")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  const branchFilter = isAdmin ? {} : { branchId: user.branchId! };

  // 今日の日付範囲
  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);
  const todayEnd = new Date();
  todayEnd.setHours(23, 59, 59, 999);

  const [totalTargets, todayJobs, jobsByStatus, recentJobs] = await Promise.all([
    // 営業先の総数
    db.autoSalesTarget.count({ where: branchFilter }),

    // 今日のジョブ数
    db.autoSalesJob.count({
      where: {
        target: branchFilter,
        createdAt: { gte: todayStart, lte: todayEnd },
      },
    }),

    // ステータス別ジョブ数（今日）
    db.autoSalesJob.groupBy({
      by: ["status"],
      where: {
        target: branchFilter,
        createdAt: { gte: todayStart, lte: todayEnd },
      },
      _count: true,
    }),

    // 直近のジョブ（モニター用）
    db.autoSalesJob.findMany({
      where: { target: branchFilter },
      include: {
        target: { select: { companyName: true, url: true, area: true, industry: true } },
        template: { select: { name: true, companyName: true } },
      },
      orderBy: { createdAt: "desc" },
      take: 50,
    }),
  ]);

  const statusCounts: Record<string, number> = {};
  for (const g of jobsByStatus) {
    statusCounts[g.status] = g._count;
  }

  return NextResponse.json({
    totalTargets,
    todayJobs,
    statusCounts,
    recentJobs,
  });
}
