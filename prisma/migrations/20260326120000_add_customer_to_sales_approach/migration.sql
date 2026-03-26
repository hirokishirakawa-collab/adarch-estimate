-- AlterTable
ALTER TABLE "sales_approaches" ADD COLUMN "customerId" TEXT;

-- AddForeignKey
ALTER TABLE "sales_approaches" ADD CONSTRAINT "sales_approaches_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "customers"("id") ON DELETE SET NULL ON UPDATE CASCADE;
