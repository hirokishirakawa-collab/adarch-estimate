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
// 映像チェッカー（Video Review）— Google Drive ストレージ
// ==============================================================

import {
  uploadToDrive,
  downloadFromDrive,
  getDriveStreamUrl,
  uploadFrameToDrive,
  getFrameUrl,
} from "@/lib/google-drive";

/**
 * 動画ファイルを Google Drive にアップロードする。
 * 戻り値: DriveファイルID
 */
export async function uploadReviewVideo(
  buffer: Buffer,
  fileName: string,
  subfolder: string = ""
): Promise<string | null> {
  try {
    const fileId = await uploadToDrive(
      buffer,
      fileName,
      "video/mp4",
      subfolder || "videos"
    );
    return fileId;
  } catch (e) {
    console.error("[storage] Drive video upload error:", e);
    return null;
  }
}

/**
 * Google Drive から動画をダウンロード（サーバーサイド解析用）。
 */
export async function downloadReviewVideo(
  fileId: string
): Promise<Buffer | null> {
  if (!fileId) return null;
  try {
    return await downloadFromDrive(fileId);
  } catch (e) {
    console.error("[storage] Drive download error:", e);
    return null;
  }
}

/**
 * 動画の再生用 URL を取得。
 */
export async function getReviewVideoSignedUrl(
  fileId: string
): Promise<string | null> {
  if (!fileId) return null;
  // 旧ローカルパス（Railway Volume）が残っている場合のフォールバック
  if (!fileId.startsWith("http") && fileId.includes("/")) {
    return `/api/storage/${VIDEO_REVIEW_BUCKET}/${fileId}`;
  }
  try {
    return await getDriveStreamUrl(fileId);
  } catch (e) {
    console.error("[storage] Drive stream URL error:", e);
    return null;
  }
}

/**
 * フレーム画像を Google Drive にアップロード（解析結果保存用）。
 * 戻り値: DriveファイルID
 */
export async function uploadReviewFrame(
  buffer: Buffer,
  fileName: string,
  reviewId?: string
): Promise<string | null> {
  try {
    return await uploadFrameToDrive(buffer, fileName, reviewId ?? "misc");
  } catch {
    return null;
  }
}

/**
 * フレーム画像の URL を取得。
 */
export async function getReviewFrameUrl(
  fileId: string
): Promise<string | null> {
  if (!fileId) return null;
  // 旧ローカルパスのフォールバック
  if (fileId.startsWith("frames/")) {
    return `/api/storage/${VIDEO_REVIEW_BUCKET}/${fileId}`;
  }
  try {
    return await getFrameUrl(fileId);
  } catch {
    return null;
  }
}
