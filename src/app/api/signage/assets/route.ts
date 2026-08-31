// GET/POST /api/signage/assets — 素材一覧／アップロード（jpg・png・mp4、動画は8秒以上・1GBまで）
import { NextRequest, NextResponse } from "next/server";
import { createHash } from "crypto";
import { writeFileSync, unlinkSync, mkdirSync, existsSync } from "fs";
import path from "path";
import sharp from "sharp";
import { db } from "@/lib/db";
import { requireSignageUser, scope, branchIdForCreate } from "../_guard";
import { saveSignageAsset, signageAssetPath } from "@/lib/storage";
import { getVideoMeta, extractSingleFrame } from "@/lib/video-analysis/ffmpeg";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

const MAX_BYTES = 1024 * 1024 * 1024;
const MIN_VIDEO_SEC = 8;
const ALLOWED: Record<string, string> = { "image/jpeg": "jpg", "image/png": "png", "video/mp4": "mp4" };

export async function GET(req: NextRequest) {
  const { error, info } = await requireSignageUser();
  if (error) return error;
  const trash = req.nextUrl.searchParams.get("trash") === "1";
  const q = (req.nextUrl.searchParams.get("q") ?? "").trim();
  const rows = await db.signageAsset.findMany({
    where: {
      // 自拠点の素材＋本部素材(branchId=null)
      OR: info.role === "ADMIN" ? [{}] : [scope(info), { branchId: null }],
      trashedAt: trash ? { not: null } : null,
      ...(q ? { originalName: { contains: q, mode: "insensitive" } } : {}),
    },
    orderBy: { createdAt: "desc" },
    include: { branch: { select: { id: true, name: true } }, _count: { select: { items: true } } },
  });
  return NextResponse.json(rows);
}

export async function POST(req: NextRequest) {
  const { error, info } = await requireSignageUser();
  if (error) return error;
  const form = await req.formData().catch(() => null);
  const file = form?.get("file");
  if (!(file instanceof File)) return NextResponse.json({ error: "ファイルがありません" }, { status: 400 });
  const ext = ALLOWED[file.type];
  if (!ext) return NextResponse.json({ error: "対応形式は jpg / png / mp4 です" }, { status: 400 });
  if (file.size > MAX_BYTES) return NextResponse.json({ error: "1GBを超えています" }, { status: 400 });

  const buf = Buffer.from(await file.arrayBuffer());
  const checksum = createHash("sha256").update(buf).digest("hex");
  const storedName = await saveSignageAsset(file.name, buf, ext);
  const filePath = signageAssetPath(storedName);

  let width: number | null = null, height: number | null = null, durationSec: number | null = null;
  let thumbName: string | null = null;
  try {
    const thumbFile = storedName.replace(/\.[^.]+$/, "") + "_thumb.jpg";
    const thumbPath = signageAssetPath(thumbFile);
    if (ext === "mp4") {
      const meta = await getVideoMeta(filePath);
      width = meta.width; height = meta.height; durationSec = meta.duration;
      if (durationSec < MIN_VIDEO_SEC) { unlinkSync(filePath); return NextResponse.json({ error: `動画は${MIN_VIDEO_SEC}秒以上にしてください（${durationSec.toFixed(1)}秒）` }, { status: 400 }); }
      const tmp = path.join(path.dirname(thumbPath), "tmp_" + thumbFile);
      await extractSingleFrame(filePath, Math.min(1, durationSec / 2), tmp);
      await sharp(tmp).resize(480, 270, { fit: "inside" }).jpeg({ quality: 80 }).toFile(thumbPath);
      unlinkSync(tmp);
    } else {
      const meta = await sharp(buf).metadata();
      width = meta.width ?? null; height = meta.height ?? null;
      await sharp(buf).resize(480, 270, { fit: "inside" }).jpeg({ quality: 80 }).toFile(thumbPath);
    }
    thumbName = thumbFile;
  } catch (e) {
    console.warn("[signage] thumb/meta failed:", e instanceof Error ? e.message : e);
  }

  const row = await db.signageAsset.create({
    data: {
      originalName: file.name,
      storedName,
      mimeType: file.type,
      sizeBytes: file.size,
      durationSec,
      width,
      height,
      thumbName,
      checksum,
      branchId: branchIdForCreate(info, form?.get("branchId")?.toString() || null),
      uploadedById: info.userId,
    },
  });
  return NextResponse.json(row);
}

// 未使用の import 抑止（mkdirSync/existsSync/writeFileSync は extractSingleFrame 側で担保）
void mkdirSync; void existsSync; void writeFileSync;
