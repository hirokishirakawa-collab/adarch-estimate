// GET /api/dm/kits — 郵送DMの材料の履歴（q / sent / from / to / sort / dir）
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import type { Prisma } from "@/generated/prisma/client";
import { requireDmUser, kitScope } from "../_guard";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const { error, me } = await requireDmUser();
  if (error) return error;
  const sp = req.nextUrl.searchParams;
  const q = (sp.get("q") ?? "").trim();
  const sent = sp.get("sent"); // "1" 発送済みだけ / "0" 未発送だけ
  const from = sp.get("from");
  const to = sp.get("to");
  const sort = sp.get("sort") ?? "createdAt";
  const dir = sp.get("dir") === "asc" ? "asc" : "desc";
  const where: Prisma.DmKitWhereInput = {
    ...kitScope(me),
    ...(sent === "1" ? { sentAt: { not: null } } : sent === "0" ? { sentAt: null } : {}),
    ...(from || to ? { createdAt: { ...(from ? { gte: new Date(from) } : {}), ...(to ? { lte: new Date(to + "T23:59:59+09:00") } : {}) } } : {}),
    ...(q ? { OR: [{ city: { contains: q } }, { prefecture: { contains: q } }, { industry: { contains: q } }, { catchCopy: { contains: q } }, { createdByName: { contains: q } }] } : {}),
  };
  const orderBy: Prisma.DmKitOrderByWithRelationInput =
    sort === "city" ? { city: dir } : sort === "readyCount" ? { readyCount: dir } : sort === "sentAt" ? { sentAt: dir } : { createdAt: dir };
  const rows = await db.dmKit.findMany({
    where, orderBy, take: 300,
    select: { id: true, prefecture: true, city: true, industry: true, catchCopy: true, template: true, flyerUrl: true, flyerSource: true, source: true, readyCount: true, needsFixCount: true, skippedCount: true, sentAt: true, sentVia: true, createdByName: true, createdById: true, createdAt: true },
  });
  return NextResponse.json({ items: rows, meId: me.id, isAdmin: me.role === "ADMIN" });
}
