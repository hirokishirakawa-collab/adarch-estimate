/**
 * Mux Video ユーティリティ
 *
 * 環境変数:
 *   MUX_TOKEN_ID      Mux API Access Token ID
 *   MUX_TOKEN_SECRET  Mux API Access Token Secret
 */

import Mux from "@mux/mux-node";

let muxClient: Mux | null = null;

function getMux(): Mux {
  if (muxClient) return muxClient;

  const tokenId = process.env.MUX_TOKEN_ID;
  const tokenSecret = process.env.MUX_TOKEN_SECRET;
  if (!tokenId || !tokenSecret) {
    throw new Error("MUX_TOKEN_ID / MUX_TOKEN_SECRET が未設定です");
  }

  muxClient = new Mux({ tokenId, tokenSecret });
  return muxClient;
}

/**
 * 動画をアップロードしてアセットを作成。
 * 戻り値: { assetId, playbackId, uploadUrl }
 *
 * 手順:
 *   1. Direct Upload URL を取得
 *   2. クライアントからそのURLにPUTでアップロード
 *   3. Mux が自動的にエンコード・HLS変換
 */
export async function createDirectUpload(): Promise<{
  uploadId: string;
  uploadUrl: string;
}> {
  const mux = getMux();

  const upload = await mux.video.uploads.create({
    new_asset_settings: {
      playback_policy: ["public"],
      encoding_tier: "baseline",
    },
    cors_origin: "*",
  });

  return {
    uploadId: upload.id,
    uploadUrl: upload.url,
  };
}

/**
 * Direct Upload のステータスを確認し、アセット情報を返す。
 */
export async function getUploadAsset(uploadId: string): Promise<{
  assetId: string | null;
  playbackId: string | null;
  status: string;
}> {
  const mux = getMux();
  const upload = await mux.video.uploads.retrieve(uploadId);

  const assetId = upload.asset_id ?? null;
  let playbackId: string | null = null;
  let status: string = upload.status ?? "waiting";

  if (assetId) {
    const asset = await mux.video.assets.retrieve(assetId);
    playbackId = asset.playback_ids?.[0]?.id ?? null;
    status = asset.status ?? status;
  }

  return { assetId, playbackId, status };
}

/**
 * アセット情報を取得。
 */
export async function getAsset(assetId: string) {
  const mux = getMux();
  return mux.video.assets.retrieve(assetId);
}

/**
 * Playback ID からストリーミング URL を生成。
 */
export function getStreamUrl(playbackId: string): string {
  return `https://stream.mux.com/${playbackId}.m3u8`;
}

/**
 * Playback ID からサムネイル URL を生成。
 * @param time 秒数（オプション）
 */
export function getThumbnailUrl(
  playbackId: string,
  options?: { time?: number; width?: number; height?: number }
): string {
  const params = new URLSearchParams();
  if (options?.time !== undefined) params.set("time", String(options.time));
  if (options?.width) params.set("width", String(options.width));
  if (options?.height) params.set("height", String(options.height));
  const qs = params.toString();
  return `https://image.mux.com/${playbackId}/thumbnail.jpg${qs ? `?${qs}` : ""}`;
}

/**
 * アセットを削除。
 */
export async function deleteAsset(assetId: string): Promise<void> {
  try {
    const mux = getMux();
    await mux.video.assets.delete(assetId);
  } catch {
    // 削除失敗は致命的ではない
  }
}
