import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import {
  DEFAULT_UNLOCK_THRESHOLD,
  SETTING_KEY_UNLOCK_THRESHOLD,
} from "@/lib/constants/proposals";

export const runtime = "nodejs";

// GET /api/proposals/settings
export async function GET() {
  const session = await auth();
  if (!session?.user?.email) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const [setting, user] = await Promise.all([
    db.appSetting.findUnique({ where: { key: SETTING_KEY_UNLOCK_THRESHOLD } }),
    db.user.findUnique({ where: { email: session.user.email } }),
  ]);

  return NextResponse.json({
    threshold: setting ? parseInt(setting.value, 10) : DEFAULT_UNLOCK_THRESHOLD,
    isAdmin: user?.role === "ADMIN",
  });
}

// PUT /api/proposals/settings — ADMIN only
export async function PUT(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.email) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const user = await db.user.findUnique({ where: { email: session.user.email } });
  if (!user || user.role !== "ADMIN") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = (await req.json()) as { threshold: number };
  if (!body.threshold || body.threshold < 1 || body.threshold > 100) {
    return NextResponse.json({ error: "threshold は 1〜100 の整数で指定してください" }, { status: 400 });
  }

  await db.appSetting.upsert({
    where: { key: SETTING_KEY_UNLOCK_THRESHOLD },
    update: { value: String(body.threshold) },
    create: { key: SETTING_KEY_UNLOCK_THRESHOLD, value: String(body.threshold) },
  });

  return NextResponse.json({ threshold: body.threshold });
}
