-- AlterTable
ALTER TABLE "tver_creative_reviews" ADD COLUMN "review_note" TEXT;
ALTER TABLE "tver_creative_reviews" ADD COLUMN "reviewed_at" TIMESTAMP(3);
ALTER TABLE "tver_creative_reviews" ADD COLUMN "reviewed_by_id" TEXT;

-- AddForeignKey
ALTER TABLE "tver_creative_reviews" ADD CONSTRAINT "tver_creative_reviews_reviewed_by_id_fkey" FOREIGN KEY ("reviewed_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
