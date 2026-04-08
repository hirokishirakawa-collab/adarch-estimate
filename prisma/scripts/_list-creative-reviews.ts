import { config } from "dotenv";
config({ path: ".env.local" });

import { PrismaClient } from "../../src/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

const url = process.env.DATABASE_URL as string;
const adapter = new PrismaPg({ connectionString: url });
const db = new PrismaClient({ adapter });

async function main() {
  const reviews = await db.tverCreativeReview.findMany({
    orderBy: { createdAt: "desc" },
    select: { id: true, projectName: true, status: true, createdAt: true, branchId: true },
  });
  console.table(reviews);
}

main().then(() => db.$disconnect());
