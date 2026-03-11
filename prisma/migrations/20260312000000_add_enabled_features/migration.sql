-- AlterTable
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "enabledFeatures" TEXT[] DEFAULT ARRAY[]::TEXT[];
