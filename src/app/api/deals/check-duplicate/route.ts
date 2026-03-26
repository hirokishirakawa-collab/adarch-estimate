import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";

// GET /api/deals/check-duplicate?customerId=xxx
export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.email) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const user = await db.user.findUnique({ where: { email: session.user.email } });
  if (!user) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const customerId = req.nextUrl.searchParams.get("customerId");
  if (!customerId) {
    return NextResponse.json({ deals: [] });
  }

  // Non-ADMIN users can only see deals from their own branch
  const branchFilter = user.role !== "ADMIN" && user.branchId
    ? { branchId: user.branchId }
    : {};

  const deals = await db.deal.findMany({
    where: {
      customerId,
      status: { notIn: ["CLOSED_WON", "CLOSED_LOST"] },
      ...branchFilter,
    },
    select: { id: true, title: true, status: true },
    orderBy: { updatedAt: "desc" },
  });

  return NextResponse.json({ deals });
}
