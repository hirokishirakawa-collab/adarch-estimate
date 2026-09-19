-- CreateEnum
CREATE TYPE "StudioInquiryKind" AS ENUM ('SHOOTING', 'VIDEO', 'SNS', 'MEDIA', 'TVER', 'OTHER');

-- CreateEnum
CREATE TYPE "StudioInquiryStatus" AS ENUM ('RECEIVED', 'CONSULTING', 'CONFIRMED', 'DECLINED', 'SPAM');

-- CreateTable
CREATE TABLE "studio_inquiries" (
    "id" TEXT NOT NULL,
    "number" SERIAL NOT NULL,
    "kind" "StudioInquiryKind" NOT NULL,
    "companyName" TEXT NOT NULL,
    "contactName" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "phone" TEXT,
    "prefecture" TEXT,
    "location" TEXT,
    "locationPrefecture" TEXT,
    "preferredDates" TEXT,
    "budgetRange" TEXT,
    "mediaName" TEXT,
    "detail" TEXT NOT NULL,
    "ipHash" TEXT NOT NULL,
    "userAgent" TEXT,
    "suspectedSpam" BOOLEAN NOT NULL DEFAULT false,
    "assignedGroupCompanyId" TEXT,
    "assignedBranchId" TEXT,
    "routeReason" TEXT NOT NULL,
    "status" "StudioInquiryStatus" NOT NULL DEFAULT 'RECEIVED',
    "dueAt" TIMESTAMP(3) NOT NULL,
    "firstRepliedAt" TIMESTAMP(3),
    "orderScope" TEXT,
    "orderAmountExclTax" INTEGER,
    "orderDueDate" TIMESTAMP(3),
    "orderPaymentDate" TIMESTAMP(3),
    "confirmedAt" TIMESTAMP(3),
    "confirmedById" TEXT,
    "history" JSONB NOT NULL DEFAULT '[]',
    "internalNote" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "studio_inquiries_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "studio_prefecture_assignments" (
    "id" TEXT NOT NULL,
    "prefecture" TEXT NOT NULL,
    "groupCompanyId" TEXT NOT NULL,
    "branchId" TEXT NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "lastAssignedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "studio_prefecture_assignments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "studio_published_items" (
    "type" TEXT NOT NULL,
    "refId" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "studio_published_items_pkey" PRIMARY KEY ("type","refId")
);

-- CreateIndex
CREATE UNIQUE INDEX "studio_inquiries_number_key" ON "studio_inquiries"("number");

-- CreateIndex
CREATE INDEX "studio_inquiries_assignedBranchId_createdAt_idx" ON "studio_inquiries"("assignedBranchId", "createdAt" DESC);

-- CreateIndex
CREATE INDEX "studio_inquiries_status_dueAt_idx" ON "studio_inquiries"("status", "dueAt");

-- CreateIndex
CREATE INDEX "studio_inquiries_ipHash_createdAt_idx" ON "studio_inquiries"("ipHash", "createdAt");

-- CreateIndex
CREATE INDEX "studio_inquiries_email_createdAt_idx" ON "studio_inquiries"("email", "createdAt");

-- CreateIndex
CREATE INDEX "studio_inquiries_createdAt_idx" ON "studio_inquiries"("createdAt" DESC);

-- CreateIndex
CREATE INDEX "studio_prefecture_assignments_prefecture_active_idx" ON "studio_prefecture_assignments"("prefecture", "active");

-- CreateIndex
CREATE UNIQUE INDEX "studio_prefecture_assignments_prefecture_groupCompanyId_key" ON "studio_prefecture_assignments"("prefecture", "groupCompanyId");

