// 既存の送付ログ（LeadLog action="FORM_SENT"）から Lead.sentAt を埋める一回限りのスクリプト。
//
// 使い方:
//   確認のみ:  npx tsx scripts/backfill-lead-sent-at.ts
//   実際に更新: npx tsx scripts/backfill-lead-sent-at.ts --apply
//
// ※ 先に `npx prisma db push` で sentAt / outreachResult / outreachResultAt を追加しておくこと。
// ※ sentAt が既に入っているリードは触らない。結果（outreachResult）も一切変更しない。
import { config } from "dotenv";
config({ path: ".env.local" });
config();
import { PrismaClient } from "../src/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! });
const prisma = new PrismaClient({ adapter });

const APPLY = process.argv.includes("--apply");

async function main() {
  // リードごとの最新の送付ログ
  const logs = await prisma.leadLog.findMany({
    where: { action: "FORM_SENT" },
    orderBy: { createdAt: "desc" },
    distinct: ["leadId"],
    select: { leadId: true, createdAt: true },
  });
  console.log(`送付ログのあるリード: ${logs.length}件`);

  let filled = 0;
  let skipped = 0;
  for (const log of logs) {
    const lead = await prisma.lead.findUnique({
      where: { id: log.leadId },
      select: { id: true, name: true, sentAt: true },
    });
    if (!lead) continue;
    if (lead.sentAt) {
      skipped++;
      continue;
    }
    filled++;
    console.log(`  ${APPLY ? "更新" : "対象"}: ${lead.name} → ${log.createdAt.toISOString().slice(0, 10)}`);
    if (APPLY) {
      await prisma.lead.update({ where: { id: lead.id }, data: { sentAt: log.createdAt } });
    }
  }

  console.log(`\n埋める: ${filled}件 ／ 既に入っていた: ${skipped}件`);
  if (!APPLY) console.log("※ 確認のみ。実行するには --apply を付けてください");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
