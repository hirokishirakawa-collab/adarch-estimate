import { config } from "dotenv";
config({ path: ".env.local" });

import { PrismaClient } from "../../src/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

const url = process.env.DATABASE_URL as string;
const adapter = new PrismaPg({ connectionString: url });
const db = new PrismaClient({ adapter });

// ───────────────────────────────────────────────
// ⚠️ 実行前に下記2つを埋めてください（外部準備が必要）
//   1. ENDO_EMAIL    : Google Workspace で発行した遠藤さんの @adarch.co.jp アドレス
//   2. CHAT_SPACE_ID : 遠藤さん週次報告用 Google Chat スペースの ID（例: "AAQA..."）
// ───────────────────────────────────────────────
const ENDO_EMAIL = "tukuru.endo@adarch.co.jp";
const CHAT_SPACE_ID = "AAQAvXmjPXY";

async function main() {
  if (ENDO_EMAIL.startsWith("FILL_ME") || CHAT_SPACE_ID === "FILL_ME") {
    throw new Error("ENDO_EMAIL と CHAT_SPACE_ID を埋めてから実行してください。");
  }

  // 1. Branch 作成（東京・Pleete）
  const branch = await db.branch.upsert({
    where: { code: "PLT" },
    update: { name: "東京（Pleete）" },
    create: {
      id: "branch_plt",
      name: "東京（Pleete）",
      code: "PLT",
    },
  });
  console.log("✅ Branch:", branch.id, branch.name);

  // 2. GroupCompany 作成（株式会社Pleete / 遠藤創平）
  const company = await db.groupCompany.upsert({
    where: { chatSpaceId: CHAT_SPACE_ID },
    update: { name: "株式会社Pleete", ownerName: "遠藤創平" },
    create: {
      name: "株式会社Pleete",
      ownerName: "遠藤創平",
      chatSpaceId: CHAT_SPACE_ID,
      phase: "ONBOARDING",
      isActive: true,
      prefecture: "東京",
      genre: "制作",
      entityType: "CORPORATION",
      registeredName: "株式会社Pleete",
      corporateNumber: "3010401155653",
      // 立ち上げ期は免除（請求しない）。契約どおり3ヶ月目以降に両者協議で false へ。
      royaltyExempt: true,
    },
  });
  console.log("✅ GroupCompany:", company.id, company.name);

  // 3. User 事前登録 — 遠藤創平（MANAGER / 1人体制）
  const user = await db.user.upsert({
    where: { email: ENDO_EMAIL },
    update: { name: "遠藤創平", branchId: branch.id, groupCompanyId: company.id },
    create: {
      email: ENDO_EMAIL,
      name: "遠藤創平",
      role: "MANAGER",
      branchId: branch.id,
      groupCompanyId: company.id,
      learningExempt: false,
    },
  });
  console.log("✅ User:", user.id, user.email, user.name);

  console.log("\n🎉 株式会社Pleete（遠藤創平さん）登録完了!");
}

main()
  .catch((e) => {
    console.error("❌ Error:", e);
    process.exit(1);
  })
  .finally(() => db.$disconnect());
