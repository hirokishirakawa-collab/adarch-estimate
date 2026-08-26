// ==============================================================
// Google Drive 実績フォルダ（portfolio_items）→ ClientWork（source="drive"）
//
//   DATABASE_URL=… npx tsx prisma/scripts/import-drive-works.ts [--dry]
//
//   - 案件フォルダ（depth=2）ごとに会社名を読み取り（src/lib/clients/drive-classify.ts）
//   - 既存顧客 → 実績アーカイブの顧客 の順に社名で突合。無ければ実績アーカイブ拠点へ新規登録
//   - 除外（動画タイトル等）は取り込まない
//   - 何度実行しても同じ結果（sourceId="drive:<DriveID>" で upsert）
// ==============================================================

import { PrismaClient } from "../../src/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { isSameCompany, normalizeCompanyName } from "../../src/lib/clients/normalize";
import { clientFromDriveFolder, driveCategoryLabel } from "../../src/lib/clients/drive-classify";

const ARCHIVE_BRANCH_ID = "branch_archive";
const DRY = process.argv.includes("--dry");

async function main() {
  const db = new PrismaClient({ adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL! }) });
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
  const created = new Map<string, string>();
  let linkedRegular = 0, linkedArchive = 0, made = 0, skipped = 0, upserted = 0;
  const newNames: string[] = [];

  for (const it of items) {
    const { client, reason } = clientFromDriveFolder(it.name);
    if (!client || reason) { skipped++; continue; }
    const key = normalizeCompanyName(client);
    let customerId: string | null = null;
    const r = regular.find((c) => isSameCompany(c.name, client));
    const a = r ? null : archive.find((c) => isSameCompany(c.name, client));
    if (r) { customerId = r.id; linkedRegular++; }
    else if (a) { customerId = a.id; linkedArchive++; }
    else if (created.has(key)) customerId = created.get(key)!;
    else {
      made++; newNames.push(client);
      if (DRY) { created.set(key, "dry"); }
      else {
        const c = await db.customer.create({
          data: {
            name: client, branchId: ARCHIVE_BRANCH_ID, status: "ACTIVE", rank: "B", source: "DRIVE_ARCHIVE",
            notes: `Google Drive の実績フォルダ「${it.name.normalize("NFKC")}」（${driveCategoryLabel(it.parentName)}）から登録`,
            staffName: "本部（実績取込）",
          },
          select: { id: true },
        });
        created.set(key, c.id); customerId = c.id;
      }
    }
    if (DRY || customerId === "dry") continue;
    const title = it.name.normalize("NFKC").replace(/\.(mp4|mov|pdf)$/i, "");
    const data = {
      source: "drive", clientName: it.name.normalize("NFKC"), title, titleJp: null, category: driveCategoryLabel(it.parentName),
      year: it.lastUpdated ? new Date(it.lastUpdated).getFullYear() : new Date().getFullYear(),
      thumbnail: null, videoUrl: null, driveUrl: it.driveUrl, fileCount: it.itemType === "folder" ? childCount.get(it.name) ?? 0 : null, customerId,
    };
    await db.clientWork.upsert({ where: { sourceId: `drive:${it.driveFileId}` }, create: { sourceId: `drive:${it.driveFileId}`, ...data }, update: data });
    upserted++;
  }
  console.log(`案件フォルダ ${items.length}件 → 取込 ${upserted}／既存顧客に紐づけ ${linkedRegular}／アーカイブに紐づけ ${linkedArchive}／新規登録 ${made}／除外 ${skipped}${DRY ? "（dry run）" : ""}`);
  if (DRY) console.log("新規登録予定:", newNames.join("、"));
  await db.$disconnect();
}
main().catch((e) => { console.error(e); process.exit(1); });
