-- AlterTable
ALTER TABLE "tver_creative_reviews" ADD COLUMN "reviewNote" TEXT;
ALTER TABLE "tver_creative_reviews" ADD COLUMN "reviewedAt" TIMESTAMP(3);
ALTER TABLE "tver_creative_reviews" ADD COLUMN "reviewedById" TEXT;

-- AddForeignKey
ALTER TABLE "tver_creative_reviews" ADD CONSTRAINT "tver_creative_reviews_reviewedById_fkey" FOREIGN KEY ("reviewedById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
