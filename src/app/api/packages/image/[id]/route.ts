import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

export const runtime = "nodejs";

// GET /api/packages/image/[id] — サムネイル本体（公開ページからも読むので認証なし・proxy の matcher で除外済み）
export async function GET(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  if (!/^[a-z0-9]{10,40}$/i.test(id)) return new NextResponse("Not Found", { status: 404 });
  const row = await db.salesPackageImage.findUnique({ where: { id }, select: { data: true, type: true } });
  if (!row) return new NextResponse("Not Found", { status: 404 });
  return new NextResponse(new Uint8Array(row.data), {
    headers: {
      "Content-Type": row.type || "image/jpeg",
      "Content-Length": String(row.data.byteLength),
      // id は作り直すたびに変わるので長くキャッシュしてよい
      "Cache-Control": "public, max-age=31536000, immutable",
    },
  });
}
