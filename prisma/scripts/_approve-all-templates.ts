import { config } from "dotenv";
config({ path: ".env.local" });

import { PrismaClient } from "../../src/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

const url = process.env.DATABASE_URL as string;
const adapter = new PrismaPg({ connectionString: url });
const db = new PrismaClient({ adapter });

async function main() {
  // 承認フロー廃止に伴う既存データ一括承認
  const pending = await db.autoSalesTemplate.findMany({
    where: { isApproved: false },
    select: {
      id: true,
      name: true,
      companyName: true,
      branch: { select: { name: true } },
    },
  });

  console.log(`承認待ちテンプレート: ${pending.length}件`);
  for (const t of pending) {
    console.log(`  - [${t.branch?.name ?? "本部"}] ${t.name} / ${t.companyName}`);
  }

  if (pending.length === 0) {
    console.log("更新対象なし。終了します。");
    return;
  }

  const result = await db.autoSalesTemplate.updateMany({
    where: { isApproved: false },
    data: {
      isApproved: true,
      approvedAt: new Date(),
    },
  });

  console.log(`\n✅ ${result.count}件を承認済みに更新しました。`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => process.exit(0));
