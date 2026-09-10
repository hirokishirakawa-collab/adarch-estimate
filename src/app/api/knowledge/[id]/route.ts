// GET    /api/knowledge/[id]   詳細（全文・整理。全員。hqOnly は ADMIN だけ）
// PATCH  /api/knowledge/[id]   題名・出どころ・発行元・年月・本部限定・メモ（ADMIN）
// POST   /api/knowledge/[id]   { action: "reprocess" } 取り込みのやり直し（ADMIN）
// DELETE /api/knowledge/[id]   削除（ADMIN）
import { NextRequest, NextResponse, after } from "next/server";
import { db } from "@/lib/db";
import { logAudit } from "@/lib/audit";
import { processSource } from "@/lib/knowledge/ingest";
import { requireReader, requireAdmin } from "../_guard";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

export async function GET(_req: NextRequest, ctx: Ctx) {
  const { error, info } = await requireReader();
  if (error) return error;
  const { id } = await ctx.params;
  const row = await db.knowledgeSource.findUnique({ where: { id } });
  if (!row) return NextResponse.json({ error: "見つかりません" }, { status: 404 });
  const isAdmin = info.role === "ADMIN";
  if (!isAdmin && (row.hqOnly || row.status !== "READY")) return NextResponse.json({ error: "見つかりません" }, { status: 404 });
  return NextResponse.json({ ...row, isAdmin });
}

export async function PATCH(req: NextRequest, ctx: Ctx) {
  const { error, info } = await requireAdmin();
  if (error) return error;
  const { id } = await ctx.params;
  const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  const data: Record<string, unknown> = {};
  if (typeof body.title === "string" && body.title.trim()) data.title = body.title.trim();
  if (body.origin === "OWN" || body.origin === "EXTERNAL") data.origin = body.origin;
  if (typeof body.publisher === "string") data.publisher = body.publisher.trim() || null;
  if (typeof body.publishedAt === "string") data.publishedAt = body.publishedAt.trim() || null;
  if (typeof body.note === "string") data.note = body.note.trim() || null;
  if (typeof body.hqOnly === "boolean") data.hqOnly = body.hqOnly;
  if (Object.keys(data).length === 0) return NextResponse.json({ error: "変更がありません" }, { status: 400 });
  const row = await db.knowledgeSource.update({ where: { id }, data, select: { id: true, title: true, origin: true, hqOnly: true } });
  void logAudit({ action: "knowledge_update", email: info.email, name: info.staffName, entity: "knowledge_source", entityId: id, detail: JSON.stringify(data).slice(0, 300) });
  return NextResponse.json(row);
}

export async function POST(req: NextRequest, ctx: Ctx) {
  const { error, info } = await requireAdmin();
  if (error) return error;
  const { id } = await ctx.params;
  const body = (await req.json().catch(() => ({}))) as { action?: string };
  if (body.action !== "reprocess") return NextResponse.json({ error: "action が不正です" }, { status: 400 });
  const row = await db.knowledgeSource.findUnique({ where: { id }, select: { id: true } });
  if (!row) return NextResponse.json({ error: "見つかりません" }, { status: 404 });
  await db.knowledgeSource.update({ where: { id }, data: { status: "PENDING", errorMessage: null } });
  void logAudit({ action: "knowledge_reprocess", email: info.email, name: info.staffName, entity: "knowledge_source", entityId: id });
  after(() => processSource(id));
  return NextResponse.json({ id, status: "PENDING" });
}

export async function DELETE(_req: NextRequest, ctx: Ctx) {
  const { error, info } = await requireAdmin();
  if (error) return error;
  const { id } = await ctx.params;
  const row = await db.knowledgeSource.delete({ where: { id }, select: { id: true, title: true } }).catch(() => null);
  if (!row) return NextResponse.json({ error: "見つかりません" }, { status: 404 });
  void logAudit({ action: "knowledge_delete", email: info.email, name: info.staffName, entity: "knowledge_source", entityId: id, detail: row.title.slice(0, 200) });
  return NextResponse.json({ ok: true });
}
