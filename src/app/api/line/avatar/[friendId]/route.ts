// GET /api/line/avatar/[friendId] — LINEプロフィール画像を同一オリジンで中継（要ログイン・操作権限）
// 外部CDNの画像がブラウザ側で弾かれるケースがあったため、サーバーで取得して返す
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getSessionInfo } from "@/lib/session";
import { manageableWhere } from "@/lib/line/access";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const ALLOWED_IMAGE_TYPES = new Set(["image/jpeg", "image/png", "image/gif", "image/webp"]);
const MAX_BYTES = 5 * 1024 * 1024;

function isLineCdn(url: string): boolean {
  try {
    const u = new URL(url);
    return u.protocol === "https:" && (u.hostname === "line-scdn.net" || u.hostname.endsWith(".line-scdn.net"));
  } catch {
    return false;
  }
}

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
  // 取得先は LINE の CDN のみ（SSRF・別ホストへの転送を防ぐ）。画像以外のContent-Typeは通さない
  if (friend.pictureUrl && isLineCdn(friend.pictureUrl)) {
    try {
      const res = await fetch(friend.pictureUrl, { headers: { "User-Agent": "Mozilla/5.0" }, cache: "no-store", redirect: "manual" });
      const ct = (res.headers.get("content-type") ?? "").toLowerCase().split(";")[0].trim();
      if (res.ok && ALLOWED_IMAGE_TYPES.has(ct)) {
        const buf = await res.arrayBuffer();
        if (buf.byteLength <= MAX_BYTES) {
          return new NextResponse(buf, {
            headers: {
              "Content-Type": ct,
              "Cache-Control": "private, max-age=3600",
              "X-Content-Type-Options": "nosniff",
              "Content-Disposition": 'inline; filename="avatar"',
              "Content-Security-Policy": "default-src 'none'; sandbox",
            },
          });
        }
      }
    } catch {
      /* fall through */
    }
  }
  return new NextResponse(FALLBACK_SVG, {
    headers: {
      "Content-Type": "image/svg+xml",
      "Cache-Control": "private, max-age=600",
      "X-Content-Type-Options": "nosniff",
      "Content-Security-Policy": "default-src 'none'; sandbox",
    },
  });
}
