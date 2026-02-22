-- 旧 billing_requests テーブル・Enum を削除
DROP TABLE IF EXISTS "billing_requests";
DROP TYPE IF EXISTS "BillingRequestStatus";

-- InvoiceRequestStatus Enum を作成
CREATE TYPE "InvoiceRequestStatus" AS ENUM ('DRAFT', 'SUBMITTED');

-- invoice_requests テーブルを作成
CREATE TABLE "invoice_requests" (
  "id"               TEXT          NOT NULL,
  "subject"          TEXT          NOT NULL,
  "clientName"       TEXT          NOT NULL,
  "contactName"      TEXT,
  "billingDate"      TIMESTAMP(3)  NOT NULL,
  "dueDate"          TIMESTAMP(3),
  "details"          TEXT,
  "amountExclTax"    DECIMAL(15,0) NOT NULL,
  "taxAmount"        DECIMAL(15,0) NOT NULL,
  "amountInclTax"    DECIMAL(15,0) NOT NULL,
  "inspectionStatus" TEXT,
  "fileUrl"          TEXT,
  "notes"            TEXT,
  "status"           "InvoiceRequestStatus" NOT NULL DEFAULT 'DRAFT',
  "projectId"        TEXT,
  "createdById"      TEXT          NOT NULL,
  "creatorEmail"     TEXT          NOT NULL,
  "branchId"         TEXT          NOT NULL,
  "createdAt"        TIMESTAMP(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"        TIMESTAMP(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "invoice_requests_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "invoice_requests_projectId_fkey"
    FOREIGN KEY ("projectId") REFERENCES "projects"("id")
    ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT "invoice_requests_createdById_fkey"
    FOREIGN KEY ("createdById") REFERENCES "users"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "invoice_requests_branchId_fkey"
    FOREIGN KEY ("branchId") REFERENCES "branches"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE INDEX "invoice_requests_branchId_idx"    ON "invoice_requests"("branchId");
CREATE INDEX "invoice_requests_createdById_idx" ON "invoice_requests"("createdById");
CREATE INDEX "invoice_requests_status_idx"      ON "invoice_requests"("status");
CREATE INDEX "invoice_requests_projectId_idx"   ON "invoice_requests"("projectId");
