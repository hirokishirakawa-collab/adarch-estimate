-- CreateEnum
CREATE TYPE "AdvertiserReviewStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED');

-- CreateTable
CREATE TABLE "advertiser_reviews" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "websiteUrl" TEXT NOT NULL,
    "corporateNumber" VARCHAR(13),
    "hasNoCorporateNumber" BOOLEAN NOT NULL DEFAULT false,
    "productUrl" TEXT NOT NULL,
    "desiredStartDate" TIMESTAMP(3),
    "remarks" TEXT,
    "status" "AdvertiserReviewStatus" NOT NULL DEFAULT 'PENDING',
    "reviewNote" TEXT,
    "reviewedAt" TIMESTAMP(3),
    "reviewedById" TEXT,
    "createdById" TEXT NOT NULL,
    "creatorEmail" TEXT NOT NULL,
    "branchId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "advertiser_reviews_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "advertiser_reviews_branchId_idx" ON "advertiser_reviews"("branchId");

-- CreateIndex
CREATE INDEX "advertiser_reviews_createdById_idx" ON "advertiser_reviews"("createdById");

-- CreateIndex
CREATE INDEX "advertiser_reviews_status_idx" ON "advertiser_reviews"("status");

-- CreateIndex
CREATE INDEX "advertiser_reviews_branchId_createdAt_idx" ON "advertiser_reviews"("branchId", "createdAt" DESC);

-- AddForeignKey
ALTER TABLE "advertiser_reviews" ADD CONSTRAINT "advertiser_reviews_reviewedById_fkey"
    FOREIGN KEY ("reviewedById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "advertiser_reviews" ADD CONSTRAINT "advertiser_reviews_createdById_fkey"
    FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "advertiser_reviews" ADD CONSTRAINT "advertiser_reviews_branchId_fkey"
    FOREIGN KEY ("branchId") REFERENCES "branches"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
