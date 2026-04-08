import { config } from "dotenv";
config({ path: ".env.local" });

import { PrismaClient } from "../../src/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

const url = process.env.DATABASE_URL as string;
const adapter = new PrismaPg({ connectionString: url });
const db = new PrismaClient({ adapter });

async function main() {
  const users = await db.user.findMany({
    select: { id: true, email: true, name: true, groupCompanyId: true },
    orderBy: { name: "asc" },
  });
  console.log("=== Users ===");
  for (const u of users) {
    console.log(`${u.name ?? "(名前なし)"} | ${u.email} | gc: ${u.groupCompanyId ?? "(なし)"}`);
  }

  const companies = await db.groupCompany.findMany({
    where: { isActive: true },
    select: { id: true, name: true, ownerName: true },
    orderBy: { name: "asc" },
  });
  console.log("\n=== GroupCompanies (active: " + companies.length + ") ===");
  for (const c of companies) {
    console.log(`${c.id} | ${c.name} | 代表: ${c.ownerName}`);
  }
}

main().then(() => process.exit(0));
