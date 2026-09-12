import { config } from "dotenv";
config({ path: ".env.local" });
import { writeFileSync } from "fs";
import { PrismaClient } from "../../src/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
const db = new PrismaClient({ adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL as string }) });
// 高橋#033 2026-08分 MF請求 #1269 のOS記録を削除（2026-09-09 代表決定＝8月分は不請求・MF側は代表が取消）
const ID = "cmti2gppk000v01o1muh684jo";
async function main() {
  const row = await db.royaltyMfBilling.findUnique({ where: { id: ID } });
  if (!row) throw new Error("見つかりません");
  if (row.groupCompanyId !== "cmmawj2440003azblkq3z1qig" || row.month !== "2026-08" || row.billingNumber !== "1269") throw new Error("対象確認に失敗");
  writeFileSync(process.env.HOME + "/Desktop/03_契約・法務/高橋033_脱退整理/os_backup/royaltyMfBilling_1269_before_delete_20260909.json", JSON.stringify(row, null, 2));
  await db.royaltyMfBilling.delete({ where: { id: ID } });
  console.log("削除完了: MF#", row.billingNumber, row.month, row.totalInclTax);
  console.log("残件:", await db.royaltyMfBilling.count({ where: { groupCompanyId: row.groupCompanyId } }));
}
main().then(() => db.$disconnect()).then(() => process.exit(0)).catch((e) => { console.error(e); process.exit(1); });
