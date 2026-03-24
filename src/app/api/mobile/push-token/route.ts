import { NextRequest, NextResponse } from "next/server";
import { verifyMobileToken } from "../_lib/verify-mobile-token";
import { db } from "@/lib/db";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  const payload = await verifyMobileToken(req);
  if (!payload) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { token, platform } = await req.json();
  if (!token) {
    return NextResponse.json({ error: "token required" }, { status: 400 });
  }

  await db.pushToken.upsert({
    where: { token },
    update: { email: payload.email, platform, updatedAt: new Date() },
    create: { token, email: payload.email, platform },
  });

  return NextResponse.json({ ok: true });
}
