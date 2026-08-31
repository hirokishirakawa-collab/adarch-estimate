// GET /api/tver-flyer/[id]/hero — チラシ上部ビジュアル（本部: いつでも／代表: 納品済みのみ）
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getSessionInfo, getBranchFilter } from "@/lib/session";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const info = await getSessionInfo();
  if (!info || info.role === "USER") return new NextResponse("Unauthorized", { status: 401 });
  const { id } = await ctx.params;
  const r = await db.tverFlyerRequest.findFirst({
    where: { id, ...getBranchFilter(info) },
    select: { status: true, heroImage: true, heroImageType: true },
  });
  if (!r?.heroImage || !r.heroImageType) return new NextResponse("Not found", { status: 404 });
  if (info.role !== "ADMIN" && r.status !== "DELIVERED") return new NextResponse("Forbidden", { status: 403 });
  return new NextResponse(new Uint8Array(r.heroImage), {
    headers: { "Content-Type": r.heroImageType, "Cache-Control": "private, no-store" },
  });
}
