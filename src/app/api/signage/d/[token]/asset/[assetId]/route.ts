// GET /api/signage/d/[token]/asset/[assetId] — 素材の配信（端末トークン検証・Range対応）
//   端末は全文を取得して Cache API に保存する。<video> の直接再生（Range）にも応える。
import { NextRequest, NextResponse } from "next/server";
import { createReadStream, statSync, existsSync } from "fs";
import { Readable } from "stream";
import { db } from "@/lib/db";
import { findDeviceByToken } from "@/lib/signage/manifest";
import { signageAssetPath } from "@/lib/storage";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest, ctx: { params: Promise<{ token: string; assetId: string }> }) {
  const { token, assetId } = await ctx.params;
  const device = await findDeviceByToken(token);
  if (!device || !device.isActive) return new NextResponse("Unauthorized", { status: 401 });

  const asset = await db.signageAsset.findUnique({ where: { id: assetId } });
  if (!asset || asset.trashedAt) return new NextResponse("Not found", { status: 404 });
  // 端末と素材は同じ拠点（本部素材 branchId=null は全端末に配信可）
  if (asset.branchId && asset.branchId !== device.branchId) return new NextResponse("Forbidden", { status: 403 });

  const filePath = signageAssetPath(asset.storedName);
  if (!existsSync(filePath)) return new NextResponse("File missing", { status: 404 });
  const total = statSync(filePath).size;

  const common: Record<string, string> = {
    "Content-Type": asset.mimeType,
    "Accept-Ranges": "bytes",
    "Cache-Control": "private, max-age=86400, immutable",
    ETag: `"${asset.checksum}"`,
  };

  if (req.headers.get("if-none-match") === `"${asset.checksum}"`) {
    return new NextResponse(null, { status: 304, headers: common });
  }

  const range = req.headers.get("range");
  let start = 0;
  let end = total - 1;
  let status = 200;
  if (range) {
    const m = /^bytes=(\d*)-(\d*)$/.exec(range);
    if (m) {
      if (m[1]) start = parseInt(m[1], 10);
      if (m[2]) end = parseInt(m[2], 10);
      if (!m[1] && m[2]) { start = Math.max(0, total - parseInt(m[2], 10)); end = total - 1; }
      if (start > end || start >= total) {
        return new NextResponse(null, { status: 416, headers: { ...common, "Content-Range": `bytes */${total}` } });
      }
      end = Math.min(end, total - 1);
      status = 206;
      common["Content-Range"] = `bytes ${start}-${end}/${total}`;
    }
  }
  common["Content-Length"] = String(end - start + 1);

  const nodeStream = createReadStream(filePath, { start, end });
  const webStream = Readable.toWeb(nodeStream) as unknown as ReadableStream;
  return new NextResponse(webStream, { status, headers: common });
}
