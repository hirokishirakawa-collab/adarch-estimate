-- CreateEnum
CREATE TYPE "TverCreativeReviewStatus" AS ENUM ('SUBMITTED', 'APPROVED', 'REJECTED');

-- CreateTable
CREATE TABLE "tver_creative_reviews" (
    "id" TEXT NOT NULL,
    "advertiserId" TEXT NOT NULL,
    "projectName" TEXT NOT NULL,
    "numberOfAssets" INTEGER NOT NULL,
    "driveUrl" TEXT NOT NULL,
    "remarks" TEXT,
    "status" "TverCreativeReviewStatus" NOT NULL DEFAULT 'SUBMITTED',
    "createdById" TEXT NOT NULL,
    "creatorEmail" TEXT NOT NULL,
    "branchId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "tver_creative_reviews_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "tver_creative_reviews_branchId_idx" ON "tver_creative_reviews"("branchId");
CREATE INDEX "tver_creative_reviews_createdById_idx" ON "tver_creative_reviews"("createdById");
CREATE INDEX "tver_creative_reviews_advertiserId_idx" ON "tver_creative_reviews"("advertiserId");
CREATE INDEX "tver_creative_reviews_status_idx" ON "tver_creative_reviews"("status");

-- AddForeignKey
ALTER TABLE "tver_creative_reviews" ADD CONSTRAINT "tver_creative_reviews_advertiserId_fkey" FOREIGN KEY ("advertiserId") REFERENCES "advertiser_reviews"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "tver_creative_reviews" ADD CONSTRAINT "tver_creative_reviews_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "tver_creative_reviews" ADD CONSTRAINT "tver_creative_reviews_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "branches"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
