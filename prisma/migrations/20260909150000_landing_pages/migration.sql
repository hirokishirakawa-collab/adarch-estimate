
-- CreateEnum
CREATE TYPE "LandingPageStatus" AS ENUM ('DRAFT', 'PUBLISHED', 'ARCHIVED');

-- CreateTable
CREATE TABLE "landing_pages" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "status" "LandingPageStatus" NOT NULL DEFAULT 'PUBLISHED',
    "title" TEXT NOT NULL,
    "headline" TEXT NOT NULL,
    "subheadline" TEXT,
    "industry" TEXT,
    "prefecture" TEXT,
    "cityCode" TEXT,
    "cityName" TEXT,
    "packageSlug" TEXT,
    "sections" JSONB NOT NULL,
    "ctaLabel" TEXT NOT NULL DEFAULT 'エリア限定プランを見る',
    "ctaUrl" TEXT NOT NULL,
    "lineUrl" TEXT,
    "showTverPlan" BOOLEAN NOT NULL DEFAULT true,
    "branchId" TEXT,
    "groupCompanyId" TEXT,
    "createdByEmail" TEXT NOT NULL,
    "createdByName" TEXT,
    "views" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "landing_pages_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "landing_pages_slug_key" ON "landing_pages"("slug");

-- CreateIndex
CREATE INDEX "landing_pages_branchId_idx" ON "landing_pages"("branchId");

-- CreateIndex
CREATE INDEX "landing_pages_industry_idx" ON "landing_pages"("industry");

-- CreateIndex
CREATE INDEX "landing_pages_createdAt_idx" ON "landing_pages"("createdAt" DESC);

