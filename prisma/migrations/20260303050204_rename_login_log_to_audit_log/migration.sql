/*
  Warnings:

  - You are about to drop the `login_logs` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropTable
DROP TABLE "login_logs";

-- CreateTable
CREATE TABLE "audit_logs" (
    "id" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "name" TEXT,
    "entity" TEXT,
    "entityId" TEXT,
    "detail" TEXT,
    "ipAddress" TEXT,
    "userAgent" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "audit_logs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "audit_logs_createdAt_idx" ON "audit_logs"("createdAt" DESC);

-- CreateIndex
CREATE INDEX "audit_logs_email_idx" ON "audit_logs"("email");

-- CreateIndex
CREATE INDEX "audit_logs_action_idx" ON "audit_logs"("action");
