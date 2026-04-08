import { PrismaClient } from "../../src/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

const adapter = new PrismaPg(process.env.DATABASE_URL!);
const prisma = new PrismaClient({ adapter });

async function main() {
  // まず現状を確認
  const users = await prisma.user.findMany({
    where: { email: { contains: "yamaguchi" } },
    select: { id: true, email: true, name: true, role: true },
  });
  console.log("Found users with yamaguchi:", JSON.stringify(users, null, 2));

  if (users.length > 0) {
    // メールアドレスを更新
    const updated = await prisma.user.updateMany({
      where: { email: "yamaguchi@adarch.co.jp" },
      data: { email: "shoma.utamaru@adarch.co.jp" },
    });
    console.log(`Updated ${updated.count} user(s)`);

    // 更新後を確認
    const after = await prisma.user.findMany({
      where: { email: "shoma.utamaru@adarch.co.jp" },
      select: { id: true, email: true, name: true, role: true },
    });
    console.log("After update:", JSON.stringify(after, null, 2));
  } else {
    console.log("No user found with yamaguchi@adarch.co.jp");
  }
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
