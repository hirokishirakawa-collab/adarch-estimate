import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";

export const runtime = "nodejs";

// GET /api/sales-activities — 自分のアクティビティ一覧（当月 + 全件）
export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.email) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const user = await db.user.findUnique({ where: { email: session.user.email } });
  if (!user) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

  // 当月の開始日
  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

  const [activities, monthCount] = await Promise.all([
    db.salesActivity.findMany({
      where: { userId: user.id },
      orderBy: { date: "desc" },
      take: 50,
    }),
    db.salesActivity.count({
      where: {
        userId: user.id,
        date: { gte: monthStart },
      },
    }),
  ]);

  return NextResponse.json({ activities, monthCount });
}

// POST /api/sales-activities — アクティビティ登録
export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.email) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const user = await db.user.findUnique({ where: { email: session.user.email } });
  if (!user) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

  const body = (await req.json()) as {
    companyName: string;
    type: string;
    note?: string;
    date?: string;
  };

  if (!body.companyName || !body.type) {
    return NextResponse.json({ error: "companyName and type are required" }, { status: 400 });
  }

  const activity = await db.salesActivity.create({
    data: {
      userId: user.id,
      companyName: body.companyName,
      type: body.type as any,
      note: body.note || null,
      date: body.date ? new Date(body.date) : new Date(),
    },
  });

  return NextResponse.json({ activity }, { status: 201 });
}
