/**
 * Railway Volume ベースのファイルストレージユーティリティ。
 *
 * Railway Volume を /data にマウントして使用。
 * ファイルは /data/storage/{bucket}/{filename} に保存される。
 * 配信は /api/storage/[...path] API route 経由。
 *
 * 環境変数:
 *   STORAGE_PATH  ストレージルート（デフォルト: /data/storage）
 */

import { writeFileSync, readFileSync, existsSync, mkdirSync } from "fs";
import path from "path";

const STORAGE_ROOT = (() => {
  const preferred = process.env.STORAGE_PATH || "/data/storage";
  try {
    const { mkdirSync, existsSync, accessSync, constants } = require("fs");
    if (!existsSync(preferred)) mkdirSync(preferred, { recursive: true });
    accessSync(preferred, constants.W_OK);
    return preferred;
  } catch {
    const fallback = "/tmp/storage";
    try {
      const { mkdirSync } = require("fs");
      mkdirSync(fallback, { recursive: true });
    } catch {}
    console.warn(`[storage] ${preferred} is not writable, falling back to ${fallback}`);
    return fallback;
  }
})();

// バケット名
const BUCKET = "billing-pdfs";
const GROUP_SYNC_BUCKET = "group-sync-files";
const MEDIA_BUCKET = "media-files";
const CARD_IMAGE_BUCKET = "card-images";
const VIDEO_REVIEW_BUCKET = "video-reviews";
const CREATOR_AVATAR_BUCKET = "creator-avatars";

// ---------------------------------------------------------------
// 共通ユーティリティ
// ---------------------------------------------------------------

function ensureDir(dir: string) {
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
}

function generateFileName(originalName: string, fallbackExt: string = "bin"): string {
  const ext = originalName.split(".").pop() ?? fallbackExt;
  return `${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;
}

/**
 * ファイルをローカルストレージに保存し、配信用 URL パスを返す。
 */
async function saveFile(
  bucket: string,
  fileName: string,
  data: Buffer | Uint8Array
): Promise<string> {
  const dir = path.join(STORAGE_ROOT, bucket);
  ensureDir(dir);
  const filePath = path.join(dir, fileName);
  writeFileSync(filePath, data);
  return `/api/storage/${bucket}/${fileName}`;
}

/**
 * ファイルをローカルストレージから読み取る。
 */
export function readStorageFile(bucket: string, fileName: string): Buffer | null {
  const filePath = path.join(STORAGE_ROOT, bucket, fileName);
  if (!existsSync(filePath)) return null;
  return readFileSync(filePath);
}

/**
 * ファイルの絶対パスを返す。
 */
export function getStorageFilePath(bucket: string, fileName: string): string {
  return path.join(STORAGE_ROOT, bucket, fileName);
}

// ---------------------------------------------------------------
// 請求書 PDF（Public）
// ---------------------------------------------------------------
export async function uploadBillingFile(
  file: File
): Promise<string | null> {
  try {
    const fileName = generateFileName(file.name, "pdf");
    const buf = Buffer.from(await file.arrayBuffer());
    return await saveFile(BUCKET, fileName, buf);
  } catch (e) {
    console.error("[storage] Upload error:", e);
    return null;
  }
}

// ---------------------------------------------------------------
// グループ同期ファイル（Public）
// ---------------------------------------------------------------
export async function uploadGroupSyncFile(
  file: File
): Promise<string | null> {
  try {
    const fileName = generateFileName(file.name);
    const buf = Buffer.from(await file.arrayBuffer());
    return await saveFile(GROUP_SYNC_BUCKET, fileName, buf);
  } catch (e) {
    console.error("[storage] Upload error:", e);
    return null;
  }
}

// ---------------------------------------------------------------
// 媒体ファイル（Public）
// ---------------------------------------------------------------
export async function uploadMediaFile(
  file: File
): Promise<string | null> {
  try {
    const fileName = generateFileName(file.name);
    const buf = Buffer.from(await file.arrayBuffer());
    return await saveFile(MEDIA_BUCKET, fileName, buf);
  } catch (e) {
    console.error("[storage] Upload error:", e);
    return null;
  }
}

// ---------------------------------------------------------------
// 名刺画像（Private — 認証必須で配信）
// ---------------------------------------------------------------
export async function uploadBusinessCardImage(
  file: File
): Promise<string | null> {
  try {
    const fileName = generateFileName(file.name, "jpg");
    const buf = Buffer.from(await file.arrayBuffer());
    const dir = path.join(STORAGE_ROOT, CARD_IMAGE_BUCKET);
    ensureDir(dir);
    writeFileSync(path.join(dir, fileName), buf);
    return fileName; // パスのみ返す（既存互換）
  } catch (e) {
    console.error("[storage] Upload error:", e);
    return null;
  }
}

/**
 * 名刺画像の配信用 URL を返す。
 * Supabase の署名付き URL の代わりに API route を使用。
 */
export async function getCardImageSignedUrl(
  filePath: string
): Promise<string | null> {
  if (!filePath) return null;
  // 旧 Supabase URL が DB に残っている場合はそのまま返す
  if (filePath.startsWith("http")) return filePath;
  return `/api/storage/${CARD_IMAGE_BUCKET}/${filePath}`;
}

// ---------------------------------------------------------------
// クリエイターアバター（Public — 自動リサイズ）
// ---------------------------------------------------------------
export async function uploadCreatorAvatar(
  file: File
): Promise<string | null> {
  try {
    const buf = Buffer.from(await file.arrayBuffer());
    let outputBuf: Buffer | Uint8Array = buf;
    let ext = file.name.split(".").pop()?.toLowerCase() ?? "jpg";

    try {
      const sharp = (await import("sharp")).default;
      outputBuf = await sharp(buf)
        .resize(400, 400, { fit: "cover", position: "centre" })
        .jpeg({ quality: 85 })
        .toBuffer();
      ext = "jpg";
    } catch (sharpErr) {
      console.warn("[storage] sharp unavailable, saving original:", sharpErr);
    }

    const fileName = `${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;
    return await saveFile(CREATOR_AVATAR_BUCKET, fileName, outputBuf);
  } catch (e) {
    console.error("[storage] Creator avatar upload error:", e);
    return null;
  }
}

