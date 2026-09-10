-- CreateTable
CREATE TABLE "dm_kits" (
    "id" TEXT NOT NULL,
    "createdById" TEXT NOT NULL,
    "createdByName" TEXT NOT NULL,
    "createdByEmail" TEXT NOT NULL,
    "branchId" TEXT,
    "groupCompanyId" TEXT,
    "source" TEXT NOT NULL DEFAULT 'SCREEN',
    "prefecture" TEXT NOT NULL,
    "city" TEXT NOT NULL,
    "industry" TEXT,
    "catchCopy" TEXT,
    "landingUrl" TEXT,
    "template" TEXT NOT NULL DEFAULT 'orange',
    "flyerUrl" TEXT,
    "flyerSource" TEXT NOT NULL DEFAULT 'GENERATED',
    "webletterCsvUrl" TEXT NOT NULL,
    "genericCsvUrl" TEXT NOT NULL,
    "readyCount" INTEGER NOT NULL DEFAULT 0,
    "needsFixCount" INTEGER NOT NULL DEFAULT 0,
    "skippedCount" INTEGER NOT NULL DEFAULT 0,
    "leadIds" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "needsFix" JSONB,
    "skipped" JSONB,
    "sentAt" TIMESTAMP(3),
    "sentVia" TEXT,
    "sentNote" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "dm_kits_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "dm_kits_createdById_idx" ON "dm_kits"("createdById");
CREATE INDEX "dm_kits_groupCompanyId_idx" ON "dm_kits"("groupCompanyId");
CREATE INDEX "dm_kits_createdAt_idx" ON "dm_kits"("createdAt");
