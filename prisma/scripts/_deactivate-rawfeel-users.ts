import { config } from "dotenv";
config({ path: ".env.local" });

import { PrismaClient } from "../../src/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

const url = process.env.DATABASE_URL as string;
const adapter = new PrismaPg({ connectionString: url });
const db = new PrismaClient({ adapter });

const TARGETS = ["rawfeel_tominaga@adarch.co.jp", "tomohito@adarch.co.jp"];

async function main() {
  for (const email of TARGETS) {
    const u = await db.user.findUnique({
      where: { email },
      select: { id: true, name: true, isActive: true, suspendCount: true, suspendReason: true },
    });
    if (!u) {
      console.log(`SKIP  ${email} → 該当なし`);
      continue;
    }

    if (u.isActive) {
      // 稼働中 → OS作法どおり停止（回数+1・理由OTHER）
      await db.user.update({
        where: { id: u.id },
        data: { isActive: false, suspendCount: { increment: 1 }, suspendReason: "OTHER" },
      });
      console.log(`STOP  ${email} (${u.name}) → isActive:false / suspendCount:${u.suspendCount + 1} / reason:OTHER`);
    } else {
      // 既に無効 → 二重停止しない。理由が未設定ならOTHERを補完のみ
      if (!u.suspendReason) {
        await db.user.update({ where: { id: u.id }, data: { suspendReason: "OTHER" } });
        console.log(`KEEP  ${email} (${u.name}) → 既に無効。suspendReason を OTHER に補完`);
      } else {
        console.log(`KEEP  ${email} (${u.name}) → 既に無効（reason:${u.suspendReason}）。変更なし`);
      }
    }
  }

  console.log("\n=== 実行後の状態 ===");
  for (const email of TARGETS) {
    const u = await db.user.findUnique({
      where: { email },
      select: { name: true, isActive: true, suspendCount: true, suspendReason: true },
    });
    if (u) console.log(`  ${email} | ${u.name} | isActive:${u.isActive} | count:${u.suspendCount} | reason:${u.suspendReason}`);
  }
}

main()
  .catch((e) => {
    console.error("ERROR:", e instanceof Error ? e.message : e);
    process.exit(1);
  })
  .then(() => process.exit(0));
