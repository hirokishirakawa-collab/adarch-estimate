import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

/**
 * GET /api/auto-sales/weekly-report
 * GAS cronから呼び出される週次レポートAPI
 * Auth: x-api-key ヘッダー (GROUP_SUPPORT_API_KEY)
 * 過去7日間の拠点別実績を集計して返す
 */
export async function GET(req: NextRequest) {
  const apiKey = req.headers.get("x-api-key");
  if (apiKey !== process.env.GROUP_SUPPORT_API_KEY) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

    // 過去7日間のジョブを拠点別に取得
    const jobs = await db.autoSalesJob.findMany({
      where: {
        createdAt: { gte: sevenDaysAgo },
      },
      include: {
        target: {
          select: {
            branchId: true,
            branch: { select: { name: true } },
          },
        },
      },
    });

    // 拠点別に集計
    const branchMap = new Map<
      string,
      {
        branchName: string;
        sent: number;
        completed: number;
        failed: number;
        skipped: number;
        responses: number;
      }
    >();

    for (const job of jobs) {
      const branchId = job.target.branchId;
      const branchName = job.target.branch?.name ?? "不明";

      if (!branchMap.has(branchId)) {
        branchMap.set(branchId, {
          branchName,
          sent: 0,
          completed: 0,
          failed: 0,
          skipped: 0,
          responses: 0,
        });
      }

      const entry = branchMap.get(branchId)!;
      entry.sent++;

      if (job.status === "COMPLETED") entry.completed++;
      if (job.status === "FAILED") entry.failed++;
      if (job.status === "SKIPPED") entry.skipped++;
      if (job.hasResponse) entry.responses++;
    }

    // 全体集計
    const totalSent = jobs.length;
    const totalCompleted = jobs.filter((j) => j.status === "COMPLETED").length;
    const totalFailed = jobs.filter((j) => j.status === "FAILED").length;
    const totalSkipped = jobs.filter((j) => j.status === "SKIPPED").length;
    const totalResponses = jobs.filter((j) => j.hasResponse).length;
    const responseRate =
      totalCompleted > 0
        ? Math.round((totalResponses / totalCompleted) * 1000) / 10
        : 0;

    // 拠点別データを配列に変換
    const branches = Array.from(branchMap.entries()).map(
      ([branchId, data]) => ({
        branchId,
        branchName: data.branchName,
        sent: data.sent,
        completed: data.completed,
        failed: data.failed,
        skipped: data.skipped,
        responses: data.responses,
        responseRate:
          data.completed > 0
            ? Math.round((data.responses / data.completed) * 1000) / 10
            : 0,
      })
    );

    // 送信数の多い順にソート
    branches.sort((a, b) => b.sent - a.sent);

    return NextResponse.json({
      period: {
        from: sevenDaysAgo.toISOString(),
        to: new Date().toISOString(),
      },
      summary: {
        totalSent,
        totalCompleted,
        totalFailed,
        totalSkipped,
        totalResponses,
        responseRate,
      },
      branches,
    });
  } catch (err) {
    console.error("[weekly-report] エラー:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Unknown error" },
      { status: 500 }
    );
  }
}
