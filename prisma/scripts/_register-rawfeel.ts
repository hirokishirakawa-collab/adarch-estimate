import { config } from "dotenv";
config({ path: ".env.local" });

import { PrismaClient } from "../../src/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

const url = process.env.DATABASE_URL as string;
const adapter = new PrismaPg({ connectionString: url });
const db = new PrismaClient({ adapter });

async function main() {
  // 1. Branch 作成（台湾/東京拠点）
  const branch = await db.branch.upsert({
    where: { code: "RWF" },
    update: { name: "台湾/東京（Rawfeel）" },
    create: {
      id: "branch_rwf",
      name: "台湾/東京（Rawfeel）",
      code: "RWF",
    },
  });
  console.log("✅ Branch:", branch.id, branch.name);

  // 2. GroupCompany 作成
  const company = await db.groupCompany.upsert({
    where: { chatSpaceId: "AAQAm1b7U3U" },
    update: { name: "Rawfeel", ownerName: "Riku Tominaga" },
    create: {
      name: "Rawfeel",
      ownerName: "Riku Tominaga",
      chatSpaceId: "AAQAm1b7U3U",
      phase: "ONBOARDING",
      isActive: true,
    },
  });
  console.log("✅ GroupCompany:", company.id, company.name);

  // 3. User 事前登録 — Riku Tominaga (MANAGER)
  const user1 = await db.user.upsert({
    where: { email: "rawfeel_tominaga@adarch.co.jp" },
    update: { name: "Riku Tominaga", branchId: branch.id, groupCompanyId: company.id },
    create: {
      email: "rawfeel_tominaga@adarch.co.jp",
      name: "Riku Tominaga",
      role: "MANAGER",
      branchId: branch.id,
      groupCompanyId: company.id,
      learningExempt: false,
    },
  });
  console.log("✅ User1:", user1.id, user1.email, user1.name);

  // 4. User 事前登録 — Tomo (USER)
  const user2 = await db.user.upsert({
    where: { email: "rawfeel_tomohito@adarch.co.jp" },
    update: { name: "Tomo", branchId: branch.id, groupCompanyId: company.id },
    create: {
      email: "rawfeel_tomohito@adarch.co.jp",
      name: "Tomo",
      role: "USER",
      branchId: branch.id,
      groupCompanyId: company.id,
      learningExempt: false,
    },
  });
  console.log("✅ User2:", user2.id, user2.email, user2.name);

  console.log("\n🎉 Rawfeel 登録完了!");
}

main()
  .catch((e) => {
    console.error("❌ Error:", e);
    process.exit(1);
  })
  .finally(() => db.$disconnect());
