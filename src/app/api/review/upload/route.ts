import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { createDirectUpload, getUploadAsset } from "@/lib/mux";

/**
 * POST: Mux Direct Upload URLを発行
 */
export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { uploadId, uploadUrl } = await createDirectUpload();
    return NextResponse.json({ uploadId, uploadUrl });
  } catch (e) {
    console.error("[upload] Mux upload create error:", e);
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Upload failed" },
      { status: 500 }
    );
  }
}

/**
 * GET: アップロードステータス確認（assetId, playbackId取得）
 */
export async function GET(req: Request) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const uploadId = searchParams.get("uploadId");
  if (!uploadId) {
    return NextResponse.json({ error: "uploadId is required" }, { status: 400 });
  }

  try {
    const result = await getUploadAsset(uploadId);
    return NextResponse.json(result);
  } catch (e) {
    console.error("[upload] Mux status error:", e);
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Status check failed" },
      { status: 500 }
    );
  }
}
