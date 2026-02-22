-- BillingRequestStatus Enum
CREATE TYPE "BillingRequestStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED');

-- BillingRequest テーブル
CREATE TABLE "billing_requests" (
  "id"           TEXT NOT NULL,
  "title"        TEXT NOT NULL,
  "clientName"   TEXT NOT NULL,
  "amount"       DECIMAL(15,0) NOT NULL,
  "description"  TEXT,
  "status"       "BillingRequestStatus" NOT NULL DEFAULT 'PENDING',
  "createdById"  TEXT NOT NULL,
  "creatorEmail" TEXT NOT NULL,
  "branchId"     TEXT NOT NULL,
  "createdAt"    TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"    TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "billing_requests_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "billing_requests_createdById_fkey"
    FOREIGN KEY ("createdById") REFERENCES "users"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "billing_requests_branchId_fkey"
    FOREIGN KEY ("branchId") REFERENCES "branches"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE INDEX "billing_requests_branchId_idx"    ON "billing_requests"("branchId");
CREATE INDEX "billing_requests_createdById_idx" ON "billing_requests"("createdById");
CREATE INDEX "billing_requests_status_idx"      ON "billing_requests"("status");
