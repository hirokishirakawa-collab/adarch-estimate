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

const STORAGE_ROOT = process.env.STORAGE_PATH || "/data/storage";

// バケット名
const BUCKET = "billing-pdfs";
const GROUP_SYNC_BUCKET = "group-sync-files";
const MEDIA_BUCKET = "media-files";
const CARD_IMAGE_BUCKET = "card-images";
const VIDEO_REVIEW_BUCKET = "video-reviews";

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

// ==============================================================
// 映像チェッカー（Video Review）
// ==============================================================

/**
 * 動画ファイルをアップロードする。戻り値はストレージ内パス。
 */
export async function uploadReviewVideo(
  file: File,
  prefix: string = ""
): Promise<string | null> {
  try {
    const ext = file.name.split(".").pop() ?? "mp4";
    const fileName = `${prefix}${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;
    const dir = path.join(STORAGE_ROOT, VIDEO_REVIEW_BUCKET);
    ensureDir(dir);

    // prefix にサブディレクトリが含まれる場合
    if (prefix) {
      const subDir = path.join(dir, path.dirname(prefix));
      ensureDir(subDir);
    }

    const buf = Buffer.from(await file.arrayBuffer());
    writeFileSync(path.join(dir, fileName), buf);
    return fileName;
  } catch (e) {
    console.error("[storage] Video upload error:", e);
    return null;
  }
}

/**
 * 動画ファイルをバッファとして読み取る（サーバーサイド解析用）。
 */
export async function downloadReviewVideo(
  filePath: string
): Promise<Buffer | null> {
  if (!filePath) return null;
  const fullPath = path.join(STORAGE_ROOT, VIDEO_REVIEW_BUCKET, filePath);
  if (!existsSync(fullPath)) return null;
  try {
    return readFileSync(fullPath);
  } catch {
    return null;
  }
}

/**
 * 動画ファイルの配信用 URL を返す。
 */
export async function getReviewVideoSignedUrl(
  filePath: string
): Promise<string | null> {
  if (!filePath) return null;
  return `/api/storage/${VIDEO_REVIEW_BUCKET}/${filePath}`;
}

/**
 * フレーム画像をアップロード（解析結果保存用）。
 */
export async function uploadReviewFrame(
  buffer: Buffer,
  fileName: string
): Promise<string | null> {
  try {
    const dir = path.join(STORAGE_ROOT, VIDEO_REVIEW_BUCKET, "frames");
    ensureDir(dir);

    // fileName にサブディレクトリが含まれる場合
    const subDir = path.dirname(fileName);
    if (subDir !== ".") {
      ensureDir(path.join(dir, subDir));
    }

    writeFileSync(path.join(dir, fileName), buffer);
    return `frames/${fileName}`;
  } catch {
    return null;
  }
}
