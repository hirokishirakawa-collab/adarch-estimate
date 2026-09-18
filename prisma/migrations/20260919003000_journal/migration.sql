-- 追加のみ。既存テーブルへのALTER/DROPなし。適用は本番承認後。
-- CreateTable
CREATE TABLE "journal_entries" (
    "id" TEXT NOT NULL,
    "ownerId" TEXT NOT NULL,
    "ownerName" TEXT NOT NULL,
    "branchId" TEXT NOT NULL,
    "groupCompanyId" TEXT,
    "externalId" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "content" JSONB NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'DRAFT',
    "revision" INTEGER NOT NULL DEFAULT 1,
    "approvedRevision" INTEGER,
    "approvedBy" TEXT,
    "approvedAt" TIMESTAMP(3),
    "publicSnapshot" JSONB,
    "firstPublishedAt" TIMESTAMP(3),
    "deliveredRevision" INTEGER,
    "deliveredAt" TIMESTAMP(3),
    "reviewNote" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "journal_entries_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "journal_assets" (
    "id" TEXT NOT NULL,
    "ownerId" TEXT NOT NULL,
    "sha256" TEXT NOT NULL,
    "data" BYTEA NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "journal_assets_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "journal_entries_ownerId_updatedAt_idx" ON "journal_entries"("ownerId", "updatedAt");

-- CreateIndex
CREATE INDEX "journal_entries_status_updatedAt_idx" ON "journal_entries"("status", "updatedAt");

-- CreateIndex
CREATE UNIQUE INDEX "journal_entries_ownerId_externalId_key" ON "journal_entries"("ownerId", "externalId");

-- CreateIndex
CREATE UNIQUE INDEX "journal_entries_kind_slug_key" ON "journal_entries"("kind", "slug");

-- CreateIndex
CREATE UNIQUE INDEX "journal_assets_ownerId_sha256_key" ON "journal_assets"("ownerId", "sha256");
