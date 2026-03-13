import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";

// GET /api/deals/check-duplicate?customerId=xxx
export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const customerId = req.nextUrl.searchParams.get("customerId");
  if (!customerId) {
    return NextResponse.json({ deals: [] });
  }

  const deals = await db.deal.findMany({
    where: {
      customerId,
      status: { notIn: ["CLOSED_WON", "CLOSED_LOST"] },
    },
    select: { id: true, title: true, status: true },
    orderBy: { updatedAt: "desc" },
  });

  return NextResponse.json({ deals });
}
