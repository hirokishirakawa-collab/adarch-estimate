import { config } from "dotenv";
config({ path: ".env.local" });

import { PrismaClient } from "../../src/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

const url = process.env.DATABASE_URL as string;
const adapter = new PrismaPg({ connectionString: url });
const db = new PrismaClient({ adapter });

async function main() {
  const user = await db.user.findFirst({
    where: { email: "hiroki.shirakawa@adarch.co.jp" },
    select: { id: true, name: true, email: true, role: true, branchId: true },
  });
  console.log("User:", user);

  const reviews = await db.tverCreativeReview.findMany({
    select: { id: true, projectName: true, status: true, branchId: true },
  });
  console.log("All creative reviews:", reviews);
}

main().then(() => db.$disconnect());
