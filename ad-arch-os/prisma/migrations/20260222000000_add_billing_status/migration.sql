-- CreateEnum
CREATE TYPE "BillingStatus" AS ENUM ('UNBILLED', 'BILLED', 'PAID');

-- AlterTable
ALTER TABLE "projects" ADD COLUMN "billingStatus" "BillingStatus" NOT NULL DEFAULT 'UNBILLED';
