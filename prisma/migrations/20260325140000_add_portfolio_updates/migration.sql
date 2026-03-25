-- CreateTable
CREATE TABLE "portfolio_updates" (
    "id" TEXT NOT NULL,
    "fileId" TEXT NOT NULL,
    "fileName" TEXT NOT NULL,
    "fileUrl" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "modifiedAt" TIMESTAMP(3) NOT NULL,
    "modifiedBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "portfolio_updates_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "portfolio_updates_fileId_key" ON "portfolio_updates"("fileId");
CREATE INDEX "portfolio_updates_modifiedAt_idx" ON "portfolio_updates"("modifiedAt" DESC);
