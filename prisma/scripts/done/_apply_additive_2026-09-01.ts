// prisma db push が「ユニーク制約追加」を data-loss 警告扱いにしたため、同じ追加SQL（migrate diff の出力そのまま）を適用する
import { config } from "dotenv";
config({ path: ".env.local" });
import { PrismaClient } from "../../src/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
const db = new PrismaClient({ adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL as string }) });
const stmts = [
  `ALTER TABLE "customers" ADD COLUMN IF NOT EXISTS "mfDepartmentId" TEXT, ADD COLUMN IF NOT EXISTS "mfPartnerId" TEXT, ADD COLUMN IF NOT EXISTS "mfPartnerName" TEXT`,
  `ALTER TABLE "invoice_requests" ADD COLUMN IF NOT EXISTS "mfBillingId" TEXT, ADD COLUMN IF NOT EXISTS "mfBillingNumber" TEXT, ADD COLUMN IF NOT EXISTS "mfPaymentStatus" INTEGER, ADD COLUMN IF NOT EXISTS "mfPdfUrl" TEXT, ADD COLUMN IF NOT EXISTS "mfSyncedAt" TIMESTAMP(3), ADD COLUMN IF NOT EXISTS "squareLinkAmount" INTEGER, ADD COLUMN IF NOT EXISTS "squareLinkId" TEXT, ADD COLUMN IF NOT EXISTS "squareLinkUrl" TEXT`,
  `CREATE UNIQUE INDEX IF NOT EXISTS "invoice_requests_mfBillingId_key" ON "invoice_requests"("mfBillingId")`,
];
(async () => {
  for (const s of stmts) { await db.$executeRawUnsafe(s); console.log("ok:", s.slice(0, 60)); }
  await db.$disconnect();
})();
