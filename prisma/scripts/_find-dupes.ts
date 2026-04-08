import { config } from "dotenv";
config({ path: ".env.local" });

import { PrismaClient } from "../../src/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

const url = process.env.DATABASE_URL as string;
const adapter = new PrismaPg({ connectionString: url });
const db = new PrismaClient({ adapter });

async function main() {
  const deals = await db.deal.findMany({
    select: {
      id: true,
      title: true,
      status: true,
      customerId: true,
      customer: { select: { name: true } },
      updatedAt: true,
      _count: { select: { dealLogs: true } },
    },
    orderBy: { updatedAt: "desc" },
  });

  const grouped: Record<string, typeof deals> = {};
  for (const d of deals) {
    if (!grouped[d.customerId]) grouped[d.customerId] = [];
    grouped[d.customerId].push(d);
  }

  let dupeCount = 0;
  for (const [, arr] of Object.entries(grouped)) {
    if (arr.length < 2) continue;
    dupeCount++;
    console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
    console.log(`顧客: ${arr[0].customer.name} (${arr.length}件)`);
    for (const d of arr) {
      console.log(
        `  ${d.id.slice(0, 8)}… | ${d.title.padEnd(30)} | ${d.status.padEnd(12)} | 活動${d._count.dealLogs}件 | ${d.updatedAt.toISOString().slice(0, 10)}`
      );
    }
  }

  if (dupeCount === 0) {
    console.log("重複なし");
  } else {
    console.log(`\n合計 ${dupeCount} 社で重複あり`);
  }

  await db.$disconnect();
}

main().catch(console.error);
