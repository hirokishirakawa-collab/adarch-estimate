import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";

export const runtime = "nodejs";

// GET /api/proposals/analytics — 公開提案書の閲覧統計（ADMIN専用）
export async function GET(_req: NextRequest) {
  const session = await auth();
  if (!session?.user?.email) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const user = await db.user.findUnique({
    where: { email: session.user.email },
  });
  if (!user || user.role !== "ADMIN") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const proposals = await db.proposal.findMany({
    where: { isPublished: true },
    include: {
      views: {
        select: {
          viewerIp: true,
          duration: true,
          scrollDepth: true,
          viewedAt: true,
        },
      },
    },
    orderBy: { publishedAt: "desc" },
  });

  const analytics = proposals.map((p) => {
    const views = p.views;
    const totalViews = views.length;
    const uniqueViewers = new Set(views.map((v) => v.viewerIp).filter(Boolean))
      .size;
    const avgDuration =
      totalViews > 0
        ? Math.round(views.reduce((sum, v) => sum + v.duration, 0) / totalViews)
        : 0;
    const avgScrollDepth =
      totalViews > 0
        ? Math.round(
            views.reduce((sum, v) => sum + v.scrollDepth, 0) / totalViews
          )
        : 0;
    const lastViewedAt =
      totalViews > 0
        ? views.reduce(
            (latest, v) =>
              v.viewedAt > latest ? v.viewedAt : latest,
            views[0].viewedAt
          )
        : null;

    return {
      id: p.id,
      title: p.title,
      companyName: p.companyName,
      slug: p.slug,
      publishedAt: p.publishedAt,
      totalViews,
      uniqueViewers,
      avgDuration,
      avgScrollDepth,
      lastViewedAt,
    };
  });

  // Sort: last viewed (most recent first), then by published date
  analytics.sort((a, b) => {
    if (a.lastViewedAt && b.lastViewedAt) {
      return (
        new Date(b.lastViewedAt).getTime() -
        new Date(a.lastViewedAt).getTime()
      );
    }
    if (a.lastViewedAt) return -1;
    if (b.lastViewedAt) return 1;
    return (
      new Date(b.publishedAt ?? 0).getTime() -
      new Date(a.publishedAt ?? 0).getTime()
    );
  });

  return NextResponse.json({ analytics });
}
