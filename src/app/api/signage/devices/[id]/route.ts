// GET/PATCH/DELETE /api/signage/devices/[id]
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireSignageUser, scope } from "../../_guard";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { error, info } = await requireSignageUser();
  if (error) return error;
  const { id } = await ctx.params;
  const d = await db.signageDevice.findFirst({
    where: { id, ...scope(info) },
    include: {
      branch: { select: { id: true, name: true } },
      customer: { select: { id: true, name: true } },
      schedules: { orderBy: [{ priority: "desc" }, { createdAt: "asc" }], include: { playlist: { select: { id: true, name: true } } } },
    },
  });
  if (!d) return new NextResponse("Not found", { status: 404 });
  // 直近7日の再生回数（素材別）
  const since = new Date(Date.now() - 7 * 86400 * 1000);
  const plays = await db.signagePlayLog.groupBy({ by: ["assetId"], where: { deviceId: id, playedAt: { gte: since } }, _count: { _all: true }, _sum: { durationSec: true } });
  return NextResponse.json({ ...d, plays7d: plays.map((p) => ({ assetId: p.assetId, count: p._count._all, seconds: p._sum.durationSec ?? 0 })) });
}

export async function PATCH(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { error, info } = await requireSignageUser();
  if (error) return error;
  const { id } = await ctx.params;
  const exists = await db.signageDevice.findFirst({ where: { id, ...scope(info) }, select: { id: true } });
  if (!exists) return new NextResponse("Not found", { status: 404 });
  const b = await req.json().catch(() => ({}));
  const data: Record<string, unknown> = {};
  if (typeof b.name === "string" && b.name.trim()) data.name = b.name.trim();
  if ("locationName" in b) data.locationName = typeof b.locationName === "string" ? b.locationName.trim() || null : null;
  if ("address" in b) data.address = typeof b.address === "string" ? b.address.trim() || null : null;
  if ("notes" in b) data.notes = typeof b.notes === "string" ? b.notes : null;
  if ("customerId" in b) data.customerId = typeof b.customerId === "string" && b.customerId ? b.customerId : null;
  if (b.orientation === "PORTRAIT" || b.orientation === "LANDSCAPE") data.orientation = b.orientation;
  if (typeof b.pollSec === "number" && b.pollSec >= 15 && b.pollSec <= 3600) data.pollSec = Math.round(b.pollSec);
  if (info.role === "ADMIN" && "branchId" in b) data.branchId = typeof b.branchId === "string" && b.branchId ? b.branchId : null;
  // 表示に関わる変更は版を上げる
  if ("orientation" in data || "pollSec" in data) data.manifestVersion = { increment: 1 };
  const updated = await db.signageDevice.update({ where: { id }, data });
  return NextResponse.json(updated);
}

export async function DELETE(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { error, info } = await requireSignageUser();
  if (error) return error;
  const { id } = await ctx.params;
  const exists = await db.signageDevice.findFirst({ where: { id, ...scope(info) }, select: { id: true } });
  if (!exists) return new NextResponse("Not found", { status: 404 });
  // 物理削除はしない（再生ログを残す）。無効化＝端末は404を受けて再ペアリングへ
  await db.signageDevice.update({ where: { id }, data: { isActive: false, pairedAt: null, pairingCode: null } });
  return NextResponse.json({ ok: true });
}
