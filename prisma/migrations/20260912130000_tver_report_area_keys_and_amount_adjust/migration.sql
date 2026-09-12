-- 商圏を複数選べるように（本部が選んだキー。空でなければ再取込でも上書きしない）
ALTER TABLE "tver_delivery_reports" ADD COLUMN "areaKeys" TEXT[] DEFAULT ARRAY[]::TEXT[];

-- 金額の手動調整（本部だけ。拠点には調整後の金額が出る）
ALTER TABLE "tver_delivery_reports" ADD COLUMN "sellAmountAdjusted" INTEGER;
ALTER TABLE "tver_delivery_reports" ADD COLUMN "adjustNote" TEXT;
ALTER TABLE "tver_delivery_reports" ADD COLUMN "adjustedAt" TIMESTAMP(3);
ALTER TABLE "tver_delivery_reports" ADD COLUMN "adjustedByEmail" TEXT;
