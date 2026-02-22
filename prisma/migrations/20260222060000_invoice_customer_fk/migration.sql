-- clientName カラムを削除し、customerId FK に置き換える

ALTER TABLE "invoice_requests" DROP COLUMN IF EXISTS "clientName";

ALTER TABLE "invoice_requests"
  ADD COLUMN "customerId" TEXT;

ALTER TABLE "invoice_requests"
  ADD CONSTRAINT "invoice_requests_customerId_fkey"
  FOREIGN KEY ("customerId") REFERENCES "customers"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

CREATE INDEX "invoice_requests_customerId_idx" ON "invoice_requests"("customerId");
