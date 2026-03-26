import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.email) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const user = await db.user.findUnique({ where: { email: session.user.email }, select: { id: true } });
    if (!user) return NextResponse.json({ error: "User not found" }, { status: 404 });

    const body = await req.json();

    if (body.all) {
      await db.notification.updateMany({
        where: { userId: user.id, isRead: false },
        data: { isRead: true },
      });
    } else if (Array.isArray(body.ids)) {
      await db.notification.updateMany({
        where: { id: { in: body.ids }, userId: user.id },
        data: { isRead: true },
      });
    }

    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error("[POST /api/notifications/read]", e);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
