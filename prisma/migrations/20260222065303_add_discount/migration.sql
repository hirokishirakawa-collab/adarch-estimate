-- AlterTable
ALTER TABLE "estimations" ADD COLUMN     "discountAmount" DECIMAL(15,0),
ADD COLUMN     "discountReason" TEXT,
ADD COLUMN     "discountReasonNote" TEXT;
