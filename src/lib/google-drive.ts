/**
 * Google Drive ファイルストレージユーティリティ（映像チェッカー用）
 *
 * サービスアカウント + ドメイン全体委任でDrive APIにアクセス。
 * 環境変数:
 *   GOOGLE_SERVICE_ACCOUNT_JSON  サービスアカウントのJSONキー
 *   VIDEO_REVIEW_DRIVE_FOLDER_ID       保存先フォルダID（共有ドライブ or マイドライブ）
 *   ADMIN_EMAILS                 委任ユーザーのメール（カンマ区切り、最初の1つを使用）
 */

import { google } from "googleapis";
import { Readable } from "stream";

function getDriveClient() {
  const saJson = process.env.GOOGLE_SERVICE_ACCOUNT_JSON;
  if (!saJson) throw new Error("GOOGLE_SERVICE_ACCOUNT_JSON が未設定");

  const credentials = JSON.parse(saJson);
  // ADMIN_EMAILS の最初のメールで委任
  const delegateEmail = (process.env.ADMIN_EMAILS ?? "").split(",")[0]?.trim();
  if (!delegateEmail) throw new Error("ADMIN_EMAILS が未設定");

  const auth = new google.auth.JWT({
    email: credentials.client_email,
    key: credentials.private_key,
    scopes: ["https://www.googleapis.com/auth/drive"],
    subject: delegateEmail,
  });

  return google.drive({ version: "v3", auth });
}

function getFolderId(): string {
  const id = process.env.VIDEO_REVIEW_DRIVE_FOLDER_ID;
  if (!id) throw new Error("VIDEO_REVIEW_DRIVE_FOLDER_ID が未設定");
  return id;
}

/**
 * ファイルを Google Drive にアップロード。
 * 戻り値: Drive のファイルID
 */
export async function uploadToDrive(
  buffer: Buffer,
  fileName: string,
  mimeType: string = "video/mp4",
  subfolder?: string
): Promise<string> {
  const drive = getDriveClient();
  const parentId = getFolderId();

  // サブフォルダが指定されている場合は作成 or 取得
  let targetFolderId = parentId;
  if (subfolder) {
    targetFolderId = await getOrCreateFolder(drive, subfolder, parentId);
  }

  const res = await drive.files.create({
    requestBody: {
      name: fileName,
      parents: [targetFolderId],
    },
    media: {
      mimeType,
      body: Readable.from(buffer),
    },
    fields: "id",
  });

  const fileId = res.data.id;
  if (!fileId) throw new Error("Drive upload failed: no file ID returned");

  return fileId;
}

/**
 * Google Drive からファイルをダウンロード（Buffer として返す）
 */
export async function downloadFromDrive(fileId: string): Promise<Buffer> {
  const drive = getDriveClient();

  const res = await drive.files.get(
    { fileId, alt: "media" },
    { responseType: "arraybuffer" }
  );

  return Buffer.from(res.data as ArrayBuffer);
}

/**
 * Google Drive ファイルのストリーミングURL（webContentLink）を取得。
 * 動画再生用。
 */
export async function getDriveStreamUrl(fileId: string): Promise<string> {
  const drive = getDriveClient();

  // ファイルを「リンクを知っている全員」に閲覧権限付与
  try {
    await drive.permissions.create({
      fileId,
      requestBody: {
        role: "reader",
        type: "anyone",
      },
    });
  } catch {
    // 既に権限がある場合は無視
  }

  const res = await drive.files.get({
    fileId,
    fields: "webContentLink",
  });

  // webContentLink は直接ダウンロードURL
  // ストリーミング再生用にconfirm=1を付与
  const url = res.data.webContentLink;
  if (!url) throw new Error("webContentLink not available");

  return url;
}

/**
 * フレーム画像をDriveにアップロード
 */
export async function uploadFrameToDrive(
  buffer: Buffer,
  fileName: string,
  reviewId: string
): Promise<string> {
  return uploadToDrive(buffer, fileName, "image/png", `frames/${reviewId}`);
}

/**
 * フレーム画像のURLを取得
 */
export async function getFrameUrl(fileId: string): Promise<string> {
  return getDriveStreamUrl(fileId);
}

/**
 * サブフォルダを取得 or 作成
 */
async function getOrCreateFolder(
  drive: ReturnType<typeof google.drive>,
  name: string,
  parentId: string
): Promise<string> {
  // 既存フォルダを検索
  const query = `name='${name}' and '${parentId}' in parents and mimeType='application/vnd.google-apps.folder' and trashed=false`;
  const list = await drive.files.list({
    q: query,
    fields: "files(id)",
    spaces: "drive",
  });

  if (list.data.files && list.data.files.length > 0) {
    return list.data.files[0].id!;
  }

  // 作成
  const res = await drive.files.create({
    requestBody: {
      name,
      mimeType: "application/vnd.google-apps.folder",
      parents: [parentId],
    },
    fields: "id",
  });

  return res.data.id!;
}

/**
 * ファイルを削除
 */
export async function deleteFromDrive(fileId: string): Promise<void> {
  try {
    const drive = getDriveClient();
    await drive.files.delete({ fileId });
  } catch {
    // 削除失敗は致命的ではない
  }
}
