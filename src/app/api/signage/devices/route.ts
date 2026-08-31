// GET /api/signage/devices — 端末一覧（動作状況つき）
import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireSignageUser, scope } from "../_guard";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const { error, info } = await requireSignageUser();
  if (error) return error;
  const devices = await db.signageDevice.findMany({
    where: { ...scope(info), isActive: true },
    orderBy: [{ branchId: "asc" }, { name: "asc" }],
    include: {
      branch: { select: { id: true, name: true } },
      customer: { select: { id: true, name: true } },
      schedules: { where: { isActive: true }, include: { playlist: { select: { id: true, name: true, _count: { select: { items: true } } } } }, orderBy: { priority: "desc" } },
    },
  });
  const now = Date.now();
  return NextResponse.json(
    devices.map((d) => ({
      ...d,
      online: !!d.lastSeenAt && now - d.lastSeenAt.getTime() < Math.max(d.pollSec * 3, 300) * 1000,
    }))
  );
}
