-- CreateEnum
CREATE TYPE "TverCampaignBudgetType" AS ENUM ('TOTAL', 'MONTHLY');

-- CreateEnum
CREATE TYPE "TverFrequencyCapUnit" AS ENUM ('LIFETIME', 'WEEKLY', 'DAILY', 'HOURLY');

-- CreateEnum
CREATE TYPE "TverCompanionMobile" AS ENUM ('NONE', 'BANNER', 'ICON_TEXT', 'TEXT');

-- CreateEnum
CREATE TYPE "TverCompanionPc" AS ENUM ('NONE', 'BANNER');

-- CreateEnum
CREATE TYPE "TverCampaignStatus" AS ENUM ('DRAFT', 'SUBMITTED', 'APPROVED', 'REJECTED');

-- CreateTable
CREATE TABLE "tver_campaigns" (
    "id" TEXT NOT NULL,
    "advertiserId" TEXT NOT NULL,
    "campaignName" TEXT NOT NULL,
    "budget" DECIMAL(15,0) NOT NULL,
    "startDate" TIMESTAMP(3) NOT NULL,
    "endDate" TIMESTAMP(3) NOT NULL,
    "budgetType" "TverCampaignBudgetType" NOT NULL,
    "freqCapUnit" "TverFrequencyCapUnit",
    "freqCapCount" INTEGER,
    "companionMobile" "TverCompanionMobile" NOT NULL DEFAULT 'NONE',
    "companionPc" "TverCompanionPc" NOT NULL DEFAULT 'NONE',
    "landingPageUrl" TEXT,
    "status" "TverCampaignStatus" NOT NULL DEFAULT 'SUBMITTED',
    "reviewNote" TEXT,
    "createdById" TEXT NOT NULL,
    "creatorEmail" TEXT NOT NULL,
    "branchId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "tver_campaigns_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "tver_campaigns_branchId_idx" ON "tver_campaigns"("branchId");

-- CreateIndex
CREATE INDEX "tver_campaigns_createdById_idx" ON "tver_campaigns"("createdById");

-- CreateIndex
CREATE INDEX "tver_campaigns_advertiserId_idx" ON "tver_campaigns"("advertiserId");

-- CreateIndex
CREATE INDEX "tver_campaigns_status_idx" ON "tver_campaigns"("status");

-- CreateIndex
CREATE INDEX "tver_campaigns_branchId_createdAt_idx" ON "tver_campaigns"("branchId", "createdAt" DESC);

-- AddForeignKey
ALTER TABLE "tver_campaigns" ADD CONSTRAINT "tver_campaigns_advertiserId_fkey"
    FOREIGN KEY ("advertiserId") REFERENCES "advertiser_reviews"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tver_campaigns" ADD CONSTRAINT "tver_campaigns_createdById_fkey"
    FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tver_campaigns" ADD CONSTRAINT "tver_campaigns_branchId_fkey"
    FOREIGN KEY ("branchId") REFERENCES "branches"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
