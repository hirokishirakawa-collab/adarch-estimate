import { config } from "dotenv";
config({ path: ".env.local" });

import { PrismaClient } from "../../src/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

const url = process.env.DATABASE_URL as string;
const adapter = new PrismaPg({ connectionString: url });
const db = new PrismaClient({ adapter });

// 脱退済み企業の非アクティブ化（有地さん・鈴木さんと同じ扱い）
const TARGETS = [
  { id: "cmmawjc84000nazblqku4373k", label: "宮入 瑞志（茨城県）", memo: "脱退済み（2026-08-13 非アクティブ化）" },
  { id: "cmno0lcac0000xzbl68iqzkne", label: "Rawfeel", memo: "脱退済み・2026-07（2026-08-13 非アクティブ化）" },
];

async function main() {
  for (const t of TARGETS) {
    const before = await db.groupCompany.findUnique({ where: { id: t.id } });
    if (!before) {
      console.log(`見つからず: ${t.label}`);
      continue;
    }
    if (!before.isActive) {
      console.log(`既に停止: ${before.name}`);
      continue;
    }
    await db.groupCompany.update({
      where: { id: t.id },
      data: { isActive: false, memo: before.memo ? `${before.memo}\n${t.memo}` : t.memo },
    });
    console.log(`非アクティブ化: ${before.name}（${before.ownerName}）`);
  }

  const active = await db.groupCompany.findMany({
    where: { isActive: true },
    orderBy: { name: "asc" },
    select: { name: true },
  });
  console.log("\n=== 稼働企業", active.length, "社 ===");
  for (const c of active) console.log(" -", c.name);
}

main()
  .then(() => db.$disconnect())
  .then(() => process.exit(0));
