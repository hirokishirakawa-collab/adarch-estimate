// GET/POST /api/signage/playlists
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireSignageUser, scope, branchIdForCreate } from "../_guard";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const { error, info } = await requireSignageUser();
  if (error) return error;
  const rows = await db.signagePlaylist.findMany({
    where: scope(info),
    orderBy: { updatedAt: "desc" },
    include: { _count: { select: { items: true, schedules: true } }, branch: { select: { id: true, name: true } } },
  });
  return NextResponse.json(rows);
}

export async function POST(req: NextRequest) {
  const { error, info } = await requireSignageUser();
  if (error) return error;
  const b = await req.json().catch(() => ({}));
  const name = String(b.name ?? "").trim();
  if (!name) return NextResponse.json({ error: "名前は必須です" }, { status: 400 });
  const row = await db.signagePlaylist.create({ data: { name, branchId: branchIdForCreate(info, b.branchId) } });
  return NextResponse.json(row);
}
