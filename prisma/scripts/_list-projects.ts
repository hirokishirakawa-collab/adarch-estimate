import { config } from "dotenv";
config({ path: ".env.local" });

import { PrismaClient } from "../../src/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

const url = process.env.DATABASE_URL as string;
const adapter = new PrismaPg({ connectionString: url });
const db = new PrismaClient({ adapter });

async function main() {
  const projects = await db.project.findMany({
    select: {
      id: true,
      title: true,
      status: true,
      createdAt: true,
      customer: { select: { name: true } },
    },
    orderBy: { createdAt: "desc" },
  });
  for (const p of projects) {
    console.log(
      `${p.id} | ${p.title} | ${p.status} | ${p.customer?.name ?? "顧客なし"} | ${p.createdAt.toISOString().slice(0, 10)}`
    );
  }
  console.log(`\n合計: ${projects.length}件`);
}

main().then(() => process.exit(0));
