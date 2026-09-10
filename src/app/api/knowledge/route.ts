// GET  /api/knowledge          一覧（全員。hqOnly は ADMIN だけ。q / origin / status / from / to / sort）
// POST /api/knowledge          登録（ADMIN）。multipart: kind=FILE|URL|TEXT, file | url | text, title, origin, publisher, publishedAt, hqOnly, note
//                              登録直後に返し、after() で全文取り出し→AI整理を回す（数十秒〜数分）
import { NextRequest, NextResponse, after } from "next/server";
import { db } from "@/lib/db";
import { saveKnowledgeFile } from "@/lib/storage";
import { logAudit } from "@/lib/audit";
import { detectExt, MAX_FILE_BYTES } from "@/lib/knowledge/extract";
import { processSource } from "@/lib/knowledge/ingest";
import { requireReader, requireAdmin } from "./_guard";
import type { Prisma, KnowledgeOrigin, KnowledgeStatus } from "@/generated/prisma/client";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

export async function GET(req: NextRequest) {
  const { error, info } = await requireReader();
  if (error) return error;
  const sp = req.nextUrl.searchParams;
  const q = (sp.get("q") ?? "").trim();
  const origin = sp.get("origin") as KnowledgeOrigin | null;
  const status = sp.get("status") as KnowledgeStatus | null;
  const from = sp.get("from");
  const to = sp.get("to");
  const sort = sp.get("sort") ?? "createdAt";
  const dir = sp.get("dir") === "asc" ? "asc" : "desc";
  const isAdmin = info.role === "ADMIN";

  const where: Prisma.KnowledgeSourceWhereInput = {
    ...(isAdmin ? {} : { hqOnly: false, status: "READY" }),
    ...(origin === "OWN" || origin === "EXTERNAL" ? { origin } : {}),
    ...(isAdmin && status && ["PENDING", "READY", "FAILED"].includes(status) ? { status } : {}),
    ...(from || to
      ? { createdAt: { ...(from ? { gte: new Date(from) } : {}), ...(to ? { lte: new Date(to + "T23:59:59+09:00") } : {}) } }
      : {}),
    ...(q
      ? {
          OR: [
            { title: { contains: q, mode: "insensitive" } },
            { publisher: { contains: q, mode: "insensitive" } },
            { summary: { contains: q, mode: "insensitive" } },
            { keywords: { has: q } },
            { content: { contains: q, mode: "insensitive" } },
          ],
        }
      : {}),
  };
  const orderBy: Prisma.KnowledgeSourceOrderByWithRelationInput =
    sort === "title" ? { title: dir } : sort === "publisher" ? { publisher: dir } : sort === "updatedAt" ? { updatedAt: dir } : sort === "charCount" ? { charCount: dir } : { createdAt: dir };

  const rows = await db.knowledgeSource.findMany({
    where,
    orderBy,
    take: 500,
    select: {
      id: true, title: true, origin: true, kind: true, publisher: true, publishedAt: true, fileName: true, fileUrl: true, sourceUrl: true,
      hqOnly: true, status: true, errorMessage: true, summary: true, keywords: true, pageCount: true, charCount: true,
      createdByName: true, note: true, createdAt: true, updatedAt: true,
    },
  });
  return NextResponse.json({ items: rows, isAdmin });
}

export async function POST(req: NextRequest) {
  const { error, info } = await requireAdmin();
  if (error) return error;
  const form = await req.formData().catch(() => null);
  if (!form) return NextResponse.json({ error: "フォームを読めませんでした" }, { status: 400 });

  const kind = String(form.get("kind") ?? "FILE");
  const originRaw = String(form.get("origin") ?? "EXTERNAL");
  const origin: KnowledgeOrigin = originRaw === "OWN" ? "OWN" : "EXTERNAL";
  const title = String(form.get("title") ?? "").trim();
  const publisher = String(form.get("publisher") ?? "").trim() || null;
  const publishedAt = String(form.get("publishedAt") ?? "").trim() || null;
  const note = String(form.get("note") ?? "").trim() || null;
  const hqOnly = String(form.get("hqOnly") ?? "") === "1";

  const base = { origin, publisher, publishedAt, note, hqOnly, createdByName: info.staffName, createdByEmail: info.email };
  let created: { id: string; title: string };

  if (kind === "FILE") {
    const file = form.get("file");
    if (!(file instanceof File)) return NextResponse.json({ error: "ファイルがありません" }, { status: 400 });
    const ext = detectExt(file.name, file.type);
    if (!ext) return NextResponse.json({ error: "対応形式は PDF / PPTX / DOCX / TXT / MD / CSV です" }, { status: 400 });
    if (file.size > MAX_FILE_BYTES) return NextResponse.json({ error: "30MBを超えています（PDFは分割してください）" }, { status: 400 });
    const buf = Buffer.from(await file.arrayBuffer());
    const fileUrl = await saveKnowledgeFile(file.name, buf, ext);
    created = await db.knowledgeSource.create({
      data: { ...base, kind: "FILE", title: title || file.name, fileUrl, fileName: file.name, mimeType: file.type || null, fileSize: file.size },
      select: { id: true, title: true },
    });
  } else if (kind === "URL") {
    const url = String(form.get("url") ?? "").trim();
    if (!/^https?:\/\//i.test(url)) return NextResponse.json({ error: "http(s):// で始まるURLを入れてください" }, { status: 400 });
    created = await db.knowledgeSource.create({
      data: { ...base, kind: "URL", title: title || url, sourceUrl: url },
      select: { id: true, title: true },
    });
  } else if (kind === "TEXT") {
    const text = String(form.get("text") ?? "").trim();
    if (text.length < 20) return NextResponse.json({ error: "本文が短すぎます" }, { status: 400 });
    if (!title) return NextResponse.json({ error: "題名を入れてください" }, { status: 400 });
    created = await db.knowledgeSource.create({
      data: { ...base, kind: "TEXT", title, content: text, charCount: text.length },
      select: { id: true, title: true },
    });
  } else {
    return NextResponse.json({ error: "kind が不正です" }, { status: 400 });
  }

  void logAudit({ action: "knowledge_create", email: info.email, name: info.staffName, entity: "knowledge_source", entityId: created.id, detail: `${kind} ${origin} ${created.title}`.slice(0, 300) });
  after(() => processSource(created.id));
  return NextResponse.json({ id: created.id, status: "PENDING" });
}
