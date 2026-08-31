// DELETE /api/signage/assets/[id] — ゴミ箱へ（?restore=1 で戻す）。使用中端末の版を上げる
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireSignageUser, scope } from "../../_guard";
import { bumpDevicesForAsset } from "@/lib/signage/manifest";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function DELETE(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { error, info } = await requireSignageUser();
  if (error) return error;
  const { id } = await ctx.params;
  const a = await db.signageAsset.findFirst({ where: { id, ...(info.role === "ADMIN" ? {} : scope(info)) }, select: { id: true } });
  if (!a) return new NextResponse("Not found", { status: 404 });
  const restore = req.nextUrl.searchParams.get("restore") === "1";
  await db.signageAsset.update({ where: { id }, data: { trashedAt: restore ? null : new Date() } });
  await bumpDevicesForAsset(id);
  return NextResponse.json({ ok: true });
}
