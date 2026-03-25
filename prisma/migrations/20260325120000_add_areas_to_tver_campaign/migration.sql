-- AlterTable
ALTER TABLE "tver_campaigns" ADD COLUMN "areas" TEXT[] DEFAULT ARRAY[]::TEXT[];
