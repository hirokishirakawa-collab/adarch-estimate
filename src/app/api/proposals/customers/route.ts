import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";

export const runtime = "nodejs";

// GET /api/proposals/customers — 顧客一覧（提案書フォーム用）
export async function GET() {
  const session = await auth();
  if (!session?.user?.email) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const user = await db.user.findUnique({ where: { email: session.user.email } });
  if (!user) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

  // ADMIN: 全顧客、MANAGER/USER: 自拠点
  const where =
    user.role === "ADMIN" || !user.branchId
      ? {}
      : {
          branchId: {
            in: [user.branchId, user.branchId2].filter(Boolean) as string[],
          },
        };

  const customers = await db.customer.findMany({
    where,
    select: {
      id: true,
      name: true,
      industry: true,
      contactName: true,
      phone: true,
      website: true,
      notes: true,
      hearingSheets: {
        select: {
          id: true,
          businessDescription: true,
          targetCustomers: true,
          tradeArea: true,
          annualRevenue: true,
          employeeCount: true,
          currentChannels: true,
          monthlyAdBudget: true,
          pastEfforts: true,
          competitors: true,
          primaryChallenge: true,
          challengeDetail: true,
          interestedServices: true,
          desiredTimeline: true,
          decisionMaker: true,
          budgetStatus: true,
          videoPurposes: true,
          videoBudget: true,
          temperature: true,
        },
        orderBy: { updatedAt: "desc" },
        take: 1,
      },
    },
    orderBy: { name: "asc" },
  });

  // 金額マスキング: ADMINまたは作成者本人以外は予算フィールドを非表示
  const isAdmin = user.role === "ADMIN";
  const masked = customers.map((c) => ({
    ...c,
    hearingSheets: c.hearingSheets.map((hs) => ({
      ...hs,
      monthlyAdBudget: isAdmin ? hs.monthlyAdBudget : null,
      videoBudget: isAdmin ? hs.videoBudget : null,
      annualRevenue: isAdmin ? hs.annualRevenue : null,
    })),
  }));

  return NextResponse.json({ customers: masked });
}
