import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { AutoSalesAnalytics } from "./AutoSalesAnalytics";

export default async function AutoSalesAnalyticsPage() {
  const session = await auth();
  if (!session?.user?.email) redirect("/");

  const user = await db.user.findUnique({
    where: { email: session.user.email },
  });
  if (!user) redirect("/");

  const isAdmin = user.role === "ADMIN";
  if (!isAdmin && !user.enabledFeatures.includes("auto-sales")) {
    redirect("/dashboard");
  }

  const branchFilter = isAdmin ? {} : { branchId: user.branchId! };

  // --- 集計クエリ ---

  // 全体集計
  const [totalSent, totalResponses] = await Promise.all([
    db.autoSalesJob.count({
      where: { target: branchFilter, status: "COMPLETED" },
    }),
    db.autoSalesJob.count({
      where: { target: branchFilter, hasResponse: true },
    }),
  ]);

  // アポ獲得数（responseNote に [アポ獲得] が含まれるもの）
  const totalAppointments = await db.autoSalesJob.count({
    where: {
      target: branchFilter,
      hasResponse: true,
      responseNote: { contains: "[アポ獲得]" },
    },
  });

  const responseRate =
    totalSent > 0 ? Math.round((totalResponses / totalSent) * 1000) / 10 : 0;

  // テンプレート別集計
  const templateJobs = await db.autoSalesJob.findMany({
    where: { target: branchFilter, status: "COMPLETED" },
    select: {
      hasResponse: true,
      template: { select: { id: true, name: true } },
    },
  });

  const templateMap = new Map<
    string,
    { name: string; sent: number; responses: number }
  >();
  for (const j of templateJobs) {
    const key = j.template.id;
    if (!templateMap.has(key)) {
      templateMap.set(key, { name: j.template.name, sent: 0, responses: 0 });
    }
    const entry = templateMap.get(key)!;
    entry.sent++;
    if (j.hasResponse) entry.responses++;
  }
  const templateBreakdown = Array.from(templateMap.values())
    .map((t) => ({
      ...t,
      rate: t.sent > 0 ? Math.round((t.responses / t.sent) * 1000) / 10 : 0,
    }))
    .sort((a, b) => b.sent - a.sent);

  // 業種別集計
  const industryJobs = await db.autoSalesJob.findMany({
    where: { target: branchFilter, status: "COMPLETED" },
    select: {
      hasResponse: true,
      target: { select: { industry: true } },
    },
  });

  const industryMap = new Map<
    string,
    { sent: number; responses: number }
  >();
  for (const j of industryJobs) {
    const key = j.target.industry ?? "不明";
    if (!industryMap.has(key)) {
      industryMap.set(key, { sent: 0, responses: 0 });
    }
    const entry = industryMap.get(key)!;
    entry.sent++;
    if (j.hasResponse) entry.responses++;
  }
  const industryBreakdown = Array.from(industryMap.entries())
    .map(([industry, data]) => ({
      industry,
      ...data,
      rate:
        data.sent > 0
          ? Math.round((data.responses / data.sent) * 1000) / 10
          : 0,
    }))
    .sort((a, b) => b.sent - a.sent);

  // エリア別集計
  const areaJobs = await db.autoSalesJob.findMany({
    where: { target: branchFilter, status: "COMPLETED" },
    select: {
      hasResponse: true,
      target: { select: { area: true } },
    },
  });

  const areaMap = new Map<string, { sent: number; responses: number }>();
  for (const j of areaJobs) {
    const key = j.target.area ?? "不明";
    if (!areaMap.has(key)) {
      areaMap.set(key, { sent: 0, responses: 0 });
    }
    const entry = areaMap.get(key)!;
    entry.sent++;
    if (j.hasResponse) entry.responses++;
  }
  const areaBreakdown = Array.from(areaMap.entries())
    .map(([area, data]) => ({
      area,
      ...data,
      rate:
        data.sent > 0
          ? Math.round((data.responses / data.sent) * 1000) / 10
          : 0,
    }))
    .sort((a, b) => b.sent - a.sent);

  // 拠点別集計（本部のみ）。どの拠点が動いていて、どこが反響を取れているかを横並びで見る。
  let branchBreakdown: { branch: string; sent: number; responses: number; rate: number }[] = [];
  if (isAdmin) {
    const branchJobs = await db.autoSalesJob.findMany({
      where: { status: "COMPLETED" },
      select: {
        hasResponse: true,
        target: { select: { branch: { select: { name: true } } } },
      },
    });

    const branchMap = new Map<string, { sent: number; responses: number }>();
    for (const j of branchJobs) {
      const key = j.target.branch?.name ?? "不明";
      if (!branchMap.has(key)) {
        branchMap.set(key, { sent: 0, responses: 0 });
      }
      const entry = branchMap.get(key)!;
      entry.sent++;
      if (j.hasResponse) entry.responses++;
    }
    branchBreakdown = Array.from(branchMap.entries())
      .map(([branch, data]) => ({
        branch,
        ...data,
        rate: data.sent > 0 ? Math.round((data.responses / data.sent) * 1000) / 10 : 0,
      }))
      .sort((a, b) => b.sent - a.sent);
  }

  return (
    <AutoSalesAnalytics
      summary={{
        totalSent,
        totalResponses,
        responseRate,
        totalAppointments,
      }}
      templateBreakdown={templateBreakdown}
      industryBreakdown={industryBreakdown}
      areaBreakdown={areaBreakdown}
      branchBreakdown={branchBreakdown}
    />
  );
}
