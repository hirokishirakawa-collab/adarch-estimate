// POST /api/dm/kits/bulk — { ids, action: "delete" | "sent" | "unsent" }
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { logAudit } from "@/lib/audit";
import { requireDmUser, kitScope } from "../../_guard";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  const { error, me } = await requireDmUser();
  if (error) return error;
  const body = (await req.json().catch(() => ({}))) as { ids?: unknown; action?: string };
  const ids = Array.isArray(body.ids) ? body.ids.filter((x): x is string => typeof x === "string").slice(0, 200) : [];
  if (ids.length === 0) return NextResponse.json({ error: "対象がありません" }, { status: 400 });
  const where = { id: { in: ids }, ...kitScope(me) };
  let count = 0;
  if (body.action === "delete") count = (await db.dmKit.deleteMany({ where })).count;
  else if (body.action === "sent") count = (await db.dmKit.updateMany({ where, data: { sentAt: new Date() } })).count;
  else if (body.action === "unsent") count = (await db.dmKit.updateMany({ where, data: { sentAt: null } })).count;
  else return NextResponse.json({ error: "action が不正です" }, { status: 400 });
  void logAudit({ action: `dm_kit_bulk_${body.action}`, email: me.email, name: me.name, entity: "dm_kit", detail: `${count}件` });
  return NextResponse.json({ ok: true, count });
}
