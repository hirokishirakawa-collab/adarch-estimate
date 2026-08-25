// GET /api/line/avatar/[friendId] — LINEプロフィール画像を同一オリジンで中継（要ログイン・操作権限）
// 外部CDNの画像がブラウザ側で弾かれるケースがあったため、サーバーで取得して返す
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getSessionInfo } from "@/lib/session";
import { manageableWhere } from "@/lib/line/access";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const FALLBACK_SVG =
  '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 36 36"><rect width="36" height="36" rx="18" fill="#e4e4e7"/><circle cx="18" cy="14" r="6" fill="#a1a1aa"/><path d="M6 32c2-7 8-10 12-10s10 3 12 10z" fill="#a1a1aa"/></svg>';

export async function GET(_req: NextRequest, ctx: { params: Promise<{ friendId: string }> }) {
  const info = await getSessionInfo();
  if (!info) return new NextResponse("Unauthorized", { status: 401 });
  const { friendId } = await ctx.params;
  const friend = await db.lineFriend.findFirst({
    where: { id: friendId, account: manageableWhere(info) },
    select: { pictureUrl: true },
  });
  if (!friend) return new NextResponse("Not found", { status: 404 });
  if (friend.pictureUrl) {
    try {
      const res = await fetch(friend.pictureUrl, { headers: { "User-Agent": "Mozilla/5.0" }, cache: "no-store" });
      if (res.ok) {
        const buf = await res.arrayBuffer();
        return new NextResponse(buf, {
          headers: {
            "Content-Type": res.headers.get("content-type") ?? "image/jpeg",
            "Cache-Control": "private, max-age=3600",
          },
        });
      }
    } catch {
      /* fall through */
    }
  }
  return new NextResponse(FALLBACK_SVG, { headers: { "Content-Type": "image/svg+xml", "Cache-Control": "private, max-age=600" } });
}
