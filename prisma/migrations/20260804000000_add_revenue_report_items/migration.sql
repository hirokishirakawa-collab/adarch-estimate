-- 月次報告の明細化＋請求元区分。
-- ① revenue_reports に請求元別の小計（税抜）を追加。既存行は 0 のまま＝「区分なし（旧データ）」として扱う。
-- ② revenue_report_items（明細行）を新設。1行 = 1案件（クライアント名・案件名・税抜/税込・備考）。
-- 追加のみ・既存カラム(amount 等)は不変なので、既存の集計・表示コードには影響しない。

-- CreateEnum
CREATE TYPE "RevenueBilledBy" AS ENUM ('SELF', 'HQ');

-- AlterTable
ALTER TABLE "revenue_reports"
  ADD COLUMN "selfAmount" DECIMAL(15,0) NOT NULL DEFAULT 0,
  ADD COLUMN "hqAmount"   DECIMAL(15,0) NOT NULL DEFAULT 0;

-- CreateTable
CREATE TABLE "revenue_report_items" (
    "id" TEXT NOT NULL,
    "reportId" TEXT NOT NULL,
    "billedBy" "RevenueBilledBy" NOT NULL DEFAULT 'SELF',
    "clientName" TEXT NOT NULL,
    "projectName" TEXT NOT NULL,
    "amountExclTax" DECIMAL(15,0) NOT NULL,
    "taxAmount" DECIMAL(15,0) NOT NULL,
    "amountInclTax" DECIMAL(15,0) NOT NULL,
    "memo" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "revenue_report_items_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "revenue_report_items_reportId_idx" ON "revenue_report_items"("reportId");

-- AddForeignKey
ALTER TABLE "revenue_report_items"
  ADD CONSTRAINT "revenue_report_items_reportId_fkey"
  FOREIGN KEY ("reportId") REFERENCES "revenue_reports"("id") ON DELETE CASCADE ON UPDATE CASCADE;
