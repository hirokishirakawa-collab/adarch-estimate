import { config } from "dotenv";
config({ path: ".env.local" });

import { PrismaClient } from "../../src/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

const url = process.env.DATABASE_URL as string;
const adapter = new PrismaPg({ connectionString: url });
const db = new PrismaClient({ adapter });

// ownerName → email の手動マッピング（名前が一致しないケース用）
const MANUAL_MAP: Record<string, string> = {
  // 白川さん（社長）は本部ADMINなので紐付けなし
};

async function main() {
  const users = await db.user.findMany({
    select: { id: true, email: true, name: true, groupCompanyId: true },
  });
  const companies = await db.groupCompany.findMany({
    where: { isActive: true },
    select: { id: true, name: true, ownerName: true },
  });

  let linked = 0;
  let skipped = 0;
  let notFound = 0;

  for (const gc of companies) {
    // 手動マッピングを優先
    const manualEmail = MANUAL_MAP[gc.ownerName];

    // ユーザー名とownerNameでマッチ（空白の揺れを正規化）
    const normalize = (s: string) => s.replace(/\s+/g, "").trim();
    const user = manualEmail
      ? users.find((u) => u.email === manualEmail)
      : users.find((u) => u.name && normalize(u.name) === normalize(gc.ownerName));

    if (!user) {
      console.log(`❌ NOT FOUND: ${gc.ownerName}（${gc.name}）`);
      notFound++;
      continue;
    }

    if (user.groupCompanyId === gc.id) {
      console.log(`⏭️  SKIP (already): ${user.name} → ${gc.name}`);
      skipped++;
      continue;
    }

    await db.user.update({
      where: { id: user.id },
      data: { groupCompanyId: gc.id },
    });
    console.log(`✅ LINKED: ${user.name} (${user.email}) → ${gc.name}`);
    linked++;
  }

  console.log(`\n--- 完了: ${linked} 件紐付け / ${skipped} 件スキップ / ${notFound} 件未発見 ---`);
}

main().then(() => process.exit(0));
