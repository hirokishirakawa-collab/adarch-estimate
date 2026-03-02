CREATE TABLE "VideoAchievement" (
  "id" TEXT NOT NULL,
  "companyName" TEXT NOT NULL,
  "prefecture" TEXT NOT NULL,
  "industry" TEXT NOT NULL DEFAULT '不明',
  "productionCompany" TEXT NOT NULL,
  "videoType" TEXT NOT NULL DEFAULT '不明',
  "referenceUrl" TEXT,
  "contentSummary" TEXT,
  "sourceUrl" TEXT,
  "isProcessed" BOOLEAN NOT NULL DEFAULT false,
  "createdById" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "VideoAchievement_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "VideoAchievement_companyName_productionCompany_key"
  ON "VideoAchievement"("companyName","productionCompany");
CREATE INDEX "VideoAchievement_prefecture_idx" ON "VideoAchievement"("prefecture");
CREATE INDEX "VideoAchievement_industry_idx" ON "VideoAchievement"("industry");
CREATE INDEX "VideoAchievement_isProcessed_idx" ON "VideoAchievement"("isProcessed");
ALTER TABLE "VideoAchievement"
  ADD CONSTRAINT "VideoAchievement_createdById_fkey"
  FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
