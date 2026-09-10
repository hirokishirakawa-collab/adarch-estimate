-- CreateTable
CREATE TABLE "seminar_recordings" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "videoUrl" TEXT NOT NULL,
    "presenterName" TEXT NOT NULL,
    "ownerEmail" TEXT NOT NULL,
    "ownerCompanyId" TEXT,
    "ownerCompany" TEXT NOT NULL,
    "prefecture" TEXT,
    "audience" TEXT,
    "summary" TEXT,
    "durationMin" INTEGER,
    "recordedAt" TIMESTAMP(3),
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "viewCount" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "seminar_recordings_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "seminar_recordings_isActive_createdAt_idx" ON "seminar_recordings"("isActive", "createdAt");
