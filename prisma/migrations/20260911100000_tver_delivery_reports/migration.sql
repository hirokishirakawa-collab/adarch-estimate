-- CreateEnum
CREATE TYPE "TverDeliveryReportStatus" AS ENUM ('IMPORTED', 'PUBLISHED');

-- CreateTable
CREATE TABLE "tver_delivery_reports" (
    "id" TEXT NOT NULL,
    "fileName" TEXT NOT NULL,
    "advertiserTverId" TEXT NOT NULL,
    "advertiserName" TEXT NOT NULL,
    "periodStart" TIMESTAMP(3) NOT NULL,
    "periodEnd" TIMESTAMP(3) NOT NULL,
    "rowCount" INTEGER NOT NULL,
    "campaignNames" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "adSeconds" INTEGER,
    "impressions" INTEGER NOT NULL,
    "clicks" INTEGER NOT NULL,
    "completes" INTEGER NOT NULL,
    "wholesaleAmount" INTEGER NOT NULL,
    "sellAmount" INTEGER NOT NULL,
    "sellMultiplier" INTEGER NOT NULL,
    "crossCheckAmount" INTEGER NOT NULL,
    "crossCheckDiffPct" DOUBLE PRECISION NOT NULL,
    "warnings" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "groupCompanyId" TEXT,
    "tverOrderId" TEXT,
    "status" "TverDeliveryReportStatus" NOT NULL DEFAULT 'IMPORTED',
    "adminNote" TEXT,
    "partnerNote" TEXT,
    "importedByEmail" TEXT NOT NULL,
    "confirmedAt" TIMESTAMP(3),
    "confirmedByEmail" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "tver_delivery_reports_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tver_delivery_rows" (
    "id" TEXT NOT NULL,
    "reportId" TEXT NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "campaignId" TEXT NOT NULL,
    "campaignName" TEXT NOT NULL,
    "adGroupName" TEXT NOT NULL,
    "creativeName" TEXT NOT NULL,
    "adId" TEXT NOT NULL,
    "gender" TEXT NOT NULL,
    "age" TEXT NOT NULL,
    "prefecture" TEXT NOT NULL,
    "device" TEXT NOT NULL,
    "clicks" INTEGER NOT NULL,
    "impressions" INTEGER NOT NULL,
    "q25" INTEGER NOT NULL,
    "q50" INTEGER NOT NULL,
    "q75" INTEGER NOT NULL,
    "q100" INTEGER NOT NULL,
    "wholesaleAmount" INTEGER NOT NULL,
    "wholesaleCpm" INTEGER NOT NULL,
    "sellAmount" INTEGER NOT NULL,
    "cv" INTEGER NOT NULL,
    "indirectCv" INTEGER NOT NULL,
    "vtcv" INTEGER NOT NULL,

    CONSTRAINT "tver_delivery_rows_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "tver_delivery_reports_status_createdAt_idx" ON "tver_delivery_reports"("status", "createdAt" DESC);
CREATE INDEX "tver_delivery_reports_groupCompanyId_status_periodEnd_idx" ON "tver_delivery_reports"("groupCompanyId", "status", "periodEnd" DESC);
CREATE INDEX "tver_delivery_reports_advertiserTverId_idx" ON "tver_delivery_reports"("advertiserTverId");
CREATE INDEX "tver_delivery_reports_tverOrderId_idx" ON "tver_delivery_reports"("tverOrderId");
CREATE INDEX "tver_delivery_rows_reportId_date_idx" ON "tver_delivery_rows"("reportId", "date");
CREATE INDEX "tver_delivery_rows_reportId_prefecture_idx" ON "tver_delivery_rows"("reportId", "prefecture");

-- AddForeignKey
ALTER TABLE "tver_delivery_reports" ADD CONSTRAINT "tver_delivery_reports_groupCompanyId_fkey" FOREIGN KEY ("groupCompanyId") REFERENCES "group_companies"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "tver_delivery_reports" ADD CONSTRAINT "tver_delivery_reports_tverOrderId_fkey" FOREIGN KEY ("tverOrderId") REFERENCES "tver_orders"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "tver_delivery_rows" ADD CONSTRAINT "tver_delivery_rows_reportId_fkey" FOREIGN KEY ("reportId") REFERENCES "tver_delivery_reports"("id") ON DELETE CASCADE ON UPDATE CASCADE;
