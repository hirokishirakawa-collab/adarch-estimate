// GET/PATCH/DELETE /api/dm/kits/[id] — 材料1件（発送済みチェック・削除）
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { logAudit } from "@/lib/audit";
import { requireDmUser, kitScope } from "../../_guard";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
type Ctx = { params: Promise<{ id: string }> };

export async function GET(_req: NextRequest, ctx: Ctx) {
  const { error, me } = await requireDmUser();
  if (error) return error;
  const { id } = await ctx.params;
  const row = await db.dmKit.findFirst({ where: { id, ...kitScope(me) } });
  if (!row) return NextResponse.json({ error: "見つかりません" }, { status: 404 });
  return NextResponse.json(row);
}

export async function PATCH(req: NextRequest, ctx: Ctx) {
  const { error, me } = await requireDmUser();
  if (error) return error;
  const { id } = await ctx.params;
  const row = await db.dmKit.findFirst({ where: { id, ...kitScope(me) }, select: { id: true } });
  if (!row) return NextResponse.json({ error: "見つかりません" }, { status: 404 });
  const body = (await req.json().catch(() => ({}))) as { sent?: boolean; sentVia?: string; sentNote?: string };
  const data: Record<string, unknown> = {};
  if (typeof body.sent === "boolean") data.sentAt = body.sent ? new Date() : null;
  if (typeof body.sentVia === "string") data.sentVia = body.sentVia.trim().slice(0, 40) || null;
  if (typeof body.sentNote === "string") data.sentNote = body.sentNote.trim().slice(0, 1000) || null;
  if (Object.keys(data).length === 0) return NextResponse.json({ error: "変更がありません" }, { status: 400 });
  const out = await db.dmKit.update({ where: { id }, data, select: { id: true, sentAt: true, sentVia: true, sentNote: true } });
  void logAudit({ action: "dm_kit_update", email: me.email, name: me.name, entity: "dm_kit", entityId: id, detail: JSON.stringify(data).slice(0, 300) });
  return NextResponse.json(out);
}

export async function DELETE(_req: NextRequest, ctx: Ctx) {
  const { error, me } = await requireDmUser();
  if (error) return error;
  const { id } = await ctx.params;
  const row = await db.dmKit.findFirst({ where: { id, ...kitScope(me) }, select: { id: true, city: true } });
  if (!row) return NextResponse.json({ error: "見つかりません" }, { status: 404 });
  await db.dmKit.delete({ where: { id } });
  void logAudit({ action: "dm_kit_delete", email: me.email, name: me.name, entity: "dm_kit", entityId: id, detail: row.city });
  return NextResponse.json({ ok: true });
}
