-- CreateEnum
CREATE TYPE "CollaborationRequestType" AS ENUM ('SHOOTING_SUPPORT', 'EDITING_RESOURCE', 'EQUIPMENT_CAST', 'KNOWLEDGE_SHARING', 'OTHER');

-- CreateEnum
CREATE TYPE "CollaborationStatus" AS ENUM ('PENDING', 'REVIEWING', 'ACCEPTED', 'DECLINED', 'COMPLETED');

-- CreateTable
CREATE TABLE "group_collaboration_requests" (
    "id" TEXT NOT NULL,
    "projectId" TEXT,
    "counterpartName" TEXT NOT NULL,
    "requestType" "CollaborationRequestType" NOT NULL,
    "budget" TEXT,
    "description" TEXT NOT NULL,
    "desiredDate" TIMESTAMP(3),
    "attachmentUrl" TEXT,
    "status" "CollaborationStatus" NOT NULL DEFAULT 'PENDING',
    "replyNote" TEXT,
    "branchId" TEXT,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "group_collaboration_requests_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "group_collaboration_requests_branchId_idx" ON "group_collaboration_requests"("branchId");

-- CreateIndex
CREATE INDEX "group_collaboration_requests_createdById_idx" ON "group_collaboration_requests"("createdById");

-- CreateIndex
CREATE INDEX "group_collaboration_requests_status_idx" ON "group_collaboration_requests"("status");

-- CreateIndex
CREATE INDEX "group_collaboration_requests_projectId_idx" ON "group_collaboration_requests"("projectId");

-- AddForeignKey
ALTER TABLE "group_collaboration_requests" ADD CONSTRAINT "group_collaboration_requests_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "projects"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "group_collaboration_requests" ADD CONSTRAINT "group_collaboration_requests_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "branches"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "group_collaboration_requests" ADD CONSTRAINT "group_collaboration_requests_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
