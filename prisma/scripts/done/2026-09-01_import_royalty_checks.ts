import { config } from "dotenv";
config({ path: ".env.local" });
import { PrismaClient } from "../../src/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
const db = new PrismaClient({ adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL as string }) });
type R = [string, string, string, string, number]; // 社名(部分一致), month, paidOn, method, amount
const rows: R[] = [
  // 4月分（期限6/10）
  ["歌丸", "2026-04", "2026-05-29", "GMO", 55000],
  ["瀬野", "2026-04", "2026-06-10", "BANK_TRANSFER", 55000],
  ["片桐", "2026-04", "2026-06-10", "BANK_TRANSFER", 55000],
  ["大城", "2026-04", "2026-06-15", "BANK_TRANSFER", 55000],
  // 5月分（期限7/10）
  ["横山", "2026-05", "2026-06-30", "BANK_TRANSFER", 55000],
  ["七條", "2026-05", "2026-06-30", "BANK_TRANSFER", 55000],
  ["吉原", "2026-05", "2026-06-30", "BANK_TRANSFER", 55920],
  ["倉田", "2026-05", "2026-06-30", "BANK_TRANSFER", 55000],
  ["金山", "2026-05", "2026-06-29", "BANK_TRANSFER", 55000],
  ["瀬野", "2026-05", "2026-07-10", "BANK_TRANSFER", 44110],
  ["高橋", "2026-05", "2026-07-03", "BANK_TRANSFER", 55000],
  ["歌丸", "2026-05", "2026-06-30", "GMO", 46750],
  // 6月分（期限8/10）
  ["横山", "2026-06", "2026-07-31", "BANK_TRANSFER", 55000],
  ["七條", "2026-06", "2026-07-31", "BANK_TRANSFER", 55000],
  ["倉田", "2026-06", "2026-07-31", "BANK_TRANSFER", 55000],
  ["吉原", "2026-06", "2026-07-31", "BANK_TRANSFER", 55000],
  ["金山", "2026-06", "2026-07-27", "BANK_TRANSFER", 55000],
  ["高橋", "2026-06", "2026-08-10", "BANK_TRANSFER", 55000],
  ["歌丸", "2026-06", "2026-07-31", "GMO", 49500],
  ["森下", "2026-06", "2026-07-24", "SQUARE", 55000],
  ["齋藤", "2026-06", "2026-08-14", "SQUARE", 55000],
];
(async () => {
  const admin = await db.user.findUnique({ where: { email: "hiroki.shirakawa@adarch.co.jp" }, select: { id: true } });
  if (!admin) throw new Error("admin user not found");
  const gcs = await db.groupCompany.findMany({ select: { id: true, name: true } });
  let n = 0;
  for (const [nm, month, paidOn, method, amount] of rows) {
    const gc = gcs.filter((g) => g.name.startsWith(nm));
    if (gc.length !== 1) { console.log("SKIP ambiguous/none:", nm, gc.map(g=>g.name)); continue; }
    const [y, m, d] = paidOn.split("-").map(Number);
    await db.royaltyPaymentCheck.upsert({
      where: { groupCompanyId_month: { groupCompanyId: gc[0].id, month } },
      create: { groupCompanyId: gc[0].id, month, paidOn: new Date(Date.UTC(y, m - 1, d)), method: method as any, amountInclTax: amount, note: "9/1照合結果より一括取込", checkedById: admin.id },
      update: { paidOn: new Date(Date.UTC(y, m - 1, d)), method: method as any, amountInclTax: amount, note: "9/1照合結果より一括取込", checkedById: admin.id },
    });
    n++;
  }
  await db.auditLog.create({ data: { action: "royalty_payment_check_bulk_import", email: "hiroki.shirakawa@adarch.co.jp", name: "白川 裕喜（本部）", entity: "royalty_payment_check", entityId: "2026-04..06", detail: `9/1照合結果から ${n} 件を一括取込（代表承認 2026-09-01）` } });
  console.log("imported:", n);
  const cnt = await db.royaltyPaymentCheck.groupBy({ by: ["month"], _count: { _all: true }, orderBy: { month: "asc" } });
  console.table(cnt.map(c => ({ month: c.month, n: c._count._all })));
  await db.$disconnect();
})();
