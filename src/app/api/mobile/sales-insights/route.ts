import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { verifyMobileToken } from "../_lib/verify-mobile-token";
import { resolveDbUser } from "../_lib/authorize";

export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  const user = await verifyMobileToken(req);
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = req.nextUrl;
  const periodParam = searchParams.get("period") ?? "30d";

  try {
    // Calculate date range based on period
    const now = new Date();
    let sinceDate: Date;

    switch (periodParam) {
      case "7d":
        sinceDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        break;
      case "90d":
        sinceDate = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);
        break;
      case "30d":
      default:
        sinceDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
        break;
    }

    // Non-ADMIN: only see insights for their own group company
    let companyFilter: Record<string, unknown> = {};
    if (user.role !== "ADMIN") {
      const dbUser = await resolveDbUser(user.email);
      if (!dbUser?.groupCompanyId) {
        return NextResponse.json({ error: "Group company not assigned" }, { status: 403 });
      }
      companyFilter = { groupCompanyId: dbUser.groupCompanyId };
    }

    const where = { createdAt: { gte: sinceDate }, ...companyFilter };

    const [totals, recentInsights] = await Promise.all([
      db.salesInsight.aggregate({
        where,
        _sum: { totalSent: true, totalReplied: true },
        _count: true,
      }),
      db.salesInsight.findMany({
        where,
        include: {
          groupCompany: {
            select: { name: true, ownerName: true, emoji: true },
          },
        },
        orderBy: { createdAt: "desc" },
        take: 10,
      }),
    ]);

    const totalSent = totals._sum.totalSent ?? 0;
    const totalReplied = totals._sum.totalReplied ?? 0;
    const replyRate = totalSent > 0 ? Math.round((totalReplied / totalSent) * 100) : 0;

    // Extract hot industries from insights JSON data
    const hotIndustriesMap = new Map<string, { sent: number; replied: number }>();

    for (const insight of recentInsights) {
      const industries = insight.insights as Array<{
        industry?: string;
        sent?: number;
        replied?: number;
      }>;
      if (Array.isArray(industries)) {
        for (const item of industries) {
          if (item.industry) {
            const existing = hotIndustriesMap.get(item.industry) ?? { sent: 0, replied: 0 };
            existing.sent += item.sent ?? 0;
            existing.replied += item.replied ?? 0;
            hotIndustriesMap.set(item.industry, existing);
          }
        }
      }
    }

    const hotIndustries = Array.from(hotIndustriesMap.entries())
      .map(([industry, stats]) => ({
        industry,
        sent: stats.sent,
        replied: stats.replied,
        replyRate: stats.sent > 0 ? Math.round((stats.replied / stats.sent) * 100) : 0,
      }))
      .sort((a, b) => b.replyRate - a.replyRate)
      .slice(0, 10);

    return NextResponse.json({
      totalSent,
      totalReplied,
      replyRate,
      hotIndustries,
      recentInsights: recentInsights.map((i) => ({
        id: i.id,
        companyName: i.groupCompany?.name ?? null,
        companyEmoji: i.groupCompany?.emoji ?? null,
        authorName: i.authorName,
        period: i.period,
        totalSent: i.totalSent,
        totalReplied: i.totalReplied,
        memo: i.memo ?? null,
        createdAt: i.createdAt,
      })),
    });
  } catch (e) {
    console.error("[GET /api/mobile/sales-insights]", e);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
