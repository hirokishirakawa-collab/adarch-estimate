import { config } from "dotenv";
config({ path: ".env.local" });

import { PrismaClient } from "../../src/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

const url = process.env.DATABASE_URL as string;
const adapter = new PrismaPg({ connectionString: url });
const db = new PrismaClient({ adapter });

async function main() {
  const company = await db.groupCompany.findFirst({
    where: { ownerName: { contains: "山田" } },
  });
  if (company) {
    await db.groupCompany.update({
      where: { id: company.id },
      data: { name: "山田 一真（福岡県）" },
    });
    console.log("更新完了:", company.name, "→ 山田 一真（福岡県）");
  }
}

main().then(() => process.exit(0));
