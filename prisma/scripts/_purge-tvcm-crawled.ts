/**
 * TVer案件リード（PR_TIMES_TVCM）のうち status=CRAWLED（未判定）だけを削除する。
 *
 * 削除しないもの:
 *   UNTOUCHED（プール公開中） / CALLED / APPOINTMENT / DEAL_CONVERTED / SKIPPED / ARCHIVED
 *   担当者(assignee)がついているもの
 *
 * 実行:
 *   npx tsx prisma/scripts/_purge-tvcm-crawled.ts          → ドライラン（件数とバックアップのみ）
 *   npx tsx prisma/scripts/_purge-tvcm-crawled.ts --execute → 実削除
 */
import { PrismaClient } from "../../src/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import dotenv from "dotenv";
import { writeFileSync } from "fs";
dotenv.config({ path: ".env.local" });

const adapter = new PrismaPg({
  connectionString: process.env.DATABASE_URL!.replace(/\s+/g, ""),
});
const db = new PrismaClient({ adapter });

const EXECUTE = process.argv.includes("--execute");
// 注意: indexOf は未指定時に -1 を返す。+1 すると argv[0]（nodeバイナリのパス）を
// 指してしまい、バックアップの書き出しでnodeを破壊する。必ず -1 を先に弾くこと。
const backupIdx = process.argv.indexOf("--backup");
const BACKUP_PATH = backupIdx >= 0 ? (process.argv[backupIdx + 1] ?? "") : "";

async function main() {
  const where = {
    source: "PR_TIMES_TVCM" as const,
    status: "CRAWLED" as const,
    assigneeId: null,
  };

  // 安全確認: 担当者つきの CRAWLED が存在しないか
  const crawledWithAssignee = await db.lead.count({
    where: { source: "PR_TIMES_TVCM", status: "CRAWLED", assigneeId: { not: null } },
  });
  console.log(`担当者つきCRAWLED（削除対象外）: ${crawledWithAssignee}件`);

  // 安全確認: Studio案件に紐づいているものがないか
  const linkedToStudio = await db.studioClient.count({
    where: { lead: { source: "PR_TIMES_TVCM", status: "CRAWLED" } },
  });
  console.log(`Studio案件に紐づくCRAWLED: ${linkedToStudio}件`);

  const targets = await db.lead.findMany({
    where,
    select: {
      id: true,
      name: true,
      prefecture: true,
      industry: true,
      pressReleaseUrl: true,
      videoUrl: true,
      websiteUrl: true,
      productionCompany: true,
      agencyDetected: true,
      isListed: true,
      scoreComment: true,
      createdAt: true,
    },
    orderBy: { createdAt: "asc" },
  });

  console.log(`\n削除対象（source=PR_TIMES_TVCM / status=CRAWLED / 担当者なし）: ${targets.length}件`);
  if (targets.length > 0) {
    console.log(`  最古: ${targets[0].createdAt.toISOString().slice(0, 10)} ${targets[0].name}`);
    console.log(
      `  最新: ${targets[targets.length - 1].createdAt.toISOString().slice(0, 10)} ${targets[targets.length - 1].name}`,
    );
  }

  if (BACKUP_PATH) {
    writeFileSync(BACKUP_PATH, JSON.stringify(targets, null, 2), "utf-8");
    console.log(`\nバックアップ書き出し: ${BACKUP_PATH}`);
  }

  if (!EXECUTE) {
    console.log("\n[ドライラン] --execute を付けると実削除します。");
    return;
  }

  // LeadLog / HearingSheet は onDelete: Cascade で自動削除される
  const result = await db.lead.deleteMany({ where });
  console.log(`\n✅ 削除完了: ${result.count}件`);

  const remain = await db.lead.groupBy({
    by: ["status"],
    where: { source: "PR_TIMES_TVCM" },
    _count: { _all: true },
  });
  console.log("=== 削除後の残件（status別）===");
  for (const g of remain) console.log(`  ${g.status}\t${g._count._all}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => db.$disconnect());
