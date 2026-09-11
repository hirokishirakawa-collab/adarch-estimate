-- CreateTable
CREATE TABLE "tver_delivery_ad_groups" (
    "id" TEXT NOT NULL,
    "reportId" TEXT NOT NULL,
    "adGroupName" TEXT NOT NULL,
    "areaLabel" TEXT,
    "areaPopulation" INTEGER,
    "areaSource" TEXT,

    CONSTRAINT "tver_delivery_ad_groups_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "tver_delivery_ad_groups_reportId_adGroupName_key" ON "tver_delivery_ad_groups"("reportId", "adGroupName");

-- AddForeignKey
ALTER TABLE "tver_delivery_ad_groups" ADD CONSTRAINT "tver_delivery_ad_groups_reportId_fkey" FOREIGN KEY ("reportId") REFERENCES "tver_delivery_reports"("id") ON DELETE CASCADE ON UPDATE CASCADE;
