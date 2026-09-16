-- 会議メモ（Web会議・訪問の要約）。原文は書いた人・本部・指名した人だけ、全社に出るのは匿名版だけ（2026-09-16）
-- CreateEnum
CREATE TYPE "MeetingVisibility" AS ENUM ('PRIVATE', 'ALLOWED', 'GROUP');

-- CreateTable
CREATE TABLE "meeting_notes" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "meetingAt" TIMESTAMP(3) NOT NULL,
    "durationMin" INTEGER,
    "source" TEXT NOT NULL DEFAULT 'ZOOM',
    "customerId" TEXT,
    "dealId" TEXT,
    "branchId" TEXT,
    "counterpart" TEXT,
    "industry" TEXT,
    "prefecture" TEXT,
    "summary" TEXT NOT NULL,
    "concerns" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "winPoints" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "objections" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "nextActions" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "sharedSummary" TEXT,
    "visibility" "MeetingVisibility" NOT NULL DEFAULT 'PRIVATE',
    "allowedEmails" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "createdByEmail" TEXT NOT NULL,
    "createdByName" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "meeting_notes_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "meeting_notes_customerId_idx" ON "meeting_notes"("customerId");

-- CreateIndex
CREATE INDEX "meeting_notes_dealId_idx" ON "meeting_notes"("dealId");

-- CreateIndex
CREATE INDEX "meeting_notes_branchId_idx" ON "meeting_notes"("branchId");

-- CreateIndex
CREATE INDEX "meeting_notes_meetingAt_idx" ON "meeting_notes"("meetingAt" DESC);

