import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { verifyMobileToken } from "../_lib/verify-mobile-token";

export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  const user = await verifyMobileToken(req);
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = req.nextUrl;
  const limitParam = searchParams.get("limit");
  const limit = limitParam ? Math.min(Math.max(1, parseInt(limitParam, 10)), 100) : 20;

  try {
    const dbUser = await db.user.findUnique({
      where: { email: user.email },
      select: { id: true },
    });

    if (!dbUser) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    const [notifications, unreadCount] = await Promise.all([
      db.notification.findMany({
        where: { userId: dbUser.id },
        orderBy: { createdAt: "desc" },
        take: limit,
      }),
      db.notification.count({
        where: { userId: dbUser.id, isRead: false },
      }),
    ]);

    return NextResponse.json({ notifications, unreadCount });
  } catch (e) {
    console.error("[GET /api/mobile/notifications]", e);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest) {
  const user = await verifyMobileToken(req);
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await req.json();
    const { id, markAllRead } = body as { id?: string; markAllRead?: boolean };

    const dbUser = await db.user.findUnique({
      where: { email: user.email },
      select: { id: true },
    });

    if (!dbUser) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    if (markAllRead) {
      const { count } = await db.notification.updateMany({
        where: { userId: dbUser.id, isRead: false },
        data: { isRead: true },
      });
      return NextResponse.json({ ok: true, updatedCount: count });
    }

    if (!id) {
      return NextResponse.json(
        { error: "id or markAllRead is required" },
        { status: 400 }
      );
    }

    // Verify notification belongs to this user
    const notification = await db.notification.findFirst({
      where: { id, userId: dbUser.id },
      select: { id: true },
    });

    if (!notification) {
      return NextResponse.json({ error: "Notification not found" }, { status: 404 });
    }

    const updated = await db.notification.update({
      where: { id },
      data: { isRead: true },
    });

    return NextResponse.json(updated);
  } catch (e) {
    console.error("[PATCH /api/mobile/notifications]", e);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
