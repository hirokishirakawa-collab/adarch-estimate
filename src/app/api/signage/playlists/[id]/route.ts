// GET/PATCH/DELETE /api/signage/playlists/[id]
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireSignageUser, scope } from "../../_guard";
import { bumpDevicesForPlaylist } from "@/lib/signage/manifest";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { error, info } = await requireSignageUser();
  if (error) return error;
  const { id } = await ctx.params;
  const row = await db.signagePlaylist.findFirst({
    where: { id, ...scope(info) },
    include: {
      items: { orderBy: { order: "asc" }, include: { asset: true, advertiserCustomer: { select: { id: true, name: true } } } },
      schedules: { include: { device: { select: { id: true, name: true } } } },
    },
  });
  if (!row) return new NextResponse("Not found", { status: 404 });
  return NextResponse.json(row);
}

export async function PATCH(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { error, info } = await requireSignageUser();
  if (error) return error;
  const { id } = await ctx.params;
  const exists = await db.signagePlaylist.findFirst({ where: { id, ...scope(info) }, select: { id: true } });
  if (!exists) return new NextResponse("Not found", { status: 404 });
  const b = await req.json().catch(() => ({}));
  const name = String(b.name ?? "").trim();
  if (!name) return NextResponse.json({ error: "名前は必須です" }, { status: 400 });
  const row = await db.signagePlaylist.update({ where: { id }, data: { name } });
  return NextResponse.json(row);
}

export async function DELETE(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { error, info } = await requireSignageUser();
  if (error) return error;
  const { id } = await ctx.params;
  const exists = await db.signagePlaylist.findFirst({ where: { id, ...scope(info) }, select: { id: true } });
  if (!exists) return new NextResponse("Not found", { status: 404 });
  await bumpDevicesForPlaylist(id);
  await db.signagePlaylist.delete({ where: { id } }); // schedules/items は Cascade
  return NextResponse.json({ ok: true });
}
