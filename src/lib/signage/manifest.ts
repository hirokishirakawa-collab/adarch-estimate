// ---------------------------------------------------------------
// デジタルサイネージ: マニフェスト生成・版番号管理
//
//   端末は /api/signage/d/<token>/manifest?since=<version> を定期取得し、
//   version が変わっていれば items の差分を取り込む（プル型）。
//   内容が変わる操作（プレイリスト編集・スケジュール変更・素材差し替え）は
//   必ず bump* を呼んで、影響する端末の manifestVersion を +1 する。
// ---------------------------------------------------------------
import { db } from "@/lib/db";
import { randomBytes, randomInt } from "crypto";

export const PLAYER_APP_VERSION = "1.0.0";

export type ManifestItem = {
  id: string; // playlistItem id
  assetId: string;
  type: "image" | "video";
  url: string; // 端末が取りに行くURL（トークン付き）
  durationSec: number; // 画像=表示秒／動画=素材の長さ（不明なら0=終了イベントで進む）
  checksum: string;
  size: number;
  name: string;
  startDate: string | null;
  endDate: string | null;
  advertiserId: string | null;
};

export type ManifestSchedule = {
  id: string;
  name: string;
  playlistId: string;
  daysOfWeek: number[];
  startTime: string | null;
  endTime: string | null;
  startDate: string | null;
  endDate: string | null;
  priority: number;
};

export type Manifest = {
  version: number;
  serverTime: string;
  device: { id: string; name: string; orientation: "LANDSCAPE" | "PORTRAIT"; pollSec: number };
  schedules: ManifestSchedule[];
  playlists: Record<string, ManifestItem[]>; // playlistId → items（順序どおり）
  playerVersion: string;
};

export function newDeviceToken(): string {
  return randomBytes(24).toString("base64url");
}

export function newPairingCode(): string {
  // 6桁・先頭0あり（CSPRNG）
  return String(randomInt(0, 1_000_000)).padStart(6, "0");
}

/** 端末トークンで有効端末を取る（未ペアリングは null） */
export async function findDeviceByToken(token: string) {
  if (!token || token.length < 16) return null;
  return db.signageDevice.findUnique({ where: { deviceToken: token } });
}

export async function buildManifest(deviceId: string, baseUrl: string): Promise<Manifest | null> {
  const device = await db.signageDevice.findUnique({
    where: { id: deviceId },
    include: {
      schedules: {
        where: { isActive: true },
        orderBy: [{ priority: "desc" }, { createdAt: "asc" }],
        include: {
          playlist: {
            include: {
              items: {
                orderBy: { order: "asc" },
                include: { asset: true },
              },
            },
          },
        },
      },
    },
  });
  if (!device) return null;

  const playlists: Record<string, ManifestItem[]> = {};
  const schedules: ManifestSchedule[] = [];
  for (const s of device.schedules) {
    schedules.push({
      id: s.id,
      name: s.name,
      playlistId: s.playlistId,
      daysOfWeek: s.daysOfWeek,
      startTime: s.startTime,
      endTime: s.endTime,
      startDate: s.startDate?.toISOString() ?? null,
      endDate: s.endDate?.toISOString() ?? null,
      priority: s.priority,
    });
    if (playlists[s.playlistId]) continue;
    playlists[s.playlistId] = s.playlist.items
      .filter((it) => !it.asset.trashedAt)
      .map((it) => {
        const isVideo = it.asset.mimeType.startsWith("video/");
        return {
          id: it.id,
          assetId: it.assetId,
          type: isVideo ? "video" : "image",
          url: `${baseUrl}/api/signage/d/${device.deviceToken}/asset/${it.assetId}`,
          durationSec: isVideo ? Math.round(it.asset.durationSec ?? 0) : it.durationSec,
          checksum: it.asset.checksum,
          size: it.asset.sizeBytes,
          name: it.asset.originalName,
          startDate: it.startDate?.toISOString() ?? null,
          endDate: it.endDate?.toISOString() ?? null,
          advertiserId: it.advertiserCustomerId,
        };
      });
  }

  return {
    version: device.manifestVersion,
    serverTime: new Date().toISOString(),
    device: { id: device.id, name: device.name, orientation: device.orientation, pollSec: device.pollSec },
    schedules,
    playlists,
    playerVersion: PLAYER_APP_VERSION,
  };
}

/** 端末1台の版を +1 */
export async function bumpDevice(deviceId: string) {
  await db.signageDevice.update({ where: { id: deviceId }, data: { manifestVersion: { increment: 1 } } });
}

/** プレイリストを使っている全端末の版を +1 */
export async function bumpDevicesForPlaylist(playlistId: string) {
  const rows = await db.signageSchedule.findMany({ where: { playlistId }, select: { deviceId: true }, distinct: ["deviceId"] });
  if (rows.length === 0) return;
  await db.signageDevice.updateMany({
    where: { id: { in: rows.map((r) => r.deviceId) } },
    data: { manifestVersion: { increment: 1 } },
  });
}

/** 素材を使っている全端末の版を +1（差し替え・ゴミ箱） */
export async function bumpDevicesForAsset(assetId: string) {
  const items = await db.signagePlaylistItem.findMany({ where: { assetId }, select: { playlistId: true }, distinct: ["playlistId"] });
  for (const it of items) await bumpDevicesForPlaylist(it.playlistId);
}