// ==============================================================
// 映像チェッカー（Video Review）— Mux ストレージ
// ==============================================================

import { getStreamUrl, getThumbnailUrl } from "@/lib/mux";

/**
 * Mux Playback ID からストリーミング URL を取得。
 * DB には playbackId を保存する。
 */
export async function getReviewVideoSignedUrl(
  playbackId: string
): Promise<string | null> {
  if (!playbackId) return null;
  // 旧パスのフォールバック
  if (playbackId.includes("/")) {
    return `/api/storage/${VIDEO_REVIEW_BUCKET}/${playbackId}`;
  }
  return getStreamUrl(playbackId);
}

/**
 * サムネイル URL を取得。
 */
export function getReviewThumbnailUrl(
  playbackId: string,
  time?: number
): string | null {
  if (!playbackId) return null;
  return getThumbnailUrl(playbackId, { time, width: 640 });
}

/**
 * 動画をMux経由でダウンロード（サーバーサイド解析用）。
 * Mux の mp4 static rendition を使用。
 */
export async function downloadReviewVideo(
  playbackId: string
): Promise<Buffer | null> {
  if (!playbackId) return null;
  try {
    // 複数の画質を試行（low → medium → high）
    const qualities = ["low", "medium", "high"];
    for (const q of qualities) {
      const url = `https://stream.mux.com/${playbackId}/${q}.mp4`;
      const res = await fetch(url, { redirect: "follow" });
      if (res.ok) {
        return Buffer.from(await res.arrayBuffer());
      }
    }

    // capped-1080p.mp4 も試行
    const fallback = await fetch(
      `https://stream.mux.com/${playbackId}/capped-1080p.mp4`,
      { redirect: "follow" }
    );
    if (fallback.ok) {
      return Buffer.from(await fallback.arrayBuffer());
    }

    console.error("[storage] All Mux MP4 download attempts failed for:", playbackId);
    return null;
  } catch (e) {
    console.error("[storage] Mux download error:", e);
    return null;
  }
}

/**
 * フレーム画像をローカルストレージに保存（解析結果用）。
 * フレームは小さいのでRailway Volume で十分。
 */
export async function uploadReviewFrame(
  buffer: Buffer,
  fileName: string,
  reviewId?: string
): Promise<string | null> {
  try {
    const dir = path.join(STORAGE_ROOT, VIDEO_REVIEW_BUCKET, "frames");
    ensureDir(dir);
    const subDir = path.dirname(fileName);
    if (subDir !== ".") ensureDir(path.join(dir, subDir));
    writeFileSync(path.join(dir, fileName), buffer);
    return `frames/${fileName}`;
  } catch {
    return null;
  }
}

/**
 * フレーム画像の URL を取得。
 */
export async function getReviewFrameUrl(
  filePath: string
): Promise<string | null> {
  if (!filePath) return null;
  return `/api/storage/${VIDEO_REVIEW_BUCKET}/${filePath}`;
}
