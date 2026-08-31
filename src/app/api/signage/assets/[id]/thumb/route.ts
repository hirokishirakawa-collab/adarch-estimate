// GET /api/signage/assets/[id]/thumb — CMS用サムネ（ログイン必須）
import { NextRequest, NextResponse } from "next/server";
import { readFileSync, existsSync } from "fs";
import { db } from "@/lib/db";
import { requireSignageUser } from "../../../_guard";
import { signageAssetPath } from "@/lib/storage";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { error } = await requireSignageUser();
  if (error) return error;
  const { id } = await ctx.params;
  const a = await db.signageAsset.findUnique({ where: { id }, select: { thumbName: true } });
  if (!a?.thumbName) return new NextResponse("Not found", { status: 404 });
  const p = signageAssetPath(a.thumbName);
  if (!existsSync(p)) return new NextResponse("Not found", { status: 404 });
  return new NextResponse(new Uint8Array(readFileSync(p)), { headers: { "Content-Type": "image/jpeg", "Cache-Control": "private, max-age=3600" } });
}
