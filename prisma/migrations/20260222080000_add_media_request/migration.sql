-- CreateEnum
CREATE TYPE "MediaType" AS ENUM ('TVER', 'CINE_AD', 'DIGITAL_SIGNAGE', 'TAXI', 'APA_HOTEL', 'UNIVERSITY', 'SKYLARK', 'GOLF_CART', 'ACQUISITION', 'OTHER');

-- CreateEnum
CREATE TYPE "MediaRequestStatus" AS ENUM ('PENDING', 'REVIEWING', 'COMPLETED', 'CANCELLED');

-- CreateTable
CREATE TABLE "media_requests" (
    "id" TEXT NOT NULL,
    "mediaType" "MediaType" NOT NULL,
    "mediaName" TEXT NOT NULL,
    "customerId" TEXT,
    "startDate" TIMESTAMP(3),
    "endDate" TIMESTAMP(3),
    "budget" TEXT,
    "description" TEXT,
    "attachmentUrl" TEXT,
    "status" "MediaRequestStatus" NOT NULL DEFAULT 'PENDING',
    "replyNote" TEXT,
    "branchId" TEXT,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "media_requests_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "media_requests_branchId_idx" ON "media_requests"("branchId");

-- CreateIndex
CREATE INDEX "media_requests_createdById_idx" ON "media_requests"("createdById");

-- CreateIndex
CREATE INDEX "media_requests_status_idx" ON "media_requests"("status");

-- CreateIndex
CREATE INDEX "media_requests_branchId_createdAt_idx" ON "media_requests"("branchId", "createdAt" DESC);

-- AddForeignKey
ALTER TABLE "media_requests" ADD CONSTRAINT "media_requests_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "customers"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "media_requests" ADD CONSTRAINT "media_requests_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "branches"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "media_requests" ADD CONSTRAINT "media_requests_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
