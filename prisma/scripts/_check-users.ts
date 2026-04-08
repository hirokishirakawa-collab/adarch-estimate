import { PrismaClient } from "../../src/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import dotenv from "dotenv";
dotenv.config({ path: ".env.local" });

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL!.replace(/\s+/g, "") });
const db = new PrismaClient({ adapter });

async function main() {
  const users = await db.user.findMany({ select: { id: true, name: true, email: true } });
  console.log("=== DB ユーザー一覧 ===");
  for (const u of users) {
    console.log(`  ${u.name}  (${u.email})`);
  }

  const totalCards = await db.businessCard.count();
  const withAI = await db.businessCard.count({ where: { aiIndustry: { not: null } } });
  console.log(`\n=== 名刺: 合計 ${totalCards} 件 (AI データあり: ${withAI} 件) ===`);
  console.log("\n=== 名刺の所有者別件数 ===");
  const cards = await db.businessCard.groupBy({
    by: ["ownerId"],
    _count: true,
  });
  for (const c of cards) {
    const user = users.find((u) => u.id === c.ownerId);
    console.log(`  ${user?.name ?? "不明"} (${user?.email ?? c.ownerId}): ${c._count}件`);
  }
}

main()
  .catch(console.error)
  .finally(() => db.$disconnect());
