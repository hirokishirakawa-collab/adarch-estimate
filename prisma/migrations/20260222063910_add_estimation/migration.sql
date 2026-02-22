-- CreateEnum
CREATE TYPE "EstimationStatus" AS ENUM ('DRAFT', 'SENT', 'ACCEPTED', 'REJECTED');

-- AlterTable
ALTER TABLE "invoice_requests" ALTER COLUMN "updatedAt" DROP DEFAULT;

-- AlterTable
ALTER TABLE "projects" ALTER COLUMN "updatedAt" DROP DEFAULT;

-- CreateTable
CREATE TABLE "estimation_templates" (
    "id" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "unitPrice" DECIMAL(15,0) NOT NULL,
    "unit" TEXT NOT NULL,
    "spec" TEXT,
    "costPrice" DECIMAL(15,0),
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "estimation_templates_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "estimations" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "status" "EstimationStatus" NOT NULL DEFAULT 'DRAFT',
    "estimateDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "validUntil" TIMESTAMP(3),
    "notes" TEXT,
    "staffName" TEXT,
    "customerId" TEXT,
    "projectId" TEXT,
    "branchId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "estimations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "estimation_items" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "spec" TEXT,
    "quantity" INTEGER NOT NULL DEFAULT 1,
    "unit" TEXT,
    "unitPrice" DECIMAL(15,0) NOT NULL,
    "amount" DECIMAL(15,0) NOT NULL,
    "costPrice" DECIMAL(15,0),
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "templateId" TEXT,
    "estimationId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "estimation_items_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "estimation_templates_category_idx" ON "estimation_templates"("category");

-- CreateIndex
CREATE INDEX "estimations_branchId_idx" ON "estimations"("branchId");

-- CreateIndex
CREATE INDEX "estimations_customerId_idx" ON "estimations"("customerId");

-- CreateIndex
CREATE INDEX "estimations_status_idx" ON "estimations"("status");

-- CreateIndex
CREATE INDEX "estimation_items_estimationId_idx" ON "estimation_items"("estimationId");

-- AddForeignKey
ALTER TABLE "estimations" ADD CONSTRAINT "estimations_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "customers"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "estimations" ADD CONSTRAINT "estimations_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "projects"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "estimations" ADD CONSTRAINT "estimations_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "branches"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "estimation_items" ADD CONSTRAINT "estimation_items_estimationId_fkey" FOREIGN KEY ("estimationId") REFERENCES "estimations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
