import { config } from "dotenv";
config({ path: ".env.local" });

import { PrismaClient } from "../../src/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

const url = process.env.DATABASE_URL as string;
const adapter = new PrismaPg({ connectionString: url });
const db = new PrismaClient({ adapter });

async function main() {
  // 白川さんのユーザー・拠点情報を取得
  const user = await db.user.findFirst({
    where: { email: "hiroki.shirakawa@adarch.co.jp" },
    select: { id: true, branchId: true },
  });
  if (!user || !user.branchId) {
    console.error("User not found");
    return;
  }

  // 重複チェック
  const existing = await db.customer.findFirst({
    where: { name: "日本ゴア合同会社" },
  });
  if (existing) {
    console.log("Already exists:", existing.id);
    return;
  }

  // 顧客登録
  const customer = await db.customer.create({
    data: {
      name: "日本ゴア合同会社",
      nameKana: "ニホンゴアゴウドウガイシャ",
      postalCode: "108-0075",
      prefecture: "東京都",
      address: "港区港南1-8-15",
      building: "Wビル 14階",
      phone: "080-2000-9705",
      email: "iabe@wlgore.com",
      website: "https://www.gore.co.jp",
      contactName: "阿部 功",
      rank: "A",
      status: "ACTIVE",
      notes: "GORE-TEXブランド / アカウントマーケティング / ファブリクス・ディビジョン\n支払条件: 月末締め翌月25日 現金振込\n間接調達担当: 下田英則 (hshimoda@wlgore.com)\n改正下請法対応書面 取り交わし済み（2025年10月）",
      branchId: user.branchId,
      staffName: "白川 裕喜",
    },
  });

  console.log("Created:", customer.id, customer.name);
}

main()
  .catch(console.error)
  .finally(() => db.$disconnect());
