// PATCH/DELETE /api/signage/schedules/[id]
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireSignageUser, scope } from "../../_guard";
import { bumpDevice } from "@/lib/signage/manifest";
import { parseScheduleBody } from "../route";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

async function find(id: string, info: Parameters<typeof scope>[0]) {
  return db.signageSchedule.findFirst({ where: { id, device: scope(info) }, select: { id: true, deviceId: true } });
}

export async function PATCH(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { error, info } = await requireSignageUser();
  if (error) return error;
  const { id } = await ctx.params;
  const s = await find(id, info);
  if (!s) return new NextResponse("Not found", { status: 404 });
  const b = await req.json().catch(() => ({}));
  const data: Record<string, unknown> = parseScheduleBody(b);
  if (typeof b.playlistId === "string" && b.playlistId) {
    const pl = await db.signagePlaylist.findFirst({ where: { id: b.playlistId, ...scope(info) }, select: { id: true } });
    if (!pl) return NextResponse.json({ error: "プレイリストが見つかりません" }, { status: 404 });
    data.playlistId = pl.id;
  }
  const row = await db.signageSchedule.update({ where: { id }, data });
  await bumpDevice(s.deviceId);
  return NextResponse.json(row);
}

export async function DELETE(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { error, info } = await requireSignageUser();
  if (error) return error;
  const { id } = await ctx.params;
  const s = await find(id, info);
  if (!s) return new NextResponse("Not found", { status: 404 });
  await db.signageSchedule.delete({ where: { id } });
  await bumpDevice(s.deviceId);
  return NextResponse.json({ ok: true });
}
