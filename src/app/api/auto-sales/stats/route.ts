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

  // 全ジョブ取得（集計用）
  const allJobs = await db.autoSalesJob.findMany({
    where: { target: branchFilter },
    select: {
      status: true,
      hasResponse: true,
      createdAt: true,
      target: { select: { industry: true } },
      template: { select: { name: true } },
    },
  });

  // 全体集計
  const totalSent = allJobs.filter((j) => j.status === "COMPLETED").length;
  const totalResponses = allJobs.filter((j) => j.hasResponse).length;
  const totalQueued = allJobs.filter((j) => j.status === "QUEUED").length;
  const totalFailed = allJobs.filter((j) => j.status === "FAILED").length;
  const totalSkipped = allJobs.filter((j) => j.status === "SKIPPED").length;
  const responseRate = totalSent > 0 ? Math.round((totalResponses / totalSent) * 1000) / 10 : 0;

  // 業種別集計
  const industryMap = new Map<string, { sent: number; responses: number }>();
  for (const j of allJobs) {
    const ind = j.target.industry ?? "不明";
    if (!industryMap.has(ind)) industryMap.set(ind, { sent: 0, responses: 0 });
    const entry = industryMap.get(ind)!;
    if (j.status === "COMPLETED") entry.sent++;
    if (j.hasResponse) entry.responses++;
  }
  const byIndustry = Array.from(industryMap.entries())
    .map(([industry, data]) => ({
      industry,
      sent: data.sent,
      responses: data.responses,
      rate: data.sent > 0 ? Math.round((data.responses / data.sent) * 1000) / 10 : 0,
    }))
    .sort((a, b) => b.sent - a.sent);

  // テンプレート別集計
  const templateMap = new Map<string, { sent: number; responses: number }>();
  for (const j of allJobs) {
    const name = j.template.name ?? "不明";
    if (!templateMap.has(name)) templateMap.set(name, { sent: 0, responses: 0 });
    const entry = templateMap.get(name)!;
    if (j.status === "COMPLETED") entry.sent++;
    if (j.hasResponse) entry.responses++;
  }
  const byTemplate = Array.from(templateMap.entries())
    .map(([template, data]) => ({
      template,
      sent: data.sent,
      responses: data.responses,
      rate: data.sent > 0 ? Math.round((data.responses / data.sent) * 1000) / 10 : 0,
    }))
    .sort((a, b) => b.sent - a.sent);

  // 営業先総数
  const totalTargets = await db.autoSalesTarget.count({ where: branchFilter });

  return NextResponse.json({
    totalTargets,
    totalSent,
    totalResponses,
    totalQueued,
    totalFailed,
    totalSkipped,
    responseRate,
    byIndustry,
    byTemplate,
  });
}
