import { config } from "dotenv";
config({ path: ".env.local" });

import { PrismaClient } from "../../src/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

const url = process.env.DATABASE_URL as string;
const adapter = new PrismaPg({ connectionString: url });
const db = new PrismaClient({ adapter });

const fixes = [
  { ownerName: "七條 敬一", newName: "七條 敬一（岡山県・香川県）" },
  { ownerName: "歌丸 翔馬", newName: "歌丸 翔馬（山口県・広島県）" },
  { ownerName: "高澤 健太郎", newName: "高澤 健太郎（福島県・宮城県）" },
];

async function main() {
  for (const f of fixes) {
    const company = await db.groupCompany.findFirst({
      where: { ownerName: f.ownerName },
    });
    if (company) {
      await db.groupCompany.update({
        where: { id: company.id },
        data: { name: f.newName },
      });
      console.log("更新:", company.name, "→", f.newName);
    }
  }
}

main().then(() => process.exit(0));
