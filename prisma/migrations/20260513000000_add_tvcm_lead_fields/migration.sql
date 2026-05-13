-- TVCM/動画PR リード機能用フィールド追加（PR TIMES由来のリード）

-- 1) LeadSource enum に PR_TIMES_TVCM を追加
ALTER TYPE "LeadSource" ADD VALUE 'PR_TIMES_TVCM';

-- 2) leads テーブルに TVCM 専用フィールド追加
ALTER TABLE "leads"
  ADD COLUMN "pressReleaseUrl"   TEXT,
  ADD COLUMN "pressReleaseTitle" TEXT,
  ADD COLUMN "videoUrl"          TEXT,
  ADD COLUMN "announcedDate"     TIMESTAMP(3),
  ADD COLUMN "productionCompany" TEXT,
  ADD COLUMN "prefecture"        TEXT,
  ADD COLUMN "agencyDetected"    TEXT,
  ADD COLUMN "isListed"          BOOLEAN;
