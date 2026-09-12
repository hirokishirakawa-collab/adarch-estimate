// ローカル検証用: 拠点・素材・プレイリスト・スケジュール・ペアリング済み端末を作り、トークンを出力
import { PrismaClient } from "../../src/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { readFileSync, copyFileSync, mkdirSync } from "fs";
import { createHash } from "crypto";
import path from "path";

const STORAGE = process.env.STORAGE_PATH!;
const S = "/private/tmp/claude-501/-Users-hirokishirakawa/f7399508-e57f-40e3-8e8b-269e8869d6c8/scratchpad/signage-test";
const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
const db = new PrismaClient({ adapter });

async function main() {
  mkdirSync(path.join(STORAGE, "signage-assets"), { recursive: true });
  const branch = await db.branch.upsert({ where: { code: "TEST" }, update: {}, create: { name: "検証拠点", code: "TEST" } });
  const mk = async (file: string, mime: string, dur: number | null) => {
    const stored = `seed-${file}`;
    copyFileSync(path.join(S, file), path.join(STORAGE, "signage-assets", stored));
    const buf = readFileSync(path.join(S, file));
    return db.signageAsset.create({ data: { originalName: file, storedName: stored, mimeType: mime, sizeBytes: buf.length, durationSec: dur, checksum: createHash("sha256").update(buf).digest("hex"), branchId: branch.id } });
  };
  const v = await mk("test9s.mp4", "video/mp4", 9);
  const i = await mk("test.jpg", "image/jpeg", null);
  const pl = await db.signagePlaylist.create({ data: { name: "標準", branchId: branch.id, items: { create: [{ assetId: i.id, order: 0, durationSec: 5 }, { assetId: v.id, order: 1, durationSec: 15 }] } } });
  const dev = await db.signageDevice.create({ data: { name: "検証端末", deviceToken: "testtoken_0123456789abcdef", isActive: true, pairedAt: new Date(), branchId: branch.id, pollSec: 15, schedules: { create: [{ playlistId: pl.id, name: "標準" }] } } });
  console.log("TOKEN=" + dev.deviceToken, "DEVICE=" + dev.id, "PLAYLIST=" + pl.id, "ASSET_IMG=" + i.id, "ASSET_VID=" + v.id);
}
main().finally(() => db.$disconnect());
