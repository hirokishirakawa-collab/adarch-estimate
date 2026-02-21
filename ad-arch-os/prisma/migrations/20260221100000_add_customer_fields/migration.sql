-- CreateEnum
CREATE TYPE "CustomerRank" AS ENUM ('A', 'B', 'C', 'D');

-- CreateEnum
CREATE TYPE "CustomerStatus" AS ENUM ('PROSPECT', 'ACTIVE', 'INACTIVE', 'BLOCKED');

-- AlterTable
ALTER TABLE "customers" ADD COLUMN     "building" TEXT,
ADD COLUMN     "corporateNumber" VARCHAR(13),
ADD COLUMN     "postalCode" VARCHAR(8),
ADD COLUMN     "prefecture" TEXT,
ADD COLUMN     "rank" "CustomerRank" NOT NULL DEFAULT 'B',
ADD COLUMN     "recordNumber" SERIAL NOT NULL,
ADD COLUMN     "source" TEXT,
ADD COLUMN     "status" "CustomerStatus" NOT NULL DEFAULT 'PROSPECT',
ADD COLUMN     "website" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "customers_recordNumber_key" ON "customers"("recordNumber");
