-- AlterTable
ALTER TABLE "VideoAchievement" ALTER COLUMN "updatedAt" DROP DEFAULT;

-- AlterTable
ALTER TABLE "users" ADD COLUMN     "branchId2" TEXT;

-- CreateIndex
CREATE INDEX "users_branchId2_idx" ON "users"("branchId2");

-- AddForeignKey
ALTER TABLE "users" ADD CONSTRAINT "users_branchId2_fkey" FOREIGN KEY ("branchId2") REFERENCES "branches"("id") ON DELETE SET NULL ON UPDATE CASCADE;
