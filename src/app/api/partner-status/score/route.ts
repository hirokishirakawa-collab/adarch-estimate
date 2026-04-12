// ==============================================================
// GET /api/partner-status/score — パートナースコア一覧（ADMIN専用）
// ==============================================================

import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";

// GET: 指定月のパートナースコアを totalScore 降順で返す
export async function GET(req: NextRequest) {
  try {
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

    const yearParam = req.nextUrl.searchParams.get("year");
    const monthParam = req.nextUrl.searchParams.get("month");

    const now = new Date();
    const year = yearParam ? parseInt(yearParam, 10) : now.getFullYear();
    const month = monthParam ? parseInt(monthParam, 10) : now.getMonth() + 1;

    if (isNaN(year) || isNaN(month) || month < 1 || month > 12) {
      return NextResponse.json(
        { error: "Invalid year or month" },
        { status: 400 }
      );
    }

    const scores = await db.partnerScore.findMany({
      where: { year, month },
      include: {
        groupCompany: { select: { id: true, name: true, ownerName: true } },
      },
      orderBy: { totalScore: "desc" },
    });

    return NextResponse.json({ year, month, scores });
  } catch (e) {
    console.error("[partner-status/score GET] Error:", e);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
