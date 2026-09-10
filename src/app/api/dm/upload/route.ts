// POST /api/dm/upload — 自作チラシ（PDF・20MBまで）を dm-kits に保存し URL を返す
import { NextRequest, NextResponse } from "next/server";
import { saveDmKitFile } from "@/lib/storage";
import { requireDmUser } from "../_guard";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MAX = 20 * 1024 * 1024;

export async function POST(req: NextRequest) {
  const { error } = await requireDmUser();
  if (error) return error;
  const form = await req.formData().catch(() => null);
  const file = form?.get("file");
  if (!(file instanceof File)) return NextResponse.json({ error: "ファイルがありません" }, { status: 400 });
  const isPdf = file.type === "application/pdf" || file.name.toLowerCase().endsWith(".pdf");
  if (!isPdf) return NextResponse.json({ error: "PDFだけ上げられます（A4推奨）" }, { status: 400 });
  if (file.size > MAX) return NextResponse.json({ error: "20MBを超えています" }, { status: 400 });
  const buf = Buffer.from(await file.arrayBuffer());
  if (buf.subarray(0, 5).toString() !== "%PDF-") return NextResponse.json({ error: "PDFとして読めません" }, { status: 400 });
  const url = await saveDmKitFile(file.name, buf, "pdf");
  return NextResponse.json({ url, name: file.name, size: file.size });
}
