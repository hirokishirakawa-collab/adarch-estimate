import { config } from "dotenv";
config({ path: ".env.local" });

import { PrismaClient } from "../../src/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

const url = process.env.DATABASE_URL as string;
const adapter = new PrismaPg({ connectionString: url });
const db = new PrismaClient({ adapter });

async function main() {
  // User テーブルから名前→拠点のマッピングを取得
  const users = await db.user.findMany({
    select: {
      name: true,
      branch: { select: { name: true } },
    },
  });

  const branchMap = new Map<string, string>();
  for (const u of users) {
    if (u.name && u.branch?.name) {
      branchMap.set(u.name, u.branch.name);
    }
  }

  // GroupCompany を全件取得して名前を更新
  const companies = await db.groupCompany.findMany();

  for (const c of companies) {
    const branch = branchMap.get(c.ownerName);
    if (branch) {
      const newName = c.ownerName + "（" + branch + "）";
      await db.groupCompany.update({
        where: { id: c.id },
        data: { name: newName },
      });
      console.log("更新:", c.name, "→", newName);
    } else {
      console.log("拠点なし:", c.ownerName);
    }
  }
}

main().then(() => process.exit(0));
