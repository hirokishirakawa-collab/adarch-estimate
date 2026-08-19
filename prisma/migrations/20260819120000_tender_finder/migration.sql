-- 入札ファインダー: 官公需情報ポータル（中小企業庁）から取り込んだ入札公告
-- 追加のみ。既存テーブル・既存の書き込み経路には影響しない。

CREATE TYPE "TenderFit" AS ENUM ('MATCH', 'MAYBE', 'MISMATCH');
CREATE TYPE "TenderOrdererType" AS ENUM ('MUNICIPAL', 'PREFECTURAL', 'OTHER');
CREATE TYPE "TenderWorkType" AS ENUM ('VIDEO', 'AD', 'PRINT', 'WEB', 'EVENT', 'DESIGN', 'OTHER');

CREATE TABLE "tenders" (
    "id" TEXT NOT NULL,
    "kkjKey" TEXT NOT NULL,
    "projectName" TEXT NOT NULL,
    "organizationName" TEXT,
    "prefectureName" TEXT,
    "cityName" TEXT,
    "lgCode" TEXT,
    "cityCode" TEXT,
    "ordererType" "TenderOrdererType" NOT NULL DEFAULT 'OTHER',
    "category" TEXT,
    "procedureType" TEXT,
    "certification" TEXT,
    "location" TEXT,
    "documentUrl" TEXT,
    "fileType" TEXT,
    "description" TEXT,
    "attachmentUrls" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "cftIssueDate" TIMESTAMP(3),
    "submissionDate" TIMESTAMP(3),
    "openingDate" TIMESTAMP(3),
    "periodEndTime" TIMESTAMP(3),
    "expiresAt" TIMESTAMP(3),
    "fit" "TenderFit" NOT NULL DEFAULT 'MAYBE',
    "workType" "TenderWorkType",
    "fitReason" TEXT,
    "fitEvidence" TEXT,
    "needsQualification" BOOLEAN NOT NULL DEFAULT false,
    "fitCheckedAt" TIMESTAMP(3),
    "contentHash" TEXT,
    "lastSyncedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "tenders_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "tenders_kkjKey_key" ON "tenders"("kkjKey");
CREATE INDEX "tenders_fit_cftIssueDate_idx" ON "tenders"("fit", "cftIssueDate");
CREATE INDEX "tenders_prefectureName_fit_idx" ON "tenders"("prefectureName", "fit");
CREATE INDEX "tenders_expiresAt_idx" ON "tenders"("expiresAt");
CREATE INDEX "tenders_fitCheckedAt_idx" ON "tenders"("fitCheckedAt");
