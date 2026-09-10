// POST /api/knowledge/bulk  { ids: string[], action: "delete" | "reprocess" | "setOrigin" | "setHqOnly", value? }（ADMIN）
import { NextRequest, NextResponse, after } from "next/server";
import { db } from "@/lib/db";
import { logAudit } from "@/lib/audit";
import { processSource } from "@/lib/knowledge/ingest";
import { requireAdmin } from "../_guard";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  const { error, info } = await requireAdmin();
  if (error) return error;
  const body = (await req.json().catch(() => ({}))) as { ids?: unknown; action?: string; value?: unknown };
  const ids = Array.isArray(body.ids) ? body.ids.filter((x): x is string => typeof x === "string").slice(0, 200) : [];
  if (ids.length === 0) return NextResponse.json({ error: "対象がありません" }, { status: 400 });

  let count = 0;
  switch (body.action) {
    case "delete": {
      const r = await db.knowledgeSource.deleteMany({ where: { id: { in: ids } } });
      count = r.count;
      break;
    }
    case "reprocess": {
      const r = await db.knowledgeSource.updateMany({ where: { id: { in: ids } }, data: { status: "PENDING", errorMessage: null } });
      count = r.count;
      after(async () => {
        for (const id of ids) await processSource(id); // 直列（AIの同時実行を抑える）
      });
      break;
    }
    case "setOrigin": {
      const origin = body.value === "OWN" ? "OWN" : body.value === "EXTERNAL" ? "EXTERNAL" : null;
      if (!origin) return NextResponse.json({ error: "value が不正です" }, { status: 400 });
      const r = await db.knowledgeSource.updateMany({ where: { id: { in: ids } }, data: { origin } });
      count = r.count;
      break;
    }
    case "setHqOnly": {
      const r = await db.knowledgeSource.updateMany({ where: { id: { in: ids } }, data: { hqOnly: body.value === true } });
      count = r.count;
      break;
    }
    default:
      return NextResponse.json({ error: "action が不正です" }, { status: 400 });
  }
  void logAudit({ action: `knowledge_bulk_${body.action}`, email: info.email, name: info.staffName, entity: "knowledge_source", detail: `${count}件 ${ids.slice(0, 20).join(",")}`.slice(0, 300) });
  return NextResponse.json({ ok: true, count });
}
