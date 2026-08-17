import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

/**
 * POST /api/auto-sales/generate-insights
 * cronで毎週月曜に実行。過去7日間の自動営業結果を拠点別・業種別に集計し、
 * SalesInsight に自動投稿する。
 * Auth: x-api-key ヘッダー (GROUP_SUPPORT_API_KEY)
 */
export async function POST(req: NextRequest) {
  const apiKey = req.headers.get("x-api-key");
  if (apiKey !== process.env.GROUP_SUPPORT_API_KEY) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const now = new Date();
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

    // 期間文字列（例: "2026-W14"）
    const weekNum = getISOWeek(now);
    const period = `${now.getFullYear()}-W${String(weekNum).padStart(2, "0")}`;

    // 過去7日間のCOMPLETED + 確定済みジョブを取得
    const jobs = await db.autoSalesJob.findMany({
      where: {
        completedAt: { gte: sevenDaysAgo },
        status: { in: ["COMPLETED", "SKIPPED"] },
      },
      include: {
        target: {
          select: {
            companyName: true,
            industry: true,
            area: true,
            branchId: true,
          },
        },
      },
    });

    if (jobs.length === 0) {
      return NextResponse.json({ created: 0, period, message: "No jobs in period" });
    }

    // branchId → jobs をグループ化
    const branchJobs = new Map<string, typeof jobs>();
    for (const job of jobs) {
      const bid = job.target.branchId;
      if (!branchJobs.has(bid)) branchJobs.set(bid, []);
      branchJobs.get(bid)!.push(job);
    }

    let created = 0;

    for (const [branchId, bJobs] of branchJobs) {
      // 拠点のgroupCompanyIdを取得
      const user = await db.user.findFirst({
        where: { branchId, groupCompanyId: { not: null } },
        select: { groupCompanyId: true, name: true },
        orderBy: { createdAt: "asc" },
      });
      if (!user?.groupCompanyId) continue;

      // 重複チェック（同じ拠点・同じ週のレポートがあればスキップ）
      const existing = await db.salesInsight.findFirst({
        where: { groupCompanyId: user.groupCompanyId, period },
      });
      if (existing) continue;

      // 業種別に集計
      const industryMap = new Map<string, { sent: number; replied: number; areas: Set<string> }>();
      const topResponses: Array<{
        companyName: string;
        industry: string;
        area: string;
        responseSnippet: string;
        note: string;
      }> = [];

      let totalSent = 0;
      let totalReplied = 0;

      for (const job of bJobs) {
        if (job.status !== "COMPLETED") continue;
        const industry = job.target.industry ?? "その他";
        const area = job.target.area ?? "";

        if (!industryMap.has(industry)) {
          industryMap.set(industry, { sent: 0, replied: 0, areas: new Set() });
        }
        const entry = industryMap.get(industry)!;
        entry.sent++;
        if (area) entry.areas.add(area);
        totalSent++;

        if (job.hasResponse) {
          entry.replied++;
          totalReplied++;
          topResponses.push({
            companyName: job.target.companyName,
            industry,
            area,
            responseSnippet: job.responseSnippet ?? "(返信内容未取得)",
            note: `返信元: ${job.responseFrom ?? "不明"}`,
          });
        }
      }

      // insights配列を構築
      const insights = Array.from(industryMap.entries()).map(([industry, data]) => {
        const replyRate = data.sent > 0 ? data.replied / data.sent : 0;
        let temperature: string;
        if (replyRate >= 0.05) temperature = "hot";
        else if (replyRate >= 0.02) temperature = "warm";
        else temperature = "cold";

        return {
          industry,
          area: Array.from(data.areas).join("、"),
          sent: data.sent,
          replied: data.replied,
          temperature,
          method: "問い合わせフォーム",
          summary: `${industry}に${data.sent}件送信、${data.replied}件返信（${Math.round(replyRate * 100)}%）`,
        };
      });

      // 送信数の多い順にソート
      insights.sort((a, b) => b.sent - a.sent);

      await db.salesInsight.create({
        data: {
          groupCompanyId: user.groupCompanyId,
          authorName: "自動営業システム",
          period,
          totalSent,
          totalReplied,
          insights,
          topResponses,
          memo: `自動営業フォーム送信の週次集計（${sevenDaysAgo.toLocaleDateString("ja-JP")}〜${now.toLocaleDateString("ja-JP")}）`,
        },
      });

      created++;
    }

    console.log(`[generate-insights] ${created}件のSalesInsightを作成 (${period})`);
    return NextResponse.json({ created, period });
  } catch (err) {
    console.error("[generate-insights] エラー:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Unknown error" },
      { status: 500 }
    );
  }
}

/** ISO 8601 週番号を計算 */
function getISOWeek(date: Date): number {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const dayNum = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  return Math.ceil(((d.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
}
