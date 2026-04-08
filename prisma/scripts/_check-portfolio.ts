import { config } from "dotenv";
config({ path: ".env.local" });

import { PrismaClient } from "../../src/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

const url = process.env.DATABASE_URL as string;
const adapter = new PrismaPg({ connectionString: url });
const db = new PrismaClient({ adapter });

async function main() {
  const count = await db.portfolioItem.count();
  console.log("Total items:", count);

  const byType = await db.portfolioItem.groupBy({ by: ["itemType"], _count: { id: true } });
  console.log("By type:", JSON.stringify(byType));

  const items = await db.portfolioItem.findMany({
    take: 15,
    orderBy: { depth: "asc" },
    select: { name: true, itemType: true, depth: true, path: true },
  });
  items.forEach((i) => console.log(`[${i.depth}] ${i.itemType} | ${i.name}`));

  await db.$disconnect();
}

main();
