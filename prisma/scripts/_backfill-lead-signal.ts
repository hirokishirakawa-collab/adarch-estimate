/**
 * 既存リードに購買シグナル（signalAt / signalKind）を埋める。
 *
 * 優先順:
 *   1. announcedDate あり  → TVCM（CM発表のプレスリリース日）
 *   2. それ以外            → FOUND（発掘日＝createdAt）
 *
 * 補助金（SUBSIDY）は取得そのものが動いていなかったため既存データに無い。
 * BtoBリード獲得AIを回し直した分から順に付く。
 *
 * 実行:
 *   npx tsx prisma/scripts/_backfill-lead-signal.ts            → ドライラン（件数のみ）
 *   npx tsx prisma/scripts/_backfill-lead-signal.ts --execute  → 実更新
 */
import { config } from "dotenv";
config({ path: ".env.local" });

import { PrismaClient } from "../../src/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

const url = process.env.DATABASE_URL as string;
const adapter = new PrismaPg({ connectionString: url });
const db = new PrismaClient({ adapter });

const EXECUTE = process.argv.includes("--execute");

async function main() {
  const total = await db.lead.count();
  const already = await db.lead.count({ where: { signalAt: { not: null } } });
  const withAnnounced = await db.lead.count({
    where: { signalAt: null, announcedDate: { not: null } },
  });
  const rest = await db.lead.count({
    where: { signalAt: null, announcedDate: null },
  });

  console.log(`全リード: ${total}`);
  console.log(`  既にシグナルあり : ${already}`);
  console.log(`  TVCM で埋まる    : ${withAnnounced}`);
  console.log(`  発掘日で埋まる   : ${rest}`);

  if (!EXECUTE) {
    console.log("\nドライランです。実更新するには --execute を付けてください。");
    return;
  }

  // 1) CM発表日を持つものは、その日をシグナルにする
  const announced = await db.lead.findMany({
    where: { signalAt: null, announcedDate: { not: null } },
    select: { id: true, announcedDate: true },
  });
  let n1 = 0;
  for (const l of announced) {
    if (!l.announcedDate) continue;
    await db.lead.update({
      where: { id: l.id },
      data: { signalAt: l.announcedDate, signalKind: "TVCM" },
    });
    n1++;
  }
  console.log(`TVCM で更新: ${n1}`);

  // 2) 残りは発掘日に倒す（createdAt をそのまま入れる）
  const n2 = await db.$executeRaw`
    UPDATE "leads"
       SET "signalAt" = "createdAt", "signalKind" = 'FOUND'
     WHERE "signalAt" IS NULL
  `;
  console.log(`発掘日で更新: ${n2}`);

  const remaining = await db.lead.count({ where: { signalAt: null } });
  console.log(`未設定の残り: ${remaining}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => db.$disconnect());
