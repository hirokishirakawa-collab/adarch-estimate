import { NextResponse } from "next/server";
import { readFileSync, existsSync } from "fs";
import path from "path";
import { auth } from "@/lib/auth";

const STORAGE_ROOT = process.env.STORAGE_PATH || "/data/storage";

// Private バケット（認証必須）
const PRIVATE_BUCKETS = new Set(["card-images", "video-reviews"]);

// MIME タイプ推定
const MIME_MAP: Record<string, string> = {
  pdf: "application/pdf",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  png: "image/png",
  gif: "image/gif",
  webp: "image/webp",
  mp4: "video/mp4",
  mov: "video/quicktime",
  webm: "video/webm",
  avi: "video/x-msvideo",
  doc: "application/msword",
  docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  xls: "application/vnd.ms-excel",
  xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  ppt: "application/vnd.ms-powerpoint",
  pptx: "application/vnd.openxmlformats-officedocument.presentationml.presentation",
};

function getMimeType(filePath: string): string {
  const ext = filePath.split(".").pop()?.toLowerCase() ?? "";
  return MIME_MAP[ext] || "application/octet-stream";
}

export async function GET(
  _req: Request,
  props: { params: Promise<{ path: string[] }> }
) {
  const { path: segments } = await props.params;

  if (!segments || segments.length < 2) {
    return NextResponse.json({ error: "Invalid path" }, { status: 400 });
  }

  const bucket = segments[0];
  const fileName = segments.slice(1).join("/");

  // Private バケットは認証必須
  if (PRIVATE_BUCKETS.has(bucket)) {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
  }

  // パストラバーサル防止
  const resolved = path.resolve(STORAGE_ROOT, bucket, fileName);
  if (!resolved.startsWith(path.resolve(STORAGE_ROOT))) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  if (!existsSync(resolved)) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  try {
    const data = readFileSync(resolved);
    const mime = getMimeType(fileName);

    const headers: Record<string, string> = {
      "Content-Type": mime,
      "Content-Length": String(data.length),
      "Cache-Control": "private, max-age=3600",
    };

    // 動画はRange requestに対応
    if (mime.startsWith("video/")) {
      headers["Accept-Ranges"] = "bytes";
    }

    return new NextResponse(data, { status: 200, headers });
  } catch (e) {
    console.error("[storage-api] Read error:", e);
    return NextResponse.json({ error: "Read error" }, { status: 500 });
  }
}
