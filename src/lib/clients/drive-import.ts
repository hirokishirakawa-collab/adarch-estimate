// ==============================================================
// Google Drive 実績フォルダ（portfolio_items の案件フォルダ）→ ClientWork（source="drive"）
//
// 毎朝の /api/cron/client-enrich から呼ばれる（portfolio_items は別途 Drive から日次同期）。
// 代表が実績フォルダに成果物を入れる → 翌朝までに取引先マップへ出る、という流れ。
//   - 案件フォルダごとに会社名を読み取り（drive-classify.ts）。動画タイトル等は取り込まない
//   - 既存顧客 → 実績アーカイブ の順に社名で突合。無ければ実績アーカイブ拠点へ新規登録
//   - 冪等（sourceId="drive:<DriveID>" で upsert）
// ==============================================================

import { db } from "@/lib/db";
import { ARCHIVE_BRANCH_ID } from "@/lib/data/customers";
import { isSameCompany, normalizeCompanyName } from "./normalize";
import { clientFromDriveFolder, driveCategoryLabel } from "./drive-classify";

export interface DriveImportStats {
  folders: number;
  upserted: number;
  linkedRegular: number;
  linkedArchive: number;
  created: number;
  skipped: number;
  createdNames: string[];
}

export async function importDriveWorks(opts: { dry?: boolean } = {}): Promise<DriveImportStats> {
  const dry = !!opts.dry;
  const items = await db.portfolioItem.findMany({
    where: { depth: 2 },
    select: { driveFileId: true, name: true, itemType: true, driveUrl: true, lastUpdated: true, parentName: true },
    orderBy: { path: "asc" },
  });
  const children = await db.portfolioItem.findMany({ where: { depth: 3 }, select: { parentName: true } });
  const childCount = new Map<string, number>();
  for (const c of children) if (c.parentName) childCount.set(c.parentName, (childCount.get(c.parentName) ?? 0) + 1);

  const regular = await db.customer.findMany({ where: { branchId: { not: ARCHIVE_BRANCH_ID }, status: { not: "BLOCKED" } }, select: { id: true, name: true } });
  const archive = await db.customer.findMany({ where: { branchId: ARCHIVE_BRANCH_ID }, select: { id: true, name: true } });
  const createdMap = new Map<string, string>();
  const stats: DriveImportStats = { folders: items.length, upserted: 0, linkedRegular: 0, linkedArchive: 0, created: 0, skipped: 0, createdNames: [] };

  for (const it of items) {
    const { client, reason } = clientFromDriveFolder(it.name);
    if (!client || reason) { stats.skipped++; continue; }
    const key = normalizeCompanyName(client);
    let customerId: string | null = null;
    const r = regular.find((c) => isSameCompany(c.name, client));
    const a = r ? null : archive.find((c) => isSameCompany(c.name, client));
    if (r) { customerId = r.id; stats.linkedRegular++; }
    else if (a) { customerId = a.id; stats.linkedArchive++; }
    else if (createdMap.has(key)) customerId = createdMap.get(key)!;
    else {
      stats.created++; stats.createdNames.push(client);
      if (dry) { createdMap.set(key, "dry"); continue; }
      const c = await db.customer.create({
        data: {
          name: client, branchId: ARCHIVE_BRANCH_ID, status: "ACTIVE", rank: "B", source: "DRIVE_ARCHIVE",
          notes: `Google Drive の実績フォルダ「${it.name.normalize("NFKC")}」（${driveCategoryLabel(it.parentName)}）から登録`,
          staffName: "本部（実績取込）",
        },
        select: { id: true },
      });
      createdMap.set(key, c.id); customerId = c.id;
    }
    if (dry) continue;
    const title = it.name.normalize("NFKC").replace(/\.(mp4|mov|pdf)$/i, "");
    const data = {
      source: "drive", clientName: it.name.normalize("NFKC"), title, titleJp: null as string | null, category: driveCategoryLabel(it.parentName),
      year: it.lastUpdated ? new Date(it.lastUpdated).getFullYear() : new Date().getFullYear(),
      thumbnail: null as string | null, videoUrl: null as string | null, driveUrl: it.driveUrl,
      fileCount: it.itemType === "folder" ? childCount.get(it.name) ?? 0 : null, customerId,
    };
    await db.clientWork.upsert({ where: { sourceId: `drive:${it.driveFileId}` }, create: { sourceId: `drive:${it.driveFileId}`, ...data }, update: data });
    stats.upserted++;
  }
  return stats;
}
