import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";

export const runtime = "nodejs";

/**
 * GET /api/clients/photo/[id]
 * 取引先マップの会社写真（DBに保存した JPEG）を返す。ログイン必須。
 */
export async function GET(_req: Request, props: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await props.params;
  const row = await db.customer.findUnique({ where: { id }, select: { photoData: true } });
  if (!row?.photoData) return new NextResponse(null, { status: 404 });

  return new NextResponse(new Uint8Array(row.photoData), {
    headers: {
      "Content-Type": "image/jpeg",
      "Cache-Control": "private, max-age=86400",
    },
  });
}
