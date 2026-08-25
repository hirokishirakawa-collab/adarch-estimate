// GET /api/line/richmenu-image/[id] — OSに保存したリッチメニュー画像（要ログイン・操作権限）
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getSessionInfo } from "@/lib/session";
import { manageableWhere } from "@/lib/line/access";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const info = await getSessionInfo();
  if (!info) return new NextResponse("Unauthorized", { status: 401 });
  const { id } = await ctx.params;
  const menu = await db.lineRichMenu.findFirst({
    where: { id, account: manageableWhere(info) },
    select: { imageData: true, imageType: true },
  });
  if (!menu?.imageData || !menu.imageType) return new NextResponse("Not found", { status: 404 });
  return new NextResponse(new Uint8Array(menu.imageData), {
    headers: { "Content-Type": menu.imageType, "Cache-Control": "private, max-age=60" },
  });
}
